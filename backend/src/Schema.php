<?php

declare(strict_types=1);

namespace Syntax;

/** Auto-migration: creates all tables on every boot (idempotent). */
final class Schema
{
    public static function migrate(): void
    {
        $pdo = Db::pdo();
        $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS owners (
    id                      TEXT PRIMARY KEY,
    name                    TEXT NOT NULL,
    email                   TEXT NOT NULL UNIQUE,
    password                TEXT NOT NULL,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schools (
    id                      TEXT PRIMARY KEY,
    name                    TEXT NOT NULL,
    email                   TEXT NOT NULL UNIQUE,
    password                TEXT NOT NULL,
    subscription_status     TEXT NOT NULL DEFAULT 'Active' CHECK (subscription_status IN ('Active','Expired')),
    subscription_expires_at TEXT,
    unique_school_prefix    TEXT NOT NULL UNIQUE,
    principal_name          TEXT NOT NULL DEFAULT '',
    plan_monthly            REAL NOT NULL DEFAULT 49,
    current_session         TEXT,
    current_term            TEXT NOT NULL DEFAULT 'First Term',
    terms_per_session       INTEGER NOT NULL DEFAULT 3,
    pending_reference       TEXT,
    pending_amount          REAL,
    pending_submitted_at    TEXT,
    pending_status          TEXT CHECK (pending_status IS NULL OR pending_status IN ('pending','verified','rejected')),
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teachers (
    id                      TEXT PRIMARY KEY,
    school_id               TEXT NOT NULL,
    name                    TEXT NOT NULL,
    email                   TEXT NOT NULL UNIQUE,
    password                TEXT,
    subject                 TEXT,
    verified                INTEGER NOT NULL DEFAULT 0,
    otp_hash                TEXT,
    otp_expires_at          TEXT,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_teachers_school ON teachers (school_id);

CREATE TABLE IF NOT EXISTS students (
    id                      TEXT PRIMARY KEY,
    school_id               TEXT NOT NULL,
    student_id              TEXT NOT NULL UNIQUE,
    full_name               TEXT NOT NULL,
    gender                  TEXT NOT NULL CHECK (gender IN ('Male','Female')),
    dob                     TEXT NOT NULL,
    current_class           TEXT NOT NULL,
    password                TEXT NOT NULL,
    historical_results      TEXT NOT NULL DEFAULT '[]',
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students (school_id, current_class);

CREATE TABLE IF NOT EXISTS classes (
    id                      TEXT PRIMARY KEY,
    school_id               TEXT NOT NULL,
    class_name              TEXT NOT NULL,
    subjects                TEXT NOT NULL DEFAULT '[]',
    teacher_email           TEXT,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL,
    UNIQUE (school_id, class_name)
);

CREATE TABLE IF NOT EXISTS assessments (
    id                      TEXT PRIMARY KEY,
    school_id               TEXT NOT NULL,
    class_id                TEXT NOT NULL,
    class_name              TEXT NOT NULL,
    subject                 TEXT NOT NULL,
    teacher_id              TEXT NOT NULL,
    teacher_email           TEXT NOT NULL,
    student_ref             TEXT NOT NULL,
    student_id              TEXT NOT NULL,
    ca1                     REAL NOT NULL DEFAULT 0,
    ca2                     REAL NOT NULL DEFAULT 0,
    exam                    REAL NOT NULL DEFAULT 0,
    total                   REAL NOT NULL DEFAULT 0,
    grade                   TEXT NOT NULL DEFAULT '',
    status                  TEXT NOT NULL DEFAULT 'Pending Approval',
    principal_name          TEXT NOT NULL DEFAULT '',
    term                    TEXT NOT NULL,
    session                 TEXT NOT NULL,
    submitted_at            TEXT,
    approved_at             TEXT,
    note                    TEXT NOT NULL DEFAULT '',
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL,
    UNIQUE (school_id, class_id, subject, student_ref, term, session)
);
CREATE INDEX IF NOT EXISTS idx_assessments_student ON assessments (school_id, student_ref);
CREATE INDEX IF NOT EXISTS idx_assessments_class ON assessments (school_id, class_id, subject);

CREATE TABLE IF NOT EXISTS counters (
    key                     TEXT PRIMARY KEY,
    seq                     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rate_limits (
    bucket                  TEXT NOT NULL,
    identifier              TEXT NOT NULL,
    window_start            INTEGER NOT NULL,
    hits                    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (bucket, identifier)
);
SQL);
    }
}
