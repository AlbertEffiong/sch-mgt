<?php

declare(strict_types=1);

namespace Syntax\Services;

use Syntax\Db;
use Syntax\Http\ApiError;
use Syntax\Support\Clock;
use Syntax\Support\Grading;
use Syntax\Support\Serialize;

final class StudentService
{
    public function getResults(string $schoolId, string $studentRef, array $query): array
    {
        $student = Db::one('SELECT * FROM students WHERE id = :id', ['id' => $studentRef]);
        if ($student === null) {
            throw ApiError::notFound('Student not found.', 'STUDENT_NOT_FOUND');
        }
        if ($student['school_id'] !== $schoolId) {
            throw ApiError::forbidden('Cross-tenant access is not permitted.', 'IDOR_BLOCKED');
        }

        $school = Db::one('SELECT * FROM schools WHERE id = :id', ['id' => $schoolId]) ?? [];

        $term = isset($query['term']) ? trim((string) $query['term']) : null;
        $session = isset($query['session']) ? trim((string) $query['session']) : null;

        $latest = null;
        if ($term === null || $session === null) {
            $latest = Db::one(
                'SELECT * FROM assessments
                 WHERE school_id = :school AND student_ref = :student AND status = \'Approved\'
                 ORDER BY approved_at DESC, created_at DESC LIMIT 1',
                ['school' => $schoolId, 'student' => $studentRef],
            );
        }

        $term = $term
            ?: (($latest['term'] ?? null)
                ?: (($school['current_term'] ?? null)
                    ?: 'First Term'));
        $session = $session
            ?: (($latest['session'] ?? null)
                ?: (($school['current_session'] ?? null)
                    ?: Clock::defaultSession()));

        $assessments = Db::all(
            'SELECT * FROM assessments
             WHERE school_id = :school AND student_ref = :student AND term = :term AND session = :session AND status = \'Approved\'
             ORDER BY subject ASC',
            ['school' => $schoolId, 'student' => $studentRef, 'term' => $term, 'session' => $session],
        );

        if ($assessments === []) {
            return $this->buildFromHistory($student, $term, $session, $school);
        }

        $teacherNames = $this->teacherNames($schoolId, array_values(array_unique(array_column($assessments, 'teacher_email'))));

        $subjects = [];
        $total = 0.0;
        foreach ($assessments as $assessment) {
            $subjectTotal = (float) $assessment['total'];
            $total += $subjectTotal;
            $subjects[] = [
                'subject' => $assessment['subject'],
                'ca1' => (float) $assessment['ca1'],
                'ca2' => (float) $assessment['ca2'],
                'exam' => (float) $assessment['exam'],
                'total' => $subjectTotal,
                'grade' => $assessment['grade'] !== '' ? $assessment['grade'] : Grading::gradeFor($subjectTotal),
                'remark' => Grading::remarkFor($subjectTotal),
                'teacherName' => $teacherNames[strtolower($assessment['teacher_email'])] ?? $assessment['teacher_email'],
            ];
        }
        usort($subjects, fn($a, $b) => strcmp($a['subject'], $b['subject']));

        $count = count($subjects);
        $average = $count > 0 ? round($total / $count * 10) / 10 : 0;

        [$position, $classSize] = $this->rank($schoolId, $student, $term, $session);

        $principal = ($school['principal_name'] ?? '') !== ''
            ? $school['principal_name']
            : (($assessments[0]['principal_name'] ?? '') ?: '');
        $classTeacher = '';
        foreach ($subjects as $subject) {
            if (($subject['teacherName'] ?? '') !== '') {
                $classTeacher = $subject['teacherName'];
                break;
            }
        }

        return [
            'schoolId' => $schoolId,
            'school' => [
                'name' => $school['name'] ?? '',
                'uniqueSchoolPrefix' => $school['unique_school_prefix'] ?? '',
                'principalName' => $school['principal_name'] ?? '',
            ],
            'student' => [
                'id' => $student['id'],
                'studentId' => $student['student_id'],
                'fullName' => $student['full_name'],
                'gender' => $student['gender'],
                'currentClass' => $student['current_class'],
            ],
            'term' => $term,
            'session' => $session,
            'subjects' => $subjects,
            'total' => $total,
            'average' => $average,
            'position' => $position,
            'classSize' => $classSize,
            'principalName' => $principal,
            'classTeacherName' => $classTeacher,
            'published' => true,
        ];
    }

