<?php

declare(strict_types=1);

namespace Syntax\Services;

use Syntax\Db;
use Syntax\Http\ApiError;
use Syntax\Support\Clock;
use Syntax\Support\Ids;
use Syntax\Support\Pagination;
use Syntax\Support\Password;
use Syntax\Support\Serialize;

final class AdminService
{
    public function getSchool(string $schoolId): array
    {
        return Serialize::school($this->findSchool($schoolId));
    }

    public function updateAcademicSetting(string $schoolId, array $data): array
    {
        $this->findSchool($schoolId);
        $sets = [];
        $params = ['id' => $schoolId, 'now' => Clock::nowDb()];
        $mapping = [
            'current_session' => 'current_session',
            'current_term' => 'current_term',
            'terms_per_session' => 'terms_per_session',
            'principalName' => 'principal_name',
        ];
        foreach ($mapping as $input => $column) {
            if (array_key_exists($input, $data)) {
                $sets[] = $column . ' = :' . $column;
                $params[$column] = $data[$input];
            }
        }
        if ($sets !== []) {
            Db::run('UPDATE schools SET ' . implode(', ', $sets) . ', updated_at = :now WHERE id = :id', $params);
        }
        return Serialize::school($this->findSchool($schoolId));
    }

    public function createClass(string $schoolId, array $data): array
    {
        $subjects = $this->normalizeSubjects($data['subjects']);
        $className = trim($data['className']);
        if (Db::one('SELECT id FROM classes WHERE school_id = :school AND class_name = :name', ['school' => $schoolId, 'name' => $className]) !== null) {
            throw ApiError::conflict('A class with this name already exists.', 'CLASS_EXISTS');
        }
        $teacherEmail = $this->validateTeacherEmail($schoolId, $data['teacherEmail'] ?? null);

        $now = Clock::nowDb();
        $row = [
            'id' => Ids::newId(),
            'school_id' => $schoolId,
            'class_name' => $className,
            'subjects_json' => json_encode($subjects, JSON_UNESCAPED_UNICODE),
            'teacher_email' => $teacherEmail,
            'created_at' => $now,
            'updated_at' => $now,
        ];
        Db::insert('classes', $row);
        return Serialize::class($row);
    }

