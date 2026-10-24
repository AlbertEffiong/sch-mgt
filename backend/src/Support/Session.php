<?php

declare(strict_types=1);

namespace Syntax\Support;

use Syntax\Http\Request;
use Syntax\Http\Response;

/** Session establishment: JWT + double-submit CSRF cookies. */
final class Session
{
    public const AUTH_COOKIE = 'token';
    public const CSRF_COOKIE = 'csrfToken';
    public const CSRF_HEADER = 'x-csrf-token';
    public const COOKIE_MAX_AGE = 86400; // 1 day

    private static function secure(): bool
    {
        return Env::bool('COOKIE_SECURE', Env::isProduction());
    }

    private static function domain(): string
    {
        return (string) Env::get('COOKIE_DOMAIN', '');
    }

    public static function newCsrfToken(): string
    {
        return bin2hex(random_bytes(24));
    }

    /** Issue auth + CSRF cookies and the login payload fields. */
    public static function establish(Response $response, string $token): array
    {
        $csrf = self::newCsrfToken();
        $response
            ->withCookie(self::AUTH_COOKIE, $token, true, self::COOKIE_MAX_AGE, self::secure(), 'Strict', '/', self::domain())
            ->withCookie(self::CSRF_COOKIE, $csrf, false, null, self::secure(), 'Strict', '/', self::domain());
        return ['token' => $token, 'csrfToken' => $csrf];
    }

    /** Ensure a readable CSRF cookie exists on the response (double-submit setup). */
    public static function ensureCsrfCookie(Request $request, Response $response): void
    {
        $existing = $request->cookies[self::CSRF_COOKIE] ?? '';
        if (!preg_match('/^[a-f0-9]{48}$/', $existing)) {
            $response->withCookie(self::CSRF_COOKIE, self::newCsrfToken(), false, null, self::secure(), 'Strict', '/', self::domain());
        }
    }

    public static function clear(Response $response): void
    {
        $response
            ->withCookie(self::AUTH_COOKIE, '', true, 0, self::secure(), 'Strict', '/', self::domain())
            ->withCookie(self::CSRF_COOKIE, '', false, 0, self::secure(), 'Strict', '/', self::domain());
    }
}
