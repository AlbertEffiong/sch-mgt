<?php

declare(strict_types=1);

namespace Syntax\Support;

final class Otp
{
    public const TTL_MINUTES = 10;

    public static function generate(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    public static function expiresAt(): string
    {
        return Clock::iso(Clock::plusMinutes(self::TTL_MINUTES));
    }

    public static function verify(string $code, ?string $hash, ?string $expiresAt): bool
    {
        if ($hash === null || $hash === '' || $expiresAt === null || $expiresAt === '') {
            return false;
        }
        $expires = Clock::parse($expiresAt);
        if ($expires === null || $expires->getTimestamp() < time()) {
            return false;
        }
        return password_verify($code, $hash);
    }
}
