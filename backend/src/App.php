<?php

declare(strict_types=1);

namespace Syntax;

use Syntax\Http\ApiError;
use Syntax\Http\Request;
use Syntax\Http\Response;
use Syntax\Http\Router;
use Syntax\Services\AdminService;
use Syntax\Services\AuthService;
use Syntax\Services\OwnerService;
use Syntax\Services\StudentService;
use Syntax\Services\TeacherService;
use Syntax\Support\Clock;
use Syntax\Support\Env;
use Syntax\Support\Jwt;
use Syntax\Support\Serialize;
use Syntax\Support\Session;
use Syntax\Support\Validate;

final class App
{
    public readonly AuthService $auth;
    public readonly OwnerService $owner;
    public readonly AdminService $admin;
    public readonly TeacherService $teacher;
    public readonly StudentService $student;
    public readonly Router $router;

    /** @var list<string> */
    private array $corsOrigins;
    private int $rateWindowMs;
    private int $rateMax;
    private string $jwtSecret;

    public function __construct()
    {
        Env::load(dirname(__DIR__) . '/.env');
        Schema::migrate();

        $this->auth = new AuthService();
        $this->owner = new OwnerService();
        $this->admin = new AdminService();
        $this->teacher = new TeacherService();
        $this->student = new StudentService();

        $this->corsOrigins = array_values(array_filter(array_map('trim', explode(',', (string) Env::get('CORS_ORIGINS', 'http://localhost:3000')))));
        $this->rateWindowMs = Env::int('RATE_LIMIT_WINDOW_MS', 900000);
        $this->rateMax = Env::int('RATE_LIMIT_MAX', 10);
        $this->jwtSecret = (string) Env::get('JWT_SECRET', 'dev-insecure-secret-change-me');

        $this->router = new Router();
        foreach (buildRoutes($this) as [$method, $path, $middleware, $validations, $handler]) {
            $this->router->add($method, $path, $middleware, $validations, $handler);
        }
    }

