<?php

declare(strict_types=1);

namespace Syntax\Support;

/** Development mailer: appends messages to logs/mail.log (no SMTP provider configured). */
final class Mailer
{
    public static function sendTeacherOtp(string $to, string $teacherName, string $code): void
    {
        $subject = 'Your Syntax SaaS teacher activation code';
        $body = sprintf(
            "Hello %s,\n\nYour teacher activation code is: %s\n\nThis code expires in 10 minutes.\n\n-- Syntax SaaS\n",
            $teacherName,
            $code,
        );
        self::log(sprintf("TO: %s\nSUBJECT: %s\n%s\n---\n", $to, $subject, $body));
    }

    private static function log(string $entry): void
    {
        $dir = dirname(__DIR__, 2) . '/logs';
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        $line = '[' . Clock::nowIso() . "]\n" . $entry;
        @file_put_contents($dir . '/mail.log', $line, FILE_APPEND | LOCK_EX);
        if (!Env::isProduction()) {
            error_log('[mailer] ' . str_replace("\n", ' | ', $entry));
        }
    }
}
