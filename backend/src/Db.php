<?php

declare(strict_types=1);

namespace Syntax;

use PDO;
use PDOStatement;
use Syntax\Support\Env;

final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }
        $path = (string) Env::get('DB_PATH', 'database/syntax_saas.sqlite');
        if (!str_starts_with($path, '/') && !preg_match('/^[A-Za-z]:[\\\\\\/]/', $path)) {
            $path = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
        }
        $dir = dirname($path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        $pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA busy_timeout = 5000');
        self::$pdo = $pdo;
        return $pdo;
    }

    public static function run(string $sql, array $params = []): PDOStatement
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $row = self::run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    /** @return array<int, array<string, mixed>> */
    public static function all(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }

    public static function value(string $sql, array $params = []): mixed
    {
        $row = self::run($sql, $params)->fetch(PDO::FETCH_NUM);
        return $row === false ? null : $row[0];
    }

    public static function insert(string $table, array $data): void
    {
        $columns = array_keys($data);
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $table,
            implode(', ', $columns),
            implode(', ', array_map(fn($c) => ':' . $c, $columns)),
        );
        self::run($sql, $data);
    }

    /** Atomic sequence, equivalent of Mongo's findOneAndUpdate +$inc upsert. */
    public static function nextSequence(string $key): int
    {
        $pdo = self::pdo();
        $pdo->beginTransaction();
        try {
            $row = self::one('SELECT seq FROM counters WHERE key = :key', ['key' => $key]);
            if ($row === null) {
                self::run('INSERT INTO counters (key, seq) VALUES (:key, 1)', ['key' => $key]);
                $seq = 1;
            } else {
                $seq = (int) $row['seq'] + 1;
                self::run('UPDATE counters SET seq = :seq WHERE key = :key', ['seq' => $seq, 'key' => $key]);
            }
            $pdo->commit();
            return $seq;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }
}