    public function handle(Request $request): Response
    {
        try {
            $response = $this->dispatch($request);
        } catch (ApiError $e) {
            $response = Response::error($e->getStatus(), $e->getMessage(), $e->errorCode, $e->details);
        } catch (\Throwable $e) {
            $message = Env::isProduction() ? 'Internal server error.' : ($e->getMessage() !== '' ? $e->getMessage() : 'Internal server error.');
            $response = Response::error(500, $message, 'INTERNAL_ERROR');
            error_log('[error] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        }

        if ($response->headers['x-request-id'] ?? null) {
            // already set
        } else {
            $response->withHeader('x-request-id', $request->requestId !== '' ? $request->requestId : bin2hex(random_bytes(8)));
        }

        $this->log($request, $response);
        return $response;
    }

    private function dispatch(Request $request): Response
    {
        $request->requestId = $request->header('x-request-id') ?: bin2hex(random_bytes(8));
        $response = new Response();

        // Global middleware: security, CORS, sanitize, rate limit, CSRF.
        $globals = [
            fn(Request $r, callable $next): Response => $this->withSecurityHeaders($r, $next()),
            fn(Request $r, callable $next): Response => $this->withCors($r, $next()),
            fn(Request $r, callable $next): Response => $this->sanitize($r, $next),
            fn(Request $r, callable $next): Response => $this->rateLimit($r, 'api', $this->rateMax * 30, 'Too many requests. Please slow down.', $next),
            fn(Request $r, callable $next): Response => $this->csrf($r, $next),
        ];

        if ($request->method === 'OPTIONS') {
            return $this->finish($request, $this->run($request, $globals, fn(): Response => new Response(204)));
        }

        $matched = $this->router->match($request->method, $request->path);

        if ($matched === null) {
            return $this->finish($request, $this->run($request, $globals, fn(): Response => Response::error(
                404,
                sprintf('Route %s %s not found.', $request->method, $request->path),
                'ROUTE_NOT_FOUND',
            )));
        }

        $request->params = $matched['params'];
        $route = $matched['route'];

        $pipes = $globals;
        foreach ($route['middleware'] as $name) {
            $pipes[] = $this->resolveMiddleware($name);
        }
        if ($route['validations'] !== []) {
            $validations = $route['validations'];
            $pipes[] = function (Request $r, callable $next) use ($validations): Response {
                foreach ($validations as $source => $rules) {
                    $data = match ($source) {
                        'body' => $r->body,
                        'query' => $r->query,
                        'params' => $r->params,
                        default => [],
                    };
                    $parsed = Validate::run($data, $rules);
                    match ($source) {
                        'body' => $r->body = $parsed,
                        'query' => $r->query = $parsed,
                        'params' => $r->params = $parsed,
                    };
                }
                return $next();
            };
        }
        $handler = $route['handler'];
        $pipes[] = fn(Request $r): Response => $handler($r);

        return $this->finish($request, $this->run($request, $pipes, fn(): Response => Response::error(404, 'Route not found.', 'ROUTE_NOT_FOUND')));
    }

    /** @param array<int, callable> $pipes */
    private function run(Request $request, array $pipes, callable $terminal): Response
    {
        $pipes[] = fn(Request $r): Response => $terminal();
        $index = 0;
        $next = function () use (&$next, &$index, $pipes, $request): Response {
            if ($index >= count($pipes)) {
                return Response::error(500, 'Pipeline exhausted.', 'INTERNAL_ERROR');
            }
            $pipe = $pipes[$index++];
            return $pipe($request, $next);
        };
        return $next();
    }

    private function finish(Request $request, Response $response): Response
    {
        // Ensure a readable CSRF cookie always exists for double-submit flows.
        if (!preg_match('/^[a-f0-9]{48}$/', $request->cookies[Session::CSRF_COOKIE] ?? '')) {
            Session::ensureCsrfCookie($request, $response);
        }
        return $response;
    }

    // ------------------------------------------------------------------ middleware

    private function resolveMiddleware(string $name): callable
    {
        return match ($name) {
            'authRate' => fn(Request $r, callable $next): Response =>
                $this->rateLimit($r, 'auth', $this->rateMax, 'Too many authentication attempts. Please try again later.', $next),
            'auth' => fn(Request $r, callable $next): Response => $this->authenticate($r, $next),
            'tenant' => fn(Request $r, callable $next): Response => $this->enforceTenant($r, $next),
            'load' => fn(Request $r, callable $next): Response => $this->loadSchool($r, $next),
            'sub' => fn(Request $r, callable $next): Response => $this->requireActiveSubscription($r, $next),
            default => str_starts_with($name, 'role:')
                ? fn(Request $r, callable $next): Response => $this->authorize($r, [substr($name, 5)], $next)
                : throw new \InvalidArgumentException('Unknown middleware: ' . $name),
        };
    }

    private function withSecurityHeaders(Request $request, Response $response): Response
    {
        $response
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withHeader('X-Frame-Options', 'DENY')
            ->withHeader('Referrer-Policy', 'same-origin')
            ->withHeader('X-DNS-Prefetch-Control', 'off')
            ->withHeader('Cross-Origin-Resource-Policy', 'same-site');
        if (str_starts_with($request->path, '/api')) {
            $response->withHeader(
                'Content-Security-Policy',
                "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
            );
        }
        return $response;
    }

    private function withCors(Request $request, Response $response): Response
    {
        $origin = $request->header('origin');
        if ($origin === null) {
            return $response;
        }
        $allowed = in_array($origin, $this->corsOrigins, true) || $this->isSameOrigin($origin);
        if (!$allowed) {
            return $response;
        }
        $response
            ->withHeader('Access-Control-Allow-Origin', $origin)
            ->withHeader('Access-Control-Allow-Credentials', 'true')
            ->withHeader('Vary', 'Origin');
        if ($request->method === 'OPTIONS') {
            $response
                ->withHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
                ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-csrf-token')
                ->withHeader('Access-Control-Max-Age', '600');
        }
        return $response;
    }

    private function isSameOrigin(string $origin): bool
    {
        $host = parse_url($origin, PHP_URL_HOST);
        $requestHost = parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST);
        return $host !== null && $host === $requestHost;
    }

    private function sanitize(Request $request, callable $next): Response
    {
        $request->body = $this->clean($request->body);
        $request->query = $this->clean($request->query);
        $request->params = $this->clean($request->params);
        return $next();
    }

    private function clean(mixed $value): mixed
    {
        if (!is_array($value)) {
            return $value;
        }
        $clean = [];
        foreach ($value as $key => $item) {
            if (is_string($key) && (str_starts_with($key, '$') || str_contains($key, '.'))) {
                continue;
            }
            $clean[$key] = $this->clean($item);
        }
        return $clean;
    }

    private function rateLimit(Request $request, string $bucket, int $max, string $message, callable $next): Response
    {
        $windowMs = $this->rateWindowMs;
        $window = (int) floor((microtime(true) * 1000) / $windowMs);
        $identifier = $request->ip();

        $row = Db::one(
            'SELECT window_start, hits FROM rate_limits WHERE bucket = :bucket AND identifier = :identifier',
            ['bucket' => $bucket, 'identifier' => $identifier],
        );
        if ($row === null) {
            Db::run(
                'INSERT INTO rate_limits (bucket, identifier, window_start, hits) VALUES (:bucket, :identifier, :window, 1)',
                ['bucket' => $bucket, 'identifier' => $identifier, 'window' => $window],
            );
            $hits = 1;
        } elseif ((int) $row['window_start'] === $window) {
            $hits = (int) $row['hits'] + 1;
            Db::run(
                'UPDATE rate_limits SET hits = :hits WHERE bucket = :bucket AND identifier = :identifier',
                ['hits' => $hits, 'bucket' => $bucket, 'identifier' => $identifier],
            );
        } else {
            $hits = 1;
            Db::run(
                'UPDATE rate_limits SET window_start = :window, hits = 1 WHERE bucket = :bucket AND identifier = :identifier',
                ['window' => $window, 'bucket' => $bucket, 'identifier' => $identifier],
            );
        }

        if ($hits > $max) {
            return Response::error(400, $message, 'RATE_LIMITED');
        }

        $response = $next();
        if ($response->statusCode() < 400) {
            // skipSuccessfulRequests: successful calls are refunded.
            Db::run(
                'UPDATE rate_limits SET hits = MAX(hits - 1, 0) WHERE bucket = :bucket AND identifier = :identifier AND window_start = :window',
                ['bucket' => $bucket, 'identifier' => $identifier, 'window' => $window],
            );
        }
        return $response;
    }

    private function csrf(Request $request, callable $next): Response
    {
        if (in_array($request->method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return $next();
        }
        if ($request->isBearer()) {
            return $next(); // Stateless clients are exempt.
        }
        $key = $request->method . ' ' . $request->path;
        $exempt = [
            'POST /api/auth/login',
            'POST /api/auth/register-school',
            'POST /api/auth/verify-otp',
            'POST /api/student/login',
        ];
        if (in_array($key, $exempt, true)) {
            return $next();
        }

        $cookie = (string) ($request->cookies[Session::CSRF_COOKIE] ?? '');
        $header = (string) ($request->header(Session::CSRF_HEADER) ?? '');
        if ($cookie === '' || $header === '' || !hash_equals($cookie, $header)) {
            throw ApiError::forbidden('Invalid or missing CSRF token.', 'CSRF_FAILED');
        }
        return $next();
    }

    private function authenticate(Request $request, callable $next): Response
    {
        $token = $request->bearerToken() ?? $request->cookies[Session::AUTH_COOKIE] ?? null;
        if (!is_string($token) || $token === '') {
            throw ApiError::unauthorized('Authentication required. Provide a bearer token or session cookie.');
        }
        $claims = Jwt::decode($token, $this->jwtSecret);
        if ($claims === null || !isset($claims['sub'], $claims['role'])) {
            throw ApiError::unauthorized('Invalid or expired session token', 'INVALID_TOKEN');
        }
        $request->user = [
            'id' => (string) $claims['sub'],
            'role' => (string) $claims['role'],
            'schoolId' => isset($claims['schoolId']) ? (string) $claims['schoolId'] : null,
            'email' => isset($claims['email']) ? (string) $claims['email'] : null,
        ];
        return $next();
    }

    private function authorize(Request $request, array $roles, callable $next): Response
    {
        if ($request->user === null) {
            throw ApiError::unauthorized('Authentication required. Provide a bearer token or session cookie.');
        }
        if (!in_array($request->user['role'], $roles, true)) {
            throw ApiError::forbidden(
                'This action requires one of the following roles: ' . implode(', ', $roles) . '.',
                'ROLE_FORBIDDEN',
            );
        }
        return $next();
    }

    private function enforceTenant(Request $request, callable $next): Response
    {
        if ($request->user === null) {
            throw ApiError::unauthorized('Authentication required. Provide a bearer token or session cookie.');
        }
        $tenantRoles = ['admin', 'teacher', 'student'];
        if (!in_array($request->user['role'], $tenantRoles, true)) {
            return $next(); // Owner has no tenant school.
        }
        $schoolId = $request->user['schoolId'];
        if ($schoolId === null || $schoolId === '') {
            throw ApiError::forbidden('No school is associated with this account.', 'NO_TENANT');
        }
        foreach (['params', 'body', 'query'] as $source) {
            $supplied = $request->{$source}['schoolId'] ?? null;
            if ($supplied !== null && $supplied !== '' && (string) $supplied !== (string) $schoolId) {
                throw ApiError::forbidden('Cross-tenant access is not permitted.', 'IDOR_BLOCKED');
            }
        }
        $request->tenantSchoolId = (string) $schoolId;
        return $next();
    }

    private function loadSchool(Request $request, callable $next): Response
    {
        if ($request->tenantSchoolId === null) {
            throw ApiError::forbidden('No tenant context for this request.', 'NO_TENANT');
        }
        $row = Db::one('SELECT * FROM schools WHERE id = :id', ['id' => $request->tenantSchoolId]);
        if ($row === null) {
            throw ApiError::notFound('School not found.', 'SCHOOL_NOT_FOUND');
        }
        $request->school = $row;
        return $next();
    }

    private function requireActiveSubscription(Request $request, callable $next): Response
    {
        if ($request->school === null) {
            throw ApiError::internal('Subscription check ran without a loaded school.');
        }
        $school = $request->school;
        $active = ($school['subscription_status'] ?? '') === 'Active'
            && !empty($school['subscription_expires_at'])
            && $school['subscription_expires_at'] > Clock::nowIso();
        if (!$active) {
            throw ApiError::forbidden('The result portal is locked because the school subscription is not active.', 'SUBSCRIPTION_INACTIVE');
        }
        return $next();
    }

    private function log(Request $request, Response $response): void
    {
        if (in_array($request->path, ['/health', '/ready'], true)) {
            return;
        }
        $ms = round((microtime(true) * 1000) - $request->startedAt, 1);
        $line = sprintf(
            "[req] %s %s %s -> %d (%sms)\n",
            $request->requestId,
            $request->method,
            $request->path,
            $response->statusCode(),
            $ms,
        );
        $dir = dirname(__DIR__) . '/logs';
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        @file_put_contents($dir . '/requests.log', $line, FILE_APPEND | LOCK_EX);
    }

    /** Serializer helpers used by route closures. */
    public static function schoolActive(array $school): bool
    {
        return ($school['subscription_status'] ?? '') === 'Active'
            && !empty($school['subscription_expires_at'])
            && $school['subscription_expires_at'] > Clock::nowIso();
    }
}
