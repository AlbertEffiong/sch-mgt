<?php

declare(strict_types=1);

namespace Syntax\Services;

use Syntax\Db;
use Syntax\Http\ApiError;
use Syntax\Support\Clock;
use Syntax\Support\Env;
use Syntax\Support\Ids;
use Syntax\Support\Jwt;
use Syntax\Support\Mailer;
use Syntax\Support\Otp;
use Syntax\Support\Password;
use Syntax\Support\Serialize;

final class AuthService
{
    public function registerSchool(array $data): array
    {
        $registrationOtp = (string) Env::get('SCHOOL_REGISTRATION_OTP', '081689');
        if (($data['otp'] ?? '') !== $registrationOtp) {
            throw ApiError::forbidden('Invalid or missing owner verification OTP.', 'INVALID_OTP');
        }
        Password::assertStrong($data['password']);

        $email = strtolower($data['email']);
        $prefix = strtoupper($data['uniqueSchoolPrefix']);

        if (Db::one('SELECT id FROM schools WHERE email = :email', ['email' => $email]) !== null) {
            throw ApiError::conflict('A school with this admin email already exists.', 'EMAIL_IN_USE');
        }
        if (Db::one('SELECT id FROM schools WHERE school_prefix = :prefix', ['prefix' => $prefix]) !== null) {
            throw ApiError::conflict('This school prefix is already in use.', 'PREFIX_IN_USE');
        }

        $now = Clock::nowDb();
        $row = [
            'id' => Ids::newId(),
            'name' => $data['name'],
            'email' => $email,
            'password_hash' => Password::hash($data['password']),
            'subscription_status' => $data['subscriptionStatus'] ?? 'Active',
            'subscription_expires_at' => Clock::plusDaysDb(30),
            'school_prefix' => $prefix,
            'principal_name' => $data['principalName'] ?? '',
            'plan_monthly' => $data['planMonthly'] ?? 49.0,
            'current_session' => Clock::defaultSession(),
            'current_term' => 'First Term',
            'terms_per_session' => 3,
            'created_at' => $now,
            'updated_at' => $now,
        ];
        Db::insert('schools', $row);
        return Serialize::school($row);
    }

    /** @return array{user: array, token: string} */
    public function login(array $data): array
    {
        $role = $data['role'];
        $password = (string) $data['password'];
        $email = isset($data['email']) ? strtolower(trim((string) $data['email'])) : null;

        return match ($role) {
            'owner' => $this->loginOwner($email, $password),
            'admin' => $this->loginAdmin($email, $password, (string) ($data['otp'] ?? '')),
            'teacher' => $this->loginTeacher($email, $password),
            'student' => $this->loginStudent((string) ($data['studentId'] ?? ''), $password),
            default => throw ApiError::badRequest('Unsupported role for login.', 'UNSUPPORTED_ROLE'),
        };
    }

    /** @return array{user: array, token: string} */
    private function loginOwner(?string $email, string $password): array
    {
        if ($email === null || $email === '') {
            throw ApiError::badRequest('Email is required for this role.', 'EMAIL_REQUIRED');
        }
        $row = Db::one('SELECT * FROM owners WHERE email = :email', ['email' => $email]);
        if ($row === null || !Password::verify($password, $row['password_hash'])) {
            throw ApiError::unauthorized('Invalid credentials.', 'INVALID_CREDENTIALS');
        }
        $claims = ['sub' => $row['id'], 'role' => 'owner', 'email' => $row['email']];
        return ['user' => Serialize::owner($row), 'token' => $this->token($claims)];
    }

    /** @return array{user: array, token: string} */
    private function loginAdmin(?string $email, string $password, string $otp): array
    {
        $adminOtp = (string) Env::get('ADMIN_LOGIN_OTP', '081689');
        if ($otp !== $adminOtp) {
            throw ApiError::forbidden('Invalid or missing sign-in OTP.', 'INVALID_OTP');
        }
        if ($email === null || $email === '') {
            throw ApiError::badRequest('Email is required for this role.', 'EMAIL_REQUIRED');
        }
        $row = Db::one('SELECT * FROM schools WHERE email = :email', ['email' => $email]);
        if ($row === null || !Password::verify($password, $row['password_hash'])) {
            throw ApiError::unauthorized('Invalid credentials.', 'INVALID_CREDENTIALS');
        }
        $claims = ['sub' => $row['id'], 'role' => 'admin', 'schoolId' => $row['id'], 'email' => $row['email']];
        return ['user' => Serialize::school($row), 'token' => $this->token($claims)];
    }

