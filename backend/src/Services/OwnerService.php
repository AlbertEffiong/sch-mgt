<?php

declare(strict_types=1);

namespace Syntax\Services;

use Syntax\Db;
use Syntax\Http\ApiError;
use Syntax\Support\Clock;
use Syntax\Support\Pagination;
use Syntax\Support\Serialize;

final class OwnerService
{
    /** @return array{mrr: float, totalSchools: int, activeSchools: int, expiredSchools: int, totalStudents: int, activeSubscriptions: int} */
    public function dashboard(): array
    {
        $schools = Db::all('SELECT subscription_status, subscription_expires_at, plan_monthly FROM schools');
        $now = Clock::nowIso();
        $mrr = 0.0;
        $active = 0;
        $expired = 0;
        foreach ($schools as $school) {
            if ($this->isActive($school, $now)) {
                $active++;
                $mrr += (float) ($school['plan_monthly'] ?? 0);
            } else {
                $expired++;
            }
        }
        $totalStudents = (int) Db::value('SELECT COUNT(*) FROM students');
        return [
            'mrr' => $mrr,
            'totalSchools' => count($schools),
            'activeSchools' => $active,
            'expiredSchools' => $expired,
            'totalStudents' => $totalStudents,
            'activeSubscriptions' => $active,
        ];
    }

    public function listSchools(array $query): array
    {
        [$page, $limit, $skip] = Pagination::resolve($query['page'] ?? 1, $query['limit'] ?? 20);
        $now = Clock::nowIso();
        $where = [];
        $params = [];

        $status = $query['status'] ?? null;
        if ($status === 'Active') {
            $where[] = "(s.subscription_status = 'Active' AND s.subscription_expires_at > :now)";
            $params['now'] = $now;
        } elseif ($status === 'Expired') {
            $where[] = "(s.subscription_status = 'Expired' OR s.subscription_expires_at <= :now OR s.subscription_expires_at IS NULL)";
            $params['now'] = $now;
        }

        $search = $query['q'] ?? null;
        if ($search !== null && $search !== '') {
            $pattern = '%' . addcslashes($search, '%_\\') . '%';
            $where[] = '(s.name LIKE :like ESCAPE \'\\\' OR s.email LIKE :like ESCAPE \'\\\' OR s.unique_school_prefix LIKE :like ESCAPE \'\\\')';
            $params['like'] = $pattern;
        }

        $whereSql = $where === [] ? '1 = 1' : implode(' AND ', $where);
        $total = (int) Db::value('SELECT COUNT(*) FROM schools s WHERE ' . $whereSql, $params);
        $rows = Db::all(
            'SELECT s.*, (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id) AS student_count
             FROM schools s WHERE ' . $whereSql . ' ORDER BY s.created_at DESC LIMIT :limit OFFSET :offset',
            $params + ['limit' => $limit, 'offset' => $skip],
        );

        $items = [];
        foreach ($rows as $row) {
            $item = Serialize::school($row);
            $item['isActive'] = $this->isActive($row, $now);
            $item['studentCount'] = (int) $row['student_count'];
            $items[] = $item;
        }
        return Pagination::paginate($items, $total, $page, $limit);
    }

    public function setSchoolStatus(string $schoolId, string $status): array
    {
        $row = $this->find($schoolId);
        $now = Clock::now();
        $expires = $row['subscription_expires_at'];
        if ($status === 'Active' && ($expires === null || Clock::parse($expires) === null || Clock::parse($expires) <= $now)) {
            $expires = Clock::iso(Clock::plusDays(30, $now));
        }
        Db::run(
            'UPDATE schools SET subscription_status = :status, subscription_expires_at = :expires, updated_at = :now WHERE id = :id',
            ['status' => $status, 'expires' => $expires, 'now' => Clock::nowIso($now), 'id' => $schoolId],
        );
        return Serialize::school($this->find($schoolId));
    }

    public function verifyPayment(array $data): array
    {
        $schoolId = $data['schoolId'];
        $row = $this->find($schoolId);

        if (($row['pending_reference'] ?? null) === null || $row['pending_reference'] === '') {
            throw ApiError::badRequest('No pending bank transfer found for this school.', 'NO_PENDING_PAYMENT');
        }
        $reference = trim($data['reference']);
        if ($reference !== '' && $row['pending_reference'] !== '' && $reference !== $row['pending_reference']) {
            throw ApiError::badRequest('The supplied payment reference does not match the pending submission.', 'REFERENCE_MISMATCH');
        }

        $now = Clock::now();
        $current = Clock::parse((string) $row['subscription_expires_at']);
        $base = ($current !== null && $current > $now) ? $current : $now;
        Db::run(
            'UPDATE schools
             SET subscription_status = \'Active\', subscription_expires_at = :expires,
                 pending_reference = NULL, pending_amount = NULL, pending_submitted_at = NULL, pending_status = NULL,
                 updated_at = :now
             WHERE id = :id',
            ['expires' => Clock::iso(Clock::plusDays(30, $base)), 'now' => Clock::nowIso($now), 'id' => $schoolId],
        );
        return Serialize::school($this->find($schoolId));
    }

    private function find(string $schoolId): array
    {
        $row = Db::one('SELECT * FROM schools WHERE id = :id', ['id' => $schoolId]);
        if ($row === null) {
            throw ApiError::notFound('School not found.', 'SCHOOL_NOT_FOUND');
        }
        return $row;
    }

    private function isActive(array $school, string $now): bool
    {
        return ($school['subscription_status'] ?? '') === 'Active'
            && !empty($school['subscription_expires_at'])
            && $school['subscription_expires_at'] > $now;
    }
}
