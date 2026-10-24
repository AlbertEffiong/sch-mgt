<?php

declare(strict_types=1);

/**
 * Application bootstrap: PSR-4 style autoloader for the Syntax\ namespace
 * plus the route table (buildRoutes lives in src/routes.php).
 */

spl_autoload_register(static function (string $class): void {
    $prefix = 'Syntax\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $path = __DIR__ . DIRECTORY_SEPARATOR . str_replace('\\', DIRECTORY_SEPARATOR, $relative) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

require __DIR__ . '/routes.php';
