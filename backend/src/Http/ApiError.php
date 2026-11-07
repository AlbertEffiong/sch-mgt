<?php

declare(strict_types=1);

namespace Syntax\Http;

use Exception;

/**
 * Uniform error carrier: rendered as
 * { success:false, error:{ message, code?, details? } } with the given HTTP status.
 */
final class ApiError extends Exception
{
    public int $status;
    public ?string $errorCode;
    public mixed $details;

    public function __construct(int $status, string $message, ?string $code = null, mixed $details = null)
    {
        parent::__construct($message);
        $this->status = $status;
        $this->errorCode = $code;
        $this->details = $details;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public static function badRequest(string $message = 'Bad request', ?string $code = null, mixed $details = null): self
    {
        return new self(400, $message, $code, $details);
    }

    public static function unauthorized(string $message = 'Authentication required.', ?string $code = 'UNAUTHENTICATED', mixed $details = null): self
    {
        return new self(401, $message, $code, $details);
    }

    public static function forbidden(string $message = 'Forbidden.', ?string $code = 'FORBIDDEN', mixed $details = null): self
    {
        return new self(403, $message, $code, $details);
    }

    public static function notFound(string $message = 'Not found.', ?string $code = 'NOT_FOUND', mixed $details = null): self
    {
        return new self(404, $message, $code, $details);
    }

    public static function conflict(string $message = 'Conflict.', ?string $code = 'CONFLICT', mixed $details = null): self
    {
        return new self(409, $message, $code, $details);
    }

    public static function internal(string $message = 'Internal server error.', ?string $code = 'INTERNAL_ERROR', mixed $details = null): self
    {
        return new self(500, $message, $code, $details);
    }
}

