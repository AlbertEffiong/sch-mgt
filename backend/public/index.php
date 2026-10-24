<?php

declare(strict_types=1);

/**
 * Front controller. Works with:
 *   - Apache/XAMPP  : via public/.htaccess (and backend/.htaccess)
 *   - PHP built-in  : php -S localhost:4000 router.php  (from backend/)
 */

require dirname(__DIR__) . '/src/bootstrap.php';

use Syntax\App;
use Syntax\Http\Request;

// When deployed under a sub-directory (e.g. /school%20mgt/backend/public),
// strip the front-controller base path so routes always see /api/... .
$path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = $path === '' ? '/' : $path;
$scriptFile = (string) ($_SERVER['SCRIPT_FILENAME'] ?? '');
if ($scriptFile !== '' && realpath($scriptFile) === realpath(__FILE__)) {
    $base = rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/'))), '/');
    if ($base !== '' && str_starts_with($path, $base . '/')) {
        $path = substr($path, strlen($base)) ?: '/';
    } elseif ($base !== '' && $path === $base) {
        $path = '/';
    }
}

$app = new App();
$request = new Request(strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')), $path);
$app->handle($request)->send();
