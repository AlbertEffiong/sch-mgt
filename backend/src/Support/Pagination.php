<?php

declare(strict_types=1);

namespace Syntax\Support;

final class Pagination
{
    public static function resolve(mixed $page = 1, mixed $limit = 20): array
    {
        $limit = (int) $limit;
        $page = (int) $page;
        $limit = min(max($limit, 1), 100);
        $page = max($page, 1);
        return ['page' => $page, 'limit' => $limit, 'skip' => ($page - 1) * $limit];
    }

    public static function paginate(array $items, int $total, int $page, int $limit): array
    {
        $totalPages = max((int) ceil($total / max($limit, 1)), 1);
        return [
            'items' => $items,
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'totalPages' => $totalPages,
            'hasNext' => $page < $totalPages,
        ];
    }
}
