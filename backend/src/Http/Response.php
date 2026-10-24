<?php

declare(strict_types=1);

namespace Syntax\Http;

final class Response
{
    public int $status;
    /** @var array<string, mixed>|string */
    public array|string $body;
    /** @var array<string, string> */
    public array $headers = [];
    /** @var array<int, array<string, mixed>> */
    public array $cookies = [];

    public function __construct(int $status = 200, array|string $body = [])
    {
        $this->status = $status;
        $this->body = $body;
    }

    public static function ok(mixed $data, ?string $message = null, int $status = 200): self
    {
        $body = ['success' => true, 'data' => $data];
        if ($message !== null) {
            $body['message'] = $message;
        }
        return new self($status, $body);
    }

    public static function created(mixed $data, ?string $message = null): self
    {
        return self::ok($data, $message, 201);
    }

    public static function error(int $status, string $message, ?string $code = null, mixed $details = null): self
    {
        $error = ['message' => $message];
        if ($code !== null) {
            $error['code'] = $code;
        }
        if ($details !== null) {
            $error['details'] = $details;
        }
        return new self($status, ['success' => false, 'error' => $error]);
    }

    public function withHeader(string $name, string $value): self
    {
        $this->headers[$name] = $value;
        return $this;
    }

    public function withCookie(
        string $name,
        string $value,
        bool $httpOnly = true,
        ?int $maxAge = null,
        bool $secure = false,
        string $sameSite = 'Strict',
        string $path = '/',
        string $domain = '',
    ): self {
        $this->cookies[] = [
            'name' => $name,
            'value' => $value,
            'httpOnly' => $httpOnly,
            'maxAge' => $maxAge,
            'secure' => $secure,
            'sameSite' => $sameSite,
            'path' => $path,
            'domain' => $domain,
        ];
        return $this;
    }

    public function statusCode(): int
    {
        return $this->status;
    }

    public function send(): void
    {
        if (!headers_sent()) {
            http_response_code($this->status);
            header('Content-Type: application/json; charset=utf-8');
            foreach ($this->headers as $name => $value) {
                header($name . ': ' . $value, true);
            }
            foreach ($this->cookies as $cookie) {
                header($this->cookieHeader($cookie), false);
            }
        }
        if ($this->status === 204 || $this->status === 304) {
            return;
        }
        if (is_string($this->body)) {
            echo $this->body;
            return;
        }
        echo json_encode($this->body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '{}';
    }

    /** @param array<string, mixed> $cookie */
    private function cookieHeader(array $cookie): string
    {
        $header = sprintf(
            '%s=%s; Path=%s; SameSite=%s',
            $cookie['name'],
            rawurlencode($cookie['value']),
            $cookie['path'],
            $cookie['sameSite'],
        );
        if ($cookie['domain'] !== '') {
            $header .= '; Domain=' . $cookie['domain'];
        }
        if ($cookie['maxAge'] !== null) {
            $header .= '; Max-Age=' . $cookie['maxAge'];
        }
        if ($cookie['secure']) {
            $header .= '; Secure';
        }
        if ($cookie['httpOnly']) {
            $header .= '; HttpOnly';
        }
        return 'Set-Cookie: ' . $header;
    }
}