    /** @return array{user: array, token: string} */
    private function loginTeacher(?string $email, string $password): array
    {
        if ($email === null || $email === '') {
            throw ApiError::badRequest('Email is required for this role.', 'EMAIL_REQUIRED');
        }
        $row = Db::one('SELECT * FROM teachers WHERE email = :email', ['email' => $email]);
        if ($row === null) {
            throw ApiError::unauthorized('Invalid credentials.', 'INVALID_CREDENTIALS');
        }
        if (!(bool) $row['verified']) {
            throw ApiError::forbidden('Account not activated. Please verify the OTP sent to your email.', 'OTP_REQUIRED');
        }
        if (!Password::verify($password, $row['password_hash'])) {
            throw ApiError::unauthorized('Invalid credentials.', 'INVALID_CREDENTIALS');
        }
        $claims = ['sub' => $row['id'], 'role' => 'teacher', 'schoolId' => $row['school_id'], 'email' => $row['email']];
        return ['user' => Serialize::teacher($row), 'token' => $this->token($claims)];
    }

    /** @return array{user: array, token: string} */
    private function loginStudent(string $studentId, string $password): array
    {
        $studentId = strtoupper(trim($studentId));
        if ($studentId === '') {
            throw ApiError::badRequest('Student ID is required for student login.', 'STUDENT_ID_REQUIRED');
        }
        $row = Db::one('SELECT * FROM students WHERE student_id = :sid', ['sid' => $studentId]);
        if ($row === null || !Password::verify($password, $row['password_hash'])) {
            throw ApiError::unauthorized('Invalid credentials.', 'INVALID_CREDENTIALS');
        }
        $claims = ['sub' => $row['id'], 'role' => 'student', 'schoolId' => $row['school_id'], 'email' => $row['student_id']];
        $user = Serialize::student($row);
        $user['schoolId'] = $row['school_id'];
        return ['user' => $user, 'token' => $this->token($claims)];
    }

    /** @return array{teacher: array, otp?: string} */
    public function inviteTeacher(array $principal, array $data): array
    {
        $email = strtolower($data['email']);

        foreach (['teachers', 'owners', 'schools'] as $table) {
            if (Db::one(sprintf('SELECT id FROM %s WHERE email = :email', $table), ['email' => $email]) !== null) {
                throw ApiError::conflict('This email is already registered.', 'EMAIL_IN_USE');
            }
        }

        $code = Otp::generate();
        $now = Clock::nowDb();
        $row = [
            'id' => Ids::newId(),
            'school_id' => $principal['schoolId'],
            'name' => $data['name'],
            'email' => $email,
            'password_hash' => null,
            'subject' => $data['subject'] ?? null,
            'status' => 'Active',
            'verified' => 0,
            'otp_hash' => Password::hash($code),
            'otp_expires_at' => Otp::expiresAt(),
            'created_at' => $now,
            'updated_at' => $now,
        ];
        Db::insert('teachers', $row);
        Mailer::sendTeacherOtp($email, $data['name'], $code);

        $payload = ['teacher' => Serialize::teacher($row)];
        if (!Env::isProduction()) {
            $payload['otp'] = $code;
        }
        return $payload;
    }

    public function verifyOtp(array $data): array
    {
        Password::assertStrong($data['password']);

        $email = strtolower($data['email']);
        $row = Db::one('SELECT * FROM teachers WHERE email = :email', ['email' => $email]);
        if ($row === null) {
            throw ApiError::notFound('No pending invitation found for this email.', 'INVITE_NOT_FOUND');
        }
        if ((bool) $row['verified']) {
            throw ApiError::conflict('This teacher account is already activated.', 'ALREADY_VERIFIED');
        }
        if (!Otp::verify($data['otp'], $row['otp_hash'], $row['otp_expires_at'])) {
            throw ApiError::badRequest('Invalid or expired OTP.', 'INVALID_OTP');
        }

        Db::run(
            'UPDATE teachers SET password_hash = :password, verified = 1, status = \'Active\',
             otp_hash = NULL, otp_expires_at = NULL, updated_at = :now WHERE id = :id',
            ['password' => Password::hash($data['password']), 'now' => Clock::nowDb(), 'id' => $row['id']],
        );
        $row = Db::one('SELECT * FROM teachers WHERE id = :id', ['id' => $row['id']]);
        return Serialize::teacher($row ?? []);
    }

    private function token(array $claims): string
    {
        return Jwt::encode($claims, (string) Env::get('JWT_SECRET', 'dev-insecure-secret-change-me'), (string) Env::get('JWT_EXPIRES_IN', '1d'));
    }
}
