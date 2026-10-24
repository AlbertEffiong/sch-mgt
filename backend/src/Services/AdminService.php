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
        $params = ['id' => $schoolId, 'now' => Clock::nowIso()];
        if (array_key_exists('current_session', $data)) {
            $sets[] = 'current_session = :current_session';
            $params['current_session'] = $data['current_session'];
        }
        if (array_key_exists('current_term', $data)) {
            $sets[] = 'current_term = :current_term';
            $params['current_term'] = $data['current_term'];
        }
        if (array_key_exists('terms_per_session', $data)) {
            $sets[] = 'terms_per_session = :terms_per_session';
            $params['terms_per_session'] = $data['terms_per_session'];
        }
        if ($sets !== []) {
            Db::run('UPDATE schools SET ' . implode(', ', $sets) . ', updated_at = :now WHERE id = :id', $params);
        }
        return Serialize::school($this->findSchool($schoolId));
    }

    public function createClass(string $schoolId, array $data): array
    {
        $subjects = [];
        foreach ($data['subjects'] as $subject) {
            $subject = trim((string) $subject);
            if ($subject !== '' && !in_array($subject, $subjects, true)) {
                $subjects[] = $subject;
            }
        }
        if ($subjects === []) {
            throw ApiError::badRequest('At least one subject is required to create a class.', 'NO_SUBJECTS');
        }
        $className = trim($data['className']);
        if (Db::one('SELECT id FROM classes WHERE school_id = :school AND class_name = :name', ['school' => $schoolId, 'name' => $className]) !== null) {
            throw ApiError::conflict('A class with this name already exists.', 'CLASS_EXISTS');
        }

        $now = Clock::nowIso();
        $row = [
            'id' => Ids::newId(),
            'school_id' => $schoolId,
            'class_name' => $className,
            'subjects' => json_encode(array_values($subjects), JSON_UNESCAPED_UNICODE),
            'teacher_email' => isset($data['teacherEmail']) ? strtolower($data['teacherEmail']) : null,
            'created_at' => $now,
            'updated_at' => $now,
        ];
        Db::insert('classes', $row);
        return Serialize::class($row);
    }

    public function listClasses(string $schoolId): array
    {
        $rows = Db::all('SELECT * FROM classes WHERE school_id = :school ORDER BY class_name ASC', ['school' => $schoolId]);
        return array_map(Serialize::class(...), $rows);
    }

    public function enrollStudent(string $schoolId, array $data): array
    {
        $school = $this->findSchool($schoolId);
        $className = trim($data['currentClass']);
        $class = Db::one(
            'SELECT id FROM classes WHERE school_id = :school AND class_name = :name',
            ['school' => $schoolId, 'name' => $className],
        );
        if ($class === null) {
            throw ApiError::badRequest('The selected class is not part of this school\'s curriculum.', 'CLASS_NOT_CONFIGURED');
        }

        $prefix = $school['unique_school_prefix'];
        $year = date('Y');
        $seq = Db::nextSequence($prefix . ':' . $year);
        $studentId = $prefix . '/' . $year . '/' . str_pad((string) $seq, 3, '0', STR_PAD_LEFT);

        $now = Clock::nowIso();
        $row = [
            'id' => Ids::newId(),
            'school_id' => $schoolId,
            'student_id' => $studentId,
            'full_name' => $data['fullName'],
            'gender' => $data['gender'],
            'dob' => $data['dob'],
            'current_class' => $className,
            'password' => Password::hash($data['password']),
            'historical_results' => '[]',
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
        $whereSql = implode(' AND ', $where);
        $total = (int) Db::value('SELECT COUNT(*) FROM students WHERE ' . $whereSql, $params);
        $rows = Db::all(
            'SELECT * FROM students WHERE ' . $whereSql . ' ORDER BY full_name ASC LIMIT :limit OFFSET :offset',
            $params + ['limit' => $limit, 'offset' => $skip],
        );
        return Pagination::paginate(array_map(Serialize::student(...), $rows), $total, $page, $limit);
    }

    public function listTeachers(string $schoolId, array $query): array
    {
        [$page, $limit, $skip] = Pagination::resolve($query['page'] ?? 1, $query['limit'] ?? 20);
        $total = (int) Db::value('SELECT COUNT(*) FROM teachers WHERE school_id = :school', ['school' => $schoolId]);
        $rows = Db::all(
            'SELECT * FROM teachers WHERE school_id = :school ORDER BY name ASC LIMIT :limit OFFSET :offset',
            ['school' => $schoolId, 'limit' => $limit, 'offset' => $skip],
        );
        return Pagination::paginate(array_map(Serialize::teacher(...), $rows), $total, $page, $limit);
    }

    public function updateTeacher(string $schoolId, string $teacherId, array $data): array
    {
        $row = $this->findTeacher($teacherId, $schoolId);
        $sets = [];
        $params = ['id' => $row['id'], 'now' => Clock::nowIso()];
        if (array_key_exists('name', $data)) {
            $sets[] = 'name = :name';
            $params['name'] = $data['name'];
        }
        if (array_key_exists('subject', $data)) {
            $sets[] = 'subject = :subject';
            $params['subject'] = $data['subject'];
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
        [$page, $limit, $skip] = Pagination::resolve($query['page'] ?? 1, $query['limit'] ?? 20);
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
        return Pagination::paginate(array_map(Serialize::assessment(...), $rows), $total, $page, $limit);
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

        $now = Clock::nowIso();
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
        Db::run(
            'UPDATE schools SET pending_reference = :reference, pending_amount = :amount, pending_submitted_at = :now,
             pending_status = \'pending\', updated_at = :now WHERE id = :id',
            ['reference' => trim($data['reference']), 'amount' => $data['amount'], 'now' => Clock::nowIso(), 'id' => $schoolId],
        );
        return Serialize::school($this->findSchool($schoolId));
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
}