    private function buildFromHistory(array $student, string $term, string $session, array $school): array
    {
        $history = Serialize::decodeList($student['historical_results'] ?? '[]');
        $record = null;
        foreach ($history as $entry) {
            if (($entry['term'] ?? null) === $term && ($entry['session'] ?? null) === $session) {
                $record = $entry;
                break;
            }
        }
        if ($record === null && $history !== []) {
            $record = $history[count($history) - 1];
        }
        if ($record === null) {
            throw ApiError::notFound('No published results are available for this student yet.', 'NO_RESULTS');
        }

        $subjects = [];
        $total = (float) ($record['total'] ?? 0);
        foreach (($record['subjects'] ?? []) as $subject) {
            $subjectTotal = (float) ($subject['total'] ?? 0);
            $subjects[] = [
                'subject' => $subject['subject'] ?? '',
                'ca1' => (float) ($subject['ca1'] ?? 0),
                'ca2' => (float) ($subject['ca2'] ?? 0),
                'exam' => (float) ($subject['exam'] ?? 0),
                'total' => $subjectTotal,
                'grade' => ($subject['grade'] ?? '') !== '' ? $subject['grade'] : Grading::gradeFor($subjectTotal),
                'remark' => Grading::remarkFor($subjectTotal),
                'teacherName' => '',
            ];
        }
        usort($subjects, fn($a, $b) => strcmp($a['subject'], $b['subject']));
        if ($total === 0.0 && $subjects !== []) {
            $total = array_sum(array_column($subjects, 'total'));
        }
        $average = (float) ($record['average'] ?? 0);
        if ($average === 0.0 && $subjects !== []) {
            $average = round($total / count($subjects) * 10) / 10;
        }

        return [
            'schoolId' => $student['school_id'],
            'school' => [
                'name' => $school['name'] ?? '',
                'uniqueSchoolPrefix' => $school['unique_school_prefix'] ?? '',
                'principalName' => $school['principal_name'] ?? '',
            ],
            'student' => [
                'id' => $student['id'],
                'studentId' => $student['student_id'],
                'fullName' => $student['full_name'],
                'gender' => $student['gender'],
                'currentClass' => $student['current_class'],
            ],
            'term' => $record['term'] ?? $term,
            'session' => $record['session'] ?? $session,
            'subjects' => $subjects,
            'total' => $total,
            'average' => $average,
            'position' => (int) ($record['position'] ?? 0),
            'classSize' => (int) ($record['classSize'] ?? 0),
            'principalName' => ($record['principalName'] ?? '') ?: (($school['principal_name'] ?? '') ?: ''),
            'classTeacherName' => (string) ($record['classTeacherName'] ?? ''),
            'attendance' => $record['attendance'] ?? null,
            'remark' => (string) ($record['remark'] ?? ''),
            'published' => true,
        ];
    }

    /** @return array{0: int, 1: int} [position, classSize] */
    private function rank(string $schoolId, array $student, string $term, string $session): array
    {
        $totals = Db::all(
            'SELECT student_id, SUM(total) AS sum_total
             FROM assessments
             WHERE school_id = :school AND class_name = :cls AND term = :term AND session = :session AND status = \'Approved\'
             GROUP BY student_id
             ORDER BY sum_total DESC, student_id ASC',
            ['school' => $schoolId, 'cls' => $student['current_class'], 'term' => $term, 'session' => $session],
        );
        $classSize = count($totals);
        foreach ($totals as $index => $row) {
            if ($row['student_id'] === $student['student_id']) {
                return [$index + 1, $classSize];
            }
        }
        return [0, $classSize];
    }

    /** @return array<string, string> lowercase email => teacher name */
    private function teacherNames(string $schoolId, array $emails): array
    {
        if ($emails === []) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($emails), '?'));
        $stmt = Db::run(
            "SELECT email, name FROM teachers WHERE school_id = ? AND email IN ($placeholders)",
            array_merge([$schoolId], $emails),
        );
        $map = [];
        foreach ($stmt->fetchAll() as $row) {
            $map[strtolower($row['email'])] = $row['name'];
        }
        return $map;
    }
}
