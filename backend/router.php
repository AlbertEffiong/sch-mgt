<?php

/**
 * Router script for PHP's built-in web server.
 *
 *   php -S localhost:4000 router.php
 */

$public = __DIR__ . '/public';
$path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$file = $public . ($path === '' || $path === '/' ? '/index.php' : $path);

if ($path !== '/' && is_file($file)) {
    return false; // Let the built-in server stream the static file.
}

require $public . '/index.php';
