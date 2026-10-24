<?php

declare(strict_types=1);

namespace Syntax\Services;

use Syntax\Db;
use Syntax\Http\ApiError;
use Syntax\Support\Clock;
use Syntax\Support\Grading;
use Syntax\Support\Ids;
use Syntax\Support\Serialize;

final class TeacherService
{
    public function classesSubjects(string $schoolId): array
    {
        $rows = Db::all('SELECT * FROM classes WHERE school_id = :school ORDER BY class_name ASC', ['school' => $schoolId]);
        return array_map(fn(array $row) => Serialize::class($row), $rows);
    }

    public function getRoster(string $schoolId, string $classId): array
    {
        $class = $this->findClass($classId, $schoolId);
        $rows = Db::all(
            'SELECT * FROM students WHERE school_id = :school AND current_class = :cls ORDER BY full_name ASC',
            ['school' => $schoolId, 'cls' => $class['class_name']],
        );
        return array_map(fn(array $row) => Serialize::student($row), $rows);
    }

    public function getBroadsheet(string $schoolId, array $key): array
    {
        $this->resolveClassSubject($schoolId, $key['classId'], $key['subject']);
        $rows = Db::all(
            'SELECT * FROM assessments
             WHERE school_id = :school AND class_id = :classId AND subject = :subject AND term = :term AND session = :session
             ORDER BY student_id ASC',
            [
                'school' => $schoolId,
                'classId' => $key['classId'],
                'subject' => $key['subject'],
                'term' => $key['term'],
                'session' => $key['session'],
            ],
        );
        return array_map(fn(array $row) => Serialize::assessment($row), $rows);
    }

    /** @return array{saved: int} */
    public function saveBroadsheet(array $teacher, string $schoolId, array $input): array
    {
        [$class, $canonicalSubject] = $this->resolveClassSubject($schoolId, $input['classId'], $input['subject']);

        $entries = $input['entries'] ?? [];
        if ($entries === []) {
            throw ApiError::badRequest('No score entries were provided.', 'NO_ENTRIES');
        }

        $students = Db::all('SELECT * FROM students WHERE school_id = :school AND current_class = :cls', [
            'school' => $schoolId,
            'cls' => $class['class_name'],
        ]);
        $byStudentId = [];
        foreach ($students as $student) {
            $byStudentId[strtoupper($student['student_id'])] = $student;
        }

        $now = Clock::nowIso();
        $saved = 0;
        foreach ($entries as $entry) {
            $student = $byStudentId[strtoupper(trim($entry['studentId']))] ?? null;
            if ($student === null) {
                continue; // Unknown student IDs are silently skipped (original behaviour).
            }
            $ca1 = Grading::clamp($entry['ca1'], 20);
            $ca2 = Grading::clamp($entry['ca2'], 20);
            $exam = Grading::clamp($entry['exam'], 60);
            $total = Grading::computeTotal($ca1, $ca2, $exam);
            $grade = Grading::gradeFor($total);

            Db::run(
                'INSERT INTO assessments
                    (id, school_id, class_id, class_name, subject, teacher_id, teacher_email, student_ref, student_id,
                     ca1, ca2, exam, total, grade, status, principal_name, term, session, submitted_at, approved_at, note, created_at, updated_at)
                 VALUES
                    (:id, :schoolId, :classId, :className, :subject, :teacherId, :teacherEmail, :studentRef, :studentId,
                     :ca1, :ca2, :exam, :total, :grade, \'Pending Approval\', \'\', :term, :session, NULL, NULL, \'\', :now, :now)
                 ON CONFLICT (school_id, class_id, subject, student_ref, term, session) DO UPDATE SET
                    class_name = excluded.class_name,
                    teacher_id = excluded.teacher_id,
                    teacher_email = excluded.teacher_email,
                    student_id = excluded.student_id,
                    ca1 = excluded.ca1,
                    ca2 = excluded.ca2,
                    exam = excluded.exam,
                    total = excluded.total,
                    grade = excluded.grade,
                    status = \'Pending Approval\',
                    approved_at = NULL,
                    updated_at = excluded.updated_at',
                [
                    'id' => Ids::newId(),
                    'schoolId' => $schoolId,
                    'classId' => $class['id'],
                    'className' => $class['class_name'],
                    'subject' => $canonicalSubject,
                    'teacherId' => $teacher['id'],
                    'teacherEmail' => $teacher['email'],
                    'studentRef' => $student['id'],
                    'studentId' => $student['student_id'],
                    'ca1' => $ca1,
                    'ca2' => $ca2,
                    'exam' => $exam,
                    'total' => $total,
                    'grade' => $grade,
                    'term' => $input['term'],
                    'session' => $input['session'],
                    'now' => $now,
                ],
            );
            $saved++;
        }

        return ['saved' => $saved];
    }

    /** @return array{submitted: int, principalName: string} */
    public function submitBroadsheet(array $teacher, string $schoolId, array $input): array
    {
        [$class, $canonicalSubject] = $this->resolveClassSubject($schoolId, $input['classId'], $input['subject']);

        $school = Db::one('SELECT principal_name FROM schools WHERE id = :id', ['id' => $schoolId]);
        $principal = trim($input['principalName'] ?? '');
        if ($principal === '') {
            $principal = (string) ($school['principal_name'] ?? '');
        }

        $filter = [
            'school' => $schoolId,
            'classId' => $class['id'],
            'subject' => $canonicalSubject,
            'teacherId' => $teacher['id'],
            'term' => $input['term'],
            'session' => $input['session'],
        ];
        $submitted = (int) Db::value(
            'SELECT COUNT(*) FROM assessments
             WHERE school_id = :school AND class_id = :classId AND subject = :subject
               AND teacher_id = :teacherId AND term = :term AND session = :session',
            $filter,
        );
        if ($submitted === 0) {
            throw ApiError::badRequest('There are no saved scores to submit for this class and subject.', 'NOTHING_TO_SUBMIT');
        }

        Db::run(
            'UPDATE assessments
             SET status = \'Pending Approval\', submitted_at = :now, principal_name = :principal, approved_at = NULL, updated_at = :now
             WHERE school_id = :school AND class_id = :classId AND subject = :subject
               AND teacher_id = :teacherId AND term = :term AND session = :session',
            $filter + ['now' => Clock::nowIso(), 'principal' => $principal],
        );

        return ['submitted' => $submitted, 'principalName' => $principal];
    }

    /** @return array{0: array, 1: string} class row and canonical subject name */
    private function resolveClassSubject(string $schoolId, string $classId, string $subject): array
    {
        $class = $this->findClass($classId, $schoolId);
        foreach (Serialize::decodeList($class['subjects']) as $candidate) {
            if (strcasecmp((string) $candidate, $subject) === 0) {
                return [$class, (string) $candidate];
            }
        }
        throw ApiError::badRequest('The selected subject is not part of this class\'s curriculum.', 'SUBJECT_NOT_IN_CURRICULUM');
    }

    private function findClass(string $classId, string $schoolId): array
    {
        $row = Db::one('SELECT * FROM classes WHERE id = :id', ['id' => $classId]);
        if ($row === null) {
            throw ApiError::notFound('Class not found.', 'CLASS_NOT_FOUND');
        }
        if ($row['school_id'] !== $schoolId) {
            throw ApiError::forbidden('This class does not belong to your school.', 'IDOR_BLOCKED');
        }
        return $row;
    }
}
