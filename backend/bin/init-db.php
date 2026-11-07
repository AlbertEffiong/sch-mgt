<?php

declare(strict_types=1);

/**
 * Creates the configured MySQL database (if needed) and applies the schema.
 *
 *   php bin/init-db.php
 */

require dirname(__DIR__) . '/src/bootstrap.php';

use Syntax\Db;
use Syntax\Schema;
use Syntax\Support\Env;

Env::load(dirname(__DIR__) . '/.env');

$host = (string) Env::get('DB_HOST', '127.0.0.1');
$port = (string) Env::get('DB_PORT', '3306');
$name = (string) Env::get('DB_NAME', 'syntax_saas');
$user = (string) Env::get('DB_USER', 'root');
$pass = (string) Env::get('DB_PASS', '');

if (!preg_match('/^[A-Za-z0-9_]+$/', $name)) {
    fwrite(STDERR, "[init-db] DB_NAME may only contain letters, numbers and underscores.\n");
    exit(1);
}

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%s;charset=utf8mb4', $host, $port),
    $user,
    $pass,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
);
$pdo->exec(sprintf(
    'CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    $name,
));
echo "[init-db] database {$name} is ready\n";

Schema::migrate();
Db::value('SELECT 1');
echo "[init-db] schema applied\n";
