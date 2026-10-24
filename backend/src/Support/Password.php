<?php

declare(strict_types=1);

namespace Syntax\Support;

use Syntax\Http\ApiError;

final class Password
{
    public const POLICY_MESSAGE = 'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number and a special character.';

    public static function isStrong(string $password): bool
    {
        return preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/', $password) === 1;
    }

    public static function assertStrong(string $password): void
    {
        if (!self::isStrong($password)) {
            throw ApiError::badRequest(self::POLICY_MESSAGE, 'WEAK_PASSWORD');
        }
    }

    public static function hash(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => Env::int('BCRYPT_ROUNDS', 12)]);
    }

    public static function verify(string $password, ?string $hash): bool
    {
        return $hash !== null && $hash !== '' && password_verify($password, $hash);
    }
}
