<?php

declare(strict_types=1);

namespace Syntax\Support;

/** Grading bands and score helpers (exact scale from the original backend). */
final class Grading
{
    /** @var array<int, array{0:int,1:string,2:string}> ordered descending by min score */
    private const BANDS = [
        [70, 'A', 'Excellent'],
        [60, 'B', 'Very Good'],
        [50, 'C', 'Good'],
        [45, 'D', 'Fair'],
        [40, 'E', 'Pass'],
        [0, 'F', 'Fail'],
    ];

    public static function gradeFor(float|int $total): string
    {
        return self::band($total)[1];
    }

    public static function remarkFor(float|int $total): string
    {
        return self::band($total)[2];
    }

    public static function computeTotal(float|int $ca1, float|int $ca2, float|int $exam): int
    {
        return self::clamp($ca1, 20) + self::clamp($ca2, 20) + self::clamp($exam, 60);
    }

    public static function clamp(mixed $value, int $max): int
    {
        $num = is_numeric($value) ? (float) $value : NAN;
        if (!is_finite($num)) {
            return 0;
        }
        return (int) max(0, min($max, round($num)));
    }

    /** @return array{0:int,1:string,2:string} */
    private static function band(float|int $total): array
    {
        foreach (self::BANDS as $band) {
            if ($total >= $band[0]) {
                return $band;
            }
        }
        return self::BANDS[count(self::BANDS) - 1];
    }
}
