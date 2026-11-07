<?php

declare(strict_types=1);

namespace Syntax;

/** Idempotent MySQL migration runner. */
final class Schema
{
    public static function migrate(): void
    {
        $file = dirname(__DIR__) . '/database/schema.sql';
        if (!is_file($file)) {
            throw new \RuntimeException('Database schema file is missing: ' . $file);
        }
        $sql = (string) file_get_contents($file);
        $sql = (string) preg_replace('/^\s*--.*$/m', '', $sql);
        $statements = array_filter(array_map('trim', explode(';', $sql)));
        $pdo = Db::pdo();
        foreach ($statements as $statement) {
            if ($statement !== '') {
                $pdo->exec($statement);
            }
        }
    }
}
