<?php

declare(strict_types=1);

namespace Syntax\Support;

use DateTimeImmutable;
use DateTimeZone;

final class Clock
{
    private const TZ = 'UTC';
    public const DB_FORMAT = 'Y-m-d H:i:s';

    public static function now(): DateTimeImmutable
    {
        return new DateTimeImmutable('now', new DateTimeZone(self::TZ));
    }

    /** MySQL DATETIME representation (UTC). */
    public static function db(?DateTimeImmutable $at = null): string
    {
        return ($at ?? self::now())->format(self::DB_FORMAT);
    }

    public static function nowDb(): string
    {
        return self::db();
    }

    /** ISO-8601 UTC with milliseconds, e.g. 2026-10-19T12:34:56.789Z. */
    public static function iso(?DateTimeImmutable $at = null): string
    {
        $at ??= self::now();
        return $at->format('Y-m-d\TH:i:s.v\Z');
    }

    public static function nowIso(): string
    {
        return self::iso();
    }

    public static function fromDb(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $parsed = self::parse($value);
        return $parsed === null ? null : self::iso($parsed);
    }

    public static function plusDays(int $days, ?DateTimeImmutable $from = null): DateTimeImmutable
    {
        return ($from ?? self::now())->modify(sprintf('%+d days', $days));
    }

    public static function plusDaysDb(int $days, ?DateTimeImmutable $from = null): string
    {
        return self::db(self::plusDays($days, $from));
    }

    public static function plusMinutes(int $minutes, ?DateTimeImmutable $from = null): DateTimeImmutable
    {
        return ($from ?? self::now())->modify(sprintf('%+d minutes', $minutes));
    }

    public static function ms(?DateTimeImmutable $at = null): int
    {
        return (int) round(((float) ($at ?? self::now())->format('U.u')) * 1000);
    }

    public static function toIsoIfString(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_string($value)) {
            $parsed = self::parse($value);
            return $parsed === null ? $value : self::iso($parsed);
        }
        return self::iso();
    }

    /** Academic session, e.g. "2025/2026" (session runs Sep -> Aug). */
    public static function defaultSession(?DateTimeImmutable $now = null): string
    {
        $now ??= self::now();
        $year = (int) $now->format('Y');
        $start = ((int) $now->format('n')) >= 8 ? $year : $year - 1;
        return $start . '/' . ($start + 1);
    }

    public static function parse(string $value): ?DateTimeImmutable
    {
        try {
            return (new DateTimeImmutable($value, new DateTimeZone(self::TZ)))->setTimezone(new DateTimeZone(self::TZ));
        } catch (\Throwable) {
            return null;
        }
    }

    public static function isFuture(?string $dbDate, ?string $nowDb = null): bool
    {
        return $dbDate !== null && $dbDate !== '' && $dbDate > ($nowDb ?? self::nowDb());
    }
}
