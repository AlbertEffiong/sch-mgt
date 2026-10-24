<?php

declare(strict_types=1);

namespace Syntax\Http;

final class Router
{
    /** @var array<int, array{method:string, pattern:string, regex:string, params:array<int,string>, middleware:array<int,callable>, validations:array<int,array>, handler:callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, array $middleware, array $validations, callable $handler): void
    {
        $params = [];
        $regex = preg_replace_callback('/\{([A-Za-z_][A-Za-z0-9_]*)\}/', function ($m) use (&$params) {
            $params[] = $m[1];
            return '(?P<' . $m[1] . '>[^/]+)';
        }, $pattern);
        $this->routes[] = [
            'method' => strtoupper($method),
            'pattern' => $pattern,
            'regex' => '#^' . $regex . '$#',
            'params' => $params,
            'middleware' => $middleware,
            'validations' => $validations,
            'handler' => $handler,
        ];
    }

    /** @return array{route: array, params: array<string, string>}|null */
    public function match(string $method, string $path): ?array
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== strtoupper($method)) {
                continue;
            }
            if (preg_match($route['regex'], $path, $m) === 1) {
                $params = [];
                foreach ($route['params'] as $name) {
                    $params[$name] = rawurldecode($m[$name]);
                }
                return ['route' => $route, 'params' => $params];
            }
        }
        return null;
    }
}
