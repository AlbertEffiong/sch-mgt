<?php

declare(strict_types=1);

namespace Syntax\Support;

/** Generates Mongo-ObjectId-compatible 24-char hex identifiers. */
final class Ids
{
    public static function newId(): string
    {
        return bin2hex(pack('N', time()) . random_bytes(8));
    }

    public static function isId(mixed $value): bool
    {
        return is_string($value) && preg_match('/^[0-9a-fA-F]{24}$/', $value) === 1;
    }
}
