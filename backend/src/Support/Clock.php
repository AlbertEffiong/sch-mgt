<?php

declare(strict_types=1);

namespace Syntax\Support;

use DateTimeImmutable;
use DateTimeZone;

final class Clock
{
    private const TZ = 'UTC';

    public static function now(): DateTimeImmutable
    {
        return new DateTimeImmutable('now', new DateTimeZone(self::TZ));
    }

    /** ISO-8601 UTC with milliseconds, e.g. 2026-10-19T12:34:56.789Z (matches Mongo serialization). */
    public static function iso(?DateTimeImmutable $at = null): string
    {
        $at ??= self::now();
        return $at->format('Y-m-d\TH:i:s.v\Z');
    }

    public static function nowIso(): string
    {
        return self::iso();
    }

    public static function plusDays(int $days, ?DateTimeImmutable $from = null): DateTimeImmutable
    {
        return ($from ?? self::now())->modify(sprintf('%+d days', $days));
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
            $ts = strtotime($value);
            return $ts === false ? $value : self::iso((new DateTimeImmutable('@' . $ts))->setTimezone(new DateTimeZone(self::TZ)));
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
        $ts = strtotime($value);
        if ($ts === false) {
            return null;
        }
        return (new DateTimeImmutable('@' . $ts))->setTimezone(new DateTimeZone(self::TZ));
    }
}
