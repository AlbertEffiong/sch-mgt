<?php

declare(strict_types=1);

namespace Syntax\Support;

use RuntimeException;

/** Minimal HS256 JWT implementation (header.payload.signature). */
final class Jwt
{
    public static function encode(array $claims, string $secret, string|int $expiresIn): string
    {
        $header = self::b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_UNESCAPED_SLASHES));
        $now = time();
        $claims['iat'] = $now;
        $claims['exp'] = $now + self::ttlInSeconds($expiresIn);
        $payload = self::b64(json_encode($claims, JSON_UNESCAPED_SLASHES));
        $signature = self::b64(hash_hmac('sha256', $header . '.' . $payload, $secret, true));
        return $header . '.' . $payload . '.' . $signature;
    }

    /** @return array<string, mixed>|null Claims, or null when the token is invalid/expired. */
    public static function decode(string $token, string $secret): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }
        [$header, $payload, $signature] = $parts;
        $expected = self::b64(hash_hmac('sha256', $header . '.' . $payload, $secret, true));
        if (!hash_equals($expected, $signature)) {
            return null;
        }
        $claims = json_decode(self::unb64($payload), true);
        if (!is_array($claims)) {
            return null;
        }
        if (isset($claims['exp']) && (int) $claims['exp'] < time()) {
            return null;
        }
        return $claims;
    }

    public static function ttlInSeconds(string|int $expiresIn): int
    {
        if (is_int($expiresIn)) {
            return $expiresIn;
        }
        if (is_numeric($expiresIn)) {
            return (int) $expiresIn;
        }
        if (preg_match('/^(\d+)\s*([smhdw])$/i', trim($expiresIn), $m)) {
            $n = (int) $m[1];
            return match (strtolower($m[2])) {
                's' => $n,
                'm' => $n * 60,
                'h' => $n * 3600,
                'd' => $n * 86400,
                'w' => $n * 604800,
            };
        }
        throw new RuntimeException('Unsupported JWT expiry format: ' . $expiresIn);
    }

    private static function b64(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function unb64(string $data): string
    {
        $pad = strlen($data) % 4;
        if ($pad > 0) {
            $data .= str_repeat('=', 4 - $pad);
        }
        return (string) base64_decode(strtr($data, '-_', '+/'));
    }
}
