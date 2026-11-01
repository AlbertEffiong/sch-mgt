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
    /** @return array{mrr: float, totalSchools: int, activeSchools: int, expiredSchools: int, totalStudents: int, activeSubscriptions: int, pendingPayments: int} */
    public function dashboard(): array
    {
        $schools = Db::all('SELECT subscription_status, subscription_expires_at, plan_monthly, pending_reference FROM schools');
        $now = Clock::nowDb();
        $mrr = 0.0;
        $active = 0;
        $expired = 0;
        $pending = 0;
        foreach ($schools as $school) {
            if ($this->isActive($school, $now)) {
                $active++;
                $mrr += (float) ($school['plan_monthly'] ?? 0);
            } else {
                $expired++;
            }
            if (($school['pending_reference'] ?? null) !== null && $school['pending_reference'] !== '') {
                $pending++;
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
            'pendingPayments' => $pending,
        ];
    }

    public function listSchools(array $query): array
    {
        [$page, $limit, $skip] = Pagination::resolve($query['page'] ?? 1, $query['limit'] ?? 20);
        $now = Clock::nowDb();
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
            $where[] = '(s.name LIKE :like OR s.email LIKE :like OR s.school_prefix LIKE :like)';
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
        if ($status === 'Active' && !Clock::isFuture($expires, Clock::db($now))) {
            $expires = Clock::db(Clock::plusDays(30, $now));
        }
        Db::run(
            'UPDATE schools SET subscription_status = :status, subscription_expires_at = :expires, updated_at = :now WHERE id = :id',
            ['status' => $status, 'expires' => $expires, 'now' => Clock::db($now), 'id' => $schoolId],
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
        $reference = trim((string) ($data['reference'] ?? ''));
        if ($reference !== '' && $reference !== $row['pending_reference']) {
            throw ApiError::badRequest('The supplied payment reference does not match the pending submission.', 'REFERENCE_MISMATCH');
        }

        $now = Clock::now();
        $current = Clock::parse((string) $row['subscription_expires_at']);
        $base = ($current !== null && $current > $now) ? $current : $now;
        $expires = Clock::db(Clock::plusDays(30, $base));

        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            Db::run(
                'UPDATE schools
                 SET subscription_status = \'Active\', subscription_expires_at = :expires,
                     pending_reference = NULL, pending_amount = NULL, pending_submitted_at = NULL, pending_status = NULL,
                     updated_at = :now
                 WHERE id = :id',
                ['expires' => $expires, 'now' => Clock::db($now), 'id' => $schoolId],
            );
            Db::insert('subscriptions_log', [
                'school_id' => $schoolId,
                'payment_proof_ref' => $row['pending_reference'],
                'amount' => (float) ($row['pending_amount'] ?? 0),
                'status' => 'verified',
                'note' => 'Payment verified by SaaS owner.',
                'created_at' => Clock::db($now),
                'verified_at' => Clock::db($now),
            ]);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
        return Serialize::school($this->find($schoolId));
    }

    public function rejectPayment(array $data): array
    {
        $schoolId = $data['schoolId'];
        $row = $this->find($schoolId);
        if (($row['pending_reference'] ?? null) === null || $row['pending_reference'] === '') {
            throw ApiError::badRequest('No pending bank transfer found for this school.', 'NO_PENDING_PAYMENT');
        }
        $now = Clock::nowDb();
        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            Db::run(
                'UPDATE schools SET pending_reference = NULL, pending_amount = NULL, pending_submitted_at = NULL,
                 pending_status = NULL, updated_at = :now WHERE id = :id',
                ['now' => $now, 'id' => $schoolId],
            );
            Db::insert('subscriptions_log', [
                'school_id' => $schoolId,
                'payment_proof_ref' => $row['pending_reference'],
                'amount' => (float) ($row['pending_amount'] ?? 0),
                'status' => 'rejected',
                'note' => trim((string) ($data['note'] ?? 'Payment could not be verified.')),
                'created_at' => $now,
                'verified_at' => $now,
            ]);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
        return Serialize::school($this->find($schoolId));
    }

    public function paymentHistory(array $query): array
    {
        [$page, $limit, $skip] = Pagination::resolve($query['page'] ?? 1, $query['limit'] ?? 20);
        $total = (int) Db::value('SELECT COUNT(*) FROM subscriptions_log');
        $rows = Db::all(
            'SELECT l.*, s.name AS school_name FROM subscriptions_log l
             JOIN schools s ON s.id = l.school_id
             ORDER BY l.created_at DESC LIMIT :limit OFFSET :offset',
            ['limit' => $limit, 'offset' => $skip],
        );
        $items = array_map(static function (array $row): array {
            $item = Serialize::subscriptionLog($row);
            $item['schoolName'] = $row['school_name'];
            return $item;
        }, $rows);
        return Pagination::paginate($items, $total, $page, $limit);
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
            && Clock::isFuture($school['subscription_expires_at'] ?? null, $now);
    }
}
