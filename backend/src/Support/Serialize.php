<?php

declare(strict_types=1);

namespace Syntax\Support;

/** Whitelist serializers: raw rows are never spread into responses. */
final class Serialize
{
    public static function school(array $row): array
    {
        $pending = null;
        if (($row['pending_reference'] ?? null) !== null && $row['pending_reference'] !== '') {
            $pending = [
                'reference' => $row['pending_reference'],
                'amount' => (float) $row['pending_amount'],
                'submittedAt' => $row['pending_submitted_at'],
                'status' => $row['pending_status'],
            ];
        }
        return [
            'id' => $row['id'],
            'name' => $row['name'],
            'email' => $row['email'],
            'subscriptionStatus' => $row['subscription_status'],
            'subscriptionExpiresAt' => $row['subscription_expires_at'],
            'uniqueSchoolPrefix' => $row['unique_school_prefix'],
            'principalName' => $row['principal_name'] ?? '',
            'planMonthly' => (float) $row['plan_monthly'],
            'academic' => [
                'currentSession' => $row['current_session'] ?? '',
                'currentTerm' => $row['current_term'] ?? '',
                'termsPerSession' => (int) ($row['terms_per_session'] ?? 3),
            ],
            'hasPendingPayment' => $pending !== null,
            'pendingPayment' => $pending,
            'createdAt' => $row['created_at'],
        ];
    }

    public static function teacher(array $row): array
    {
        $out = [
            'id' => $row['id'],
            'schoolId' => $row['school_id'],
            'name' => $row['name'],
            'email' => $row['email'],
            'subject' => $row['subject'] ?? null,
            'verified' => (bool) $row['verified'],
        ];
        return $out;
    }

    public static function student(array $row): array
    {
        return [
            'id' => $row['id'],
            'studentId' => $row['student_id'],
            'fullName' => $row['full_name'],
            'gender' => $row['gender'],
            'dob' => $row['dob'],
            'currentClass' => $row['current_class'],
        ];
    }

    public static function class(array $row): array
    {
        $out = [
            'id' => $row['id'],
            'className' => $row['class_name'],
            'subjects' => self::decodeList($row['subjects'] ?? '[]'),
        ];
        if (($row['teacher_email'] ?? null) !== null && $row['teacher_email'] !== '') {
            $out['teacherEmail'] = $row['teacher_email'];
        }
        return $out;
    }

    public static function assessment(array $row): array
    {
        $out = [
            'id' => $row['id'],
            'classId' => $row['class_id'],
            'className' => $row['class_name'],
            'subject' => $row['subject'],
            'teacherEmail' => $row['teacher_email'],
            'studentId' => $row['student_id'],
            'ca1' => (float) $row['ca1'],
            'ca2' => (float) $row['ca2'],
            'exam' => (float) $row['exam'],
            'total' => (float) $row['total'],
            'grade' => $row['grade'],
            'status' => $row['status'],
            'principalName' => $row['principal_name'] ?? '',
            'term' => $row['term'],
            'session' => $row['session'],
            'submittedAt' => $row['submitted_at'] ?? null,
            'approvedAt' => $row['approved_at'] ?? null,
            'note' => $row['note'] ?? null,
        ];
        return $out;
    }

    public static function owner(array $row): array
    {
        return [
            'id' => $row['id'],
            'name' => $row['name'],
            'email' => $row['email'],
        ];
    }

    /** @return array<int, mixed> */
    public static function decodeList(?string $json): array
    {
        if ($json === null || $json === '') {
            return [];
        }
        $decoded = json_decode($json, true);
        return is_array($decoded) ? $decoded : [];
    }
}
