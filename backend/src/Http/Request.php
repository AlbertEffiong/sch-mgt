<?php

declare(strict_types=1);

namespace Syntax\Http;

final class Request
{
    public string $method;
    public string $path;
    /** @var array<string, mixed> */
    public array $query;
    /** @var array<string, mixed> */
    public array $body;
    /** @var array<string, mixed> */
    public array $params = [];
    /** @var array<string, string> */
    public array $cookies;
    /** @var array<string, string> lowercase header name => value */
    public array $headers;

    /** Authenticated principal: {id, role, schoolId?, email?} */
    public ?array $user = null;
    public ?string $tenantSchoolId = null;
    public ?array $school = null;
    public string $requestId = '';

    /** @var float Start time (ms) for request logging */
    public float $startedAt;

    public function __construct(?string $method = null, ?string $path = null)
    {
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $this->method = strtoupper($method ?? ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $this->path = $path ?? (string) parse_url($uri, PHP_URL_PATH);
        $this->path = $this->path === '' ? '/' : $this->path;
        $this->query = $_GET;
        $this->cookies = $_COOKIE;
        $this->headers = self::collectHeaders();
        $this->body = $this->parseBody();
        $this->startedAt = microtime(true) * 1000;
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    public function isBearer(): bool
    {
        $auth = $this->header('authorization');
        return $auth !== null && str_starts_with($auth, 'Bearer ');
    }

    public function bearerToken(): ?string
    {
        $auth = $this->header('authorization');
        if ($auth === null || !str_starts_with($auth, 'Bearer ')) {
            return null;
        }
        return trim(substr($auth, 7));
    }

    public function ip(): string
    {
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    /** @return array<string, string> */
    private static function collectHeaders(): array
    {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $name = strtolower(str_replace('_', '-', substr($key, 5)));
                $headers[$name] = is_array($value) ? (string) reset($value) : (string) $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = (string) $_SERVER['CONTENT_TYPE'];
        }
        if (isset($_SERVER['CONTENT_LENGTH'])) {
            $headers['content-length'] = (string) $_SERVER['CONTENT_LENGTH'];
        }
        return $headers;
    }

    /** @return array<string, mixed> */
    private function parseBody(): array
    {
        $contentType = $this->header('content-type') ?? '';
        if (stripos($contentType, 'application/json') !== false) {
            $raw = file_get_contents('php://input') ?: '';
            if ($raw === '') {
                return [];
            }
            $decoded = json_decode($raw, true);
            return is_array($decoded) ? $decoded : [];
        }
        return $_POST;
    }
}
