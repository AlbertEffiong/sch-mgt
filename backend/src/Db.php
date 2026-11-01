<?php

declare(strict_types=1);

namespace Syntax;

use PDO;
use PDOException;
use PDOStatement;
use Syntax\Support\Env;

final class Db
{
    private static ?PDO $pdo = null;

    /** @var array<int, mixed> */
    private const OPTIONS = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_STRINGIFY_FETCHES => false,
    ];

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $host = (string) Env::get('DB_HOST', '127.0.0.1');
        $port = (string) Env::get('DB_PORT', '3306');
        $name = (string) Env::get('DB_NAME', 'syntax_saas');
        $user = (string) Env::get('DB_USER', 'root');
        $pass = (string) Env::get('DB_PASS', '');

        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $name);

        try {
            $pdo = new PDO($dsn, $user, $pass, self::OPTIONS);
        } catch (PDOException $e) {
            // First run convenience: create the database when the server is reachable
            // but the target schema does not exist yet (MySQL error 1049).
            if ((int) ($e->errorInfo[1] ?? 0) !== 1049) {
                throw $e;
            }
            $server = new PDO(
                sprintf('mysql:host=%s;port=%s;charset=utf8mb4', $host, $port),
                $user,
                $pass,
                self::OPTIONS,
            );
            $server->exec(sprintf(
                'CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
                str_replace('`', '``', $name),
            ));
            $pdo = new PDO($dsn, $user, $pass, self::OPTIONS);
        }

        $pdo->exec("SET time_zone = '+00:00'");
        self::$pdo = $pdo;
        return $pdo;
    }

    public static function run(string $sql, array $params = []): PDOStatement
    {
        $named = [];
        $positional = [];
        foreach ($params as $key => $value) {
            if (is_int($key)) {
                $positional[$key] = $value;
            } else {
                $named[$key] = $value;
            }
        }

        // Native MySQL prepares reject a named placeholder that appears more than
        // once, so expand every named parameter into a unique placeholder.
        $bindings = [];
        if ($named !== []) {
            $sql = preg_replace_callback(
                '/:([A-Za-z_][A-Za-z0-9_]*)/',
                static function (array $match) use ($named, &$bindings): string {
                    if (!array_key_exists($match[1], $named)) {
                        return $match[0];
                    }
                    $placeholder = '__bind' . count($bindings);
                    $bindings[$placeholder] = $named[$match[1]];
                    return ':' . $placeholder;
                },
                $sql,
            );
        }

        $stmt = self::pdo()->prepare($sql);
        foreach ($bindings as $key => $value) {
            self::bindValue($stmt, ':' . $key, $value);
        }
        foreach ($positional as $key => $value) {
            self::bindValue($stmt, $key + 1, $value);
        }
        $stmt->execute();
        return $stmt;
    }

    private static function bindValue(PDOStatement $stmt, int|string $placeholder, mixed $value): void
    {
        if ($value === null) {
            $type = PDO::PARAM_NULL;
        } elseif (is_bool($value)) {
            $type = PDO::PARAM_INT;
            $value = $value ? 1 : 0;
        } elseif (is_int($value)) {
            $type = PDO::PARAM_INT;
        } else {
            $type = PDO::PARAM_STR;
            if (is_float($value)) {
                $value = (string) $value;
            }
        }
        $stmt->bindValue($placeholder, $value, $type);
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
            self::quoteIdentifier($table),
            implode(', ', array_map(static fn(string $column): string => self::quoteIdentifier($column), $columns)),
            implode(', ', array_map(fn($c) => ':' . $c, $columns)),
        );
        self::run($sql, $data);
    }

    /** Atomic enrollment sequence, backed by MySQL's LAST_INSERT_ID(expr). */
    public static function nextSequence(string $key): int
    {
        $pdo = self::pdo();
        $pdo->beginTransaction();
        try {
            self::run(
                'INSERT INTO counters (counter_key, seq) VALUES (:key, 0)
                 ON DUPLICATE KEY UPDATE counter_key = VALUES(counter_key)',
                ['key' => $key],
            );
            self::run(
                'UPDATE counters SET seq = LAST_INSERT_ID(seq + 1) WHERE counter_key = :key',
                ['key' => $key],
            );
            $seq = (int) $pdo->lastInsertId();
            $pdo->commit();
            return $seq;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    private static function quoteIdentifier(string $identifier): string
    {
        return '`' . str_replace('`', '``', $identifier) . '`';
    }
}