    public function updateClass(string $schoolId, string $classId, array $data): array
    {
        $row = $this->findClass($classId, $schoolId);
        $sets = [];
        $params = ['id' => $classId, 'now' => Clock::nowDb()];
        $oldName = (string) $row['class_name'];
        $newName = $oldName;

        if (array_key_exists('className', $data)) {
            $newName = trim((string) $data['className']);
            if ($newName !== $oldName) {
                $duplicate = Db::one(
                    'SELECT id FROM classes WHERE school_id = :school AND class_name = :name AND id <> :id',
                    ['school' => $schoolId, 'name' => $newName, 'id' => $classId],
                );
                if ($duplicate !== null) {
                    throw ApiError::conflict('A class with this name already exists.', 'CLASS_EXISTS');
                }
            }
            $sets[] = 'class_name = :class_name';
            $params['class_name'] = $newName;
        }
        if (array_key_exists('subjects', $data)) {
            $sets[] = 'subjects_json = :subjects_json';
            $params['subjects_json'] = json_encode($this->normalizeSubjects($data['subjects']), JSON_UNESCAPED_UNICODE);
        }
        if (array_key_exists('teacherEmail', $data)) {
            $sets[] = 'teacher_email = :teacher_email';
            $params['teacher_email'] = $this->validateTeacherEmail($schoolId, $data['teacherEmail']);
        }

        if ($sets !== []) {
            $pdo = Db::pdo();
            $pdo->beginTransaction();
            try {
                Db::run('UPDATE classes SET ' . implode(', ', $sets) . ', updated_at = :now WHERE id = :id', $params);
                if ($newName !== $oldName) {
                    Db::run(
                        'UPDATE students SET current_class = :new_name, updated_at = :now WHERE school_id = :school AND current_class = :old_name',
                        ['new_name' => $newName, 'now' => Clock::nowDb(), 'school' => $schoolId, 'old_name' => $oldName],
                    );
                    Db::run(
                        'UPDATE assessments SET class_name = :new_name, updated_at = :now WHERE school_id = :school AND class_id = :class_id',
                        ['new_name' => $newName, 'now' => Clock::nowDb(), 'school' => $schoolId, 'class_id' => $classId],
                    );
                }
                $pdo->commit();
            } catch (\Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }
        return Serialize::class($this->findClass($classId, $schoolId));
    }

    public function deleteClass(string $schoolId, string $classId): void
    {
        $row = $this->findClass($classId, $schoolId);
        $students = (int) Db::value(
            'SELECT COUNT(*) FROM students WHERE school_id = :school AND current_class = :name',
            ['school' => $schoolId, 'name' => $row['class_name']],
        );
        if ($students > 0) {
            throw ApiError::conflict('Move or remove the students in this class before deleting it.', 'CLASS_HAS_STUDENTS');
        }
        Db::run('DELETE FROM classes WHERE id = :id', ['id' => $classId]);
    }

    public function listClasses(string $schoolId): array
    {
        $rows = Db::all('SELECT * FROM classes WHERE school_id = :school ORDER BY class_name ASC', ['school' => $schoolId]);
        return array_map(static fn(array $row): array => Serialize::class($row), $rows);
    }

    public function enrollStudent(string $schoolId, array $data): array
    {
        $school = $this->findSchool($schoolId);
        $className = trim($data['currentClass']);
        $this->assertClassExists($schoolId, $className);
        Password::assertStrong($data['password']);

        $prefix = $school['school_prefix'];
        $year = date('Y');
        $seq = Db::nextSequence($prefix . ':' . $year);
        $studentId = $prefix . '/' . $year . '/' . str_pad((string) $seq, 3, '0', STR_PAD_LEFT);

        $now = Clock::nowDb();
        $row = [
            'id' => Ids::newId(),
            'school_id' => $schoolId,
            'student_id' => $studentId,
            'full_name' => $data['fullName'],
            'gender' => $data['gender'],
            'dob' => $data['dob'],
            'current_class' => $className,
            'password_hash' => Password::hash($data['password']),
            'historical_results' => '[]',
            'guardian_name' => $data['guardianName'] ?? null,
            'guardian_phone' => $data['guardianPhone'] ?? null,
            'address' => $data['address'] ?? null,
            'created_at' => $now,
            'updated_at' => $now,
        ];
        Db::insert('students', $row);
        return Serialize::student($row);
    }

    public function listStudents(string $schoolId, array $query): array
    {
        [$page, $limit, $skip] = Pagination::resolve($query['page'] ?? 1, $query['limit'] ?? 20);
        $where = ['school_id = :school'];
        $params = ['school' => $schoolId];
        if (!empty($query['currentClass'])) {
            $where[] = 'current_class = :cls';
            $params['cls'] = $query['currentClass'];
        }
        if (!empty($query['q'])) {
            $where[] = '(full_name LIKE :like OR student_id LIKE :like)';
            $params['like'] = '%' . addcslashes((string) $query['q'], '%_\\') . '%';
        }
        $whereSql = implode(' AND ', $where);
        $total = (int) Db::value('SELECT COUNT(*) FROM students WHERE ' . $whereSql, $params);
        $rows = Db::all(
            'SELECT * FROM students WHERE ' . $whereSql . ' ORDER BY full_name ASC LIMIT :limit OFFSET :offset',
            $params + ['limit' => $limit, 'offset' => $skip],
        );
        return Pagination::paginate(array_map(static fn(array $row): array => Serialize::student($row), $rows), $total, $page, $limit);
    }

    public function updateStudent(string $schoolId, string $studentId, array $data): array
    {
        $row = $this->findStudent($studentId, $schoolId);
        $sets = [];
        $params = ['id' => $studentId, 'now' => Clock::nowDb()];
        $mapping = [
            'fullName' => 'full_name',
            'gender' => 'gender',
            'dob' => 'dob',
            'guardianName' => 'guardian_name',
            'guardianPhone' => 'guardian_phone',
            'address' => 'address',
        ];
        foreach ($mapping as $input => $column) {
            if (array_key_exists($input, $data)) {
                $sets[] = $column . ' = :' . $column;
                $params[$column] = $data[$input] === '' ? null : $data[$input];
            }
        }
        if (array_key_exists('currentClass', $data)) {
            $this->assertClassExists($schoolId, (string) $data['currentClass']);
            $sets[] = 'current_class = :current_class';
            $params['current_class'] = $data['currentClass'];
        }
        if ($sets !== []) {
            Db::run('UPDATE students SET ' . implode(', ', $sets) . ', updated_at = :now WHERE id = :id', $params);
        }
        return Serialize::student($this->findStudent($studentId, $schoolId));
    }

    public function deleteStudent(string $schoolId, string $studentId): void
    {
        $row = $this->findStudent($studentId, $schoolId);
        Db::run('DELETE FROM students WHERE id = :id', ['id' => $row['id']]);
    }

    public function resetStudentPassword(string $schoolId, string $studentId, array $data): array
    {
        $row = $this->findStudent($studentId, $schoolId);
        Password::assertStrong($data['password']);
        Db::run(
            'UPDATE students SET password_hash = :password, updated_at = :now WHERE id = :id',
            ['password' => Password::hash($data['password']), 'now' => Clock::nowDb(), 'id' => $row['id']],
        );
        return Serialize::student($this->findStudent($studentId, $schoolId));
    }

    public function listTeachers(string $schoolId, array $query): array
    {
        [$page, $limit, $skip] = Pagination::resolve($query['page'] ?? 1, $query['limit'] ?? 50);
        $total = (int) Db::value('SELECT COUNT(*) FROM teachers WHERE school_id = :school', ['school' => $schoolId]);
        $rows = Db::all(
            'SELECT * FROM teachers WHERE school_id = :school ORDER BY name ASC LIMIT :limit OFFSET :offset',
            ['school' => $schoolId, 'limit' => $limit, 'offset' => $skip],
        );
        return Pagination::paginate(array_map(static fn(array $row): array => Serialize::teacher($row), $rows), $total, $page, $limit);
    }

    public function updateTeacher(string $schoolId, string $teacherId, array $data): array
    {
        $row = $this->findTeacher($teacherId, $schoolId);
        $sets = [];
        $params = ['id' => $row['id'], 'now' => Clock::nowDb()];
        if (array_key_exists('name', $data)) {
            $sets[] = 'name = :name';
            $params['name'] = $data['name'];
        }
        if (array_key_exists('subject', $data)) {
            $sets[] = 'subject = :subject';
            $params['subject'] = $data['subject'] === '' ? null : $data['subject'];
        }
        if (array_key_exists('status', $data)) {
            $sets[] = 'status = :status';
            $params['status'] = $data['status'];
        }
        if ($sets !== []) {
            Db::run('UPDATE teachers SET ' . implode(', ', $sets) . ', updated_at = :now WHERE id = :id', $params);
        }
        return Serialize::teacher(Db::one('SELECT * FROM teachers WHERE id = :id', ['id' => $row['id']]) ?? $row);
    }

    public function removeTeacher(string $schoolId, string $teacherId): void
    {
        $row = $this->findTeacher($teacherId, $schoolId);
        Db::run('DELETE FROM teachers WHERE id = :id', ['id' => $row['id']]);
    }

    public function listAssessments(string $schoolId, array $query): array
    {
        [$page, $limit, $skip] = Pagination::resolve($query['page'] ?? 1, $query['limit'] ?? 50);
        $where = ['school_id = :school'];
        $params = ['school' => $schoolId];
        $status = $query['status'] ?? 'Pending Approval';
        if ($status !== 'all') {
            $where[] = 'status = :status';
            $params['status'] = $status;
        }
        $whereSql = implode(' AND ', $where);
        $total = (int) Db::value('SELECT COUNT(*) FROM assessments WHERE ' . $whereSql, $params);
        $rows = Db::all(
            'SELECT * FROM assessments WHERE ' . $whereSql . ' ORDER BY submitted_at DESC, created_at DESC LIMIT :limit OFFSET :offset',
            $params + ['limit' => $limit, 'offset' => $skip],
        );
        return Pagination::paginate(array_map(static fn(array $row): array => Serialize::assessment($row), $rows), $total, $page, $limit);
    }

    public function reviewAssessment(string $schoolId, array $data): array
    {
        $row = Db::one('SELECT * FROM assessments WHERE id = :id', ['id' => $data['assessmentId']]);
        if ($row === null) {
            throw ApiError::notFound('Assessment not found.', 'ASSESSMENT_NOT_FOUND');
        }
        if ($row['school_id'] !== $schoolId) {
            throw ApiError::forbidden('Resource does not belong to your school', 'IDOR_BLOCKED');
        }

        $now = Clock::nowDb();
        if ($data['action'] === 'approve') {
            Db::run(
                'UPDATE assessments SET status = \'Approved\', approved_at = :now, note = :note, updated_at = :now WHERE id = :id',
                ['now' => $now, 'note' => $data['note'] ?? '', 'id' => $row['id']],
            );
        } else {
            Db::run(
                'UPDATE assessments SET status = \'Revised\', approved_at = NULL, note = :note, updated_at = :now WHERE id = :id',
                ['note' => $data['note'] ?? 'Returned for revision.', 'now' => $now, 'id' => $row['id']],
            );
        }
        return Serialize::assessment(Db::one('SELECT * FROM assessments WHERE id = :id', ['id' => $row['id']]) ?? $row);
    }

    public function submitBankTransfer(string $schoolId, array $data): array
    {
        $this->findSchool($schoolId);
        $reference = trim($data['reference']);
        $now = Clock::nowDb();
        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            Db::run(
                'UPDATE schools SET pending_reference = :reference, pending_amount = :amount, pending_submitted_at = :now,
                 pending_status = \'pending\', updated_at = :now WHERE id = :id',
                ['reference' => $reference, 'amount' => $data['amount'], 'now' => $now, 'id' => $schoolId],
            );
            Db::insert('subscriptions_log', [
                'school_id' => $schoolId,
                'payment_proof_ref' => $reference,
                'amount' => (float) $data['amount'],
                'status' => 'pending',
                'note' => 'Bank transfer submitted by school admin.',
                'created_at' => $now,
                'verified_at' => null,
            ]);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
        return Serialize::school($this->findSchool($schoolId));
    }

    public function subscriptionLogs(string $schoolId): array
    {
        $this->findSchool($schoolId);
        $rows = Db::all(
            'SELECT * FROM subscriptions_log WHERE school_id = :school ORDER BY created_at DESC LIMIT 50',
            ['school' => $schoolId],
        );
        return array_map(static fn(array $row): array => Serialize::subscriptionLog($row), $rows);
    }

    private function normalizeSubjects(array $subjects): array
    {
        $clean = [];
        foreach ($subjects as $subject) {
            $subject = trim((string) $subject);
            if ($subject !== '' && !in_array($subject, $clean, true)) {
                $clean[] = $subject;
            }
        }
        if ($clean === []) {
            throw ApiError::badRequest('At least one subject is required to create a class.', 'NO_SUBJECTS');
        }
        return $clean;
    }

    private function validateTeacherEmail(string $schoolId, mixed $email): ?string
    {
        if ($email === null || trim((string) $email) === '') {
            return null;
        }
        $email = strtolower(trim((string) $email));
        $teacher = Db::one('SELECT id FROM teachers WHERE school_id = :school AND email = :email', ['school' => $schoolId, 'email' => $email]);
        if ($teacher === null) {
            throw ApiError::badRequest('The form teacher must be an existing teacher in this school.', 'TEACHER_NOT_FOUND');
        }
        return $email;
    }

    private function assertClassExists(string $schoolId, string $className): void
    {
        $class = Db::one(
            'SELECT id FROM classes WHERE school_id = :school AND class_name = :name',
            ['school' => $schoolId, 'name' => $className],
        );
        if ($class === null) {
            throw ApiError::badRequest('The selected class is not part of this school\'s curriculum.', 'CLASS_NOT_CONFIGURED');
        }
    }

    private function findSchool(string $schoolId): array
    {
        $row = Db::one('SELECT * FROM schools WHERE id = :id', ['id' => $schoolId]);
        if ($row === null) {
            throw ApiError::notFound('School not found.', 'SCHOOL_NOT_FOUND');
        }
        return $row;
    }

    private function findTeacher(string $teacherId, string $schoolId): array
    {
        $row = Db::one('SELECT * FROM teachers WHERE id = :id', ['id' => $teacherId]);
        if ($row === null) {
            throw ApiError::notFound('Teacher not found.', 'TEACHER_NOT_FOUND');
        }
        if ($row['school_id'] !== $schoolId) {
            throw ApiError::forbidden('Resource does not belong to your school', 'IDOR_BLOCKED');
        }
        return $row;
    }

    private function findClass(string $classId, string $schoolId): array
    {
        $row = Db::one('SELECT * FROM classes WHERE id = :id', ['id' => $classId]);
        if ($row === null) {
            throw ApiError::notFound('Class not found.', 'CLASS_NOT_FOUND');
        }
        if ($row['school_id'] !== $schoolId) {
            throw ApiError::forbidden('Resource does not belong to your school', 'IDOR_BLOCKED');
        }
        return $row;
    }

    private function findStudent(string $studentId, string $schoolId): array
    {
        $row = Db::one('SELECT * FROM students WHERE id = :id', ['id' => $studentId]);
        if ($row === null) {
            throw ApiError::notFound('Student not found.', 'STUDENT_NOT_FOUND');
        }
        if ($row['school_id'] !== $schoolId) {
            throw ApiError::forbidden('Resource does not belong to your school', 'IDOR_BLOCKED');
        }
        return $row;
    }
}

