-- Syntax SaaS MySQL schema (MariaDB 10.4+ / MySQL 8+)

CREATE TABLE IF NOT EXISTS owners (
    id                      CHAR(24) NOT NULL PRIMARY KEY,
    name                    VARCHAR(120) NOT NULL,
    email                   VARCHAR(190) NOT NULL UNIQUE,
    password_hash           VARCHAR(255) NOT NULL,
    created_at              DATETIME NOT NULL,
    updated_at              DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schools (
    id                      CHAR(24) NOT NULL PRIMARY KEY,
    name                    VARCHAR(150) NOT NULL,
    email                   VARCHAR(190) NOT NULL UNIQUE,
    password_hash           VARCHAR(255) NOT NULL,
    subscription_status     ENUM('Active','Expired') NOT NULL DEFAULT 'Active',
    subscription_expires_at DATETIME NULL,
    school_prefix           VARCHAR(8) NOT NULL UNIQUE,
    principal_name          VARCHAR(120) NOT NULL DEFAULT '',
    plan_monthly            DECIMAL(10,2) NOT NULL DEFAULT 49.00,
    current_session         VARCHAR(9) NOT NULL DEFAULT '2025/2026',
    current_term            ENUM('First Term','Second Term','Third Term') NOT NULL DEFAULT 'First Term',
    terms_per_session       TINYINT UNSIGNED NOT NULL DEFAULT 3,
    pending_reference       VARCHAR(120) NULL,
    pending_amount          DECIMAL(10,2) NULL,
    pending_submitted_at    DATETIME NULL,
    pending_status          ENUM('pending','verified','rejected') NULL,
    created_at              DATETIME NOT NULL,
    updated_at              DATETIME NOT NULL,
    KEY idx_schools_status (subscription_status, subscription_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teachers (
    id                      CHAR(24) NOT NULL PRIMARY KEY,
    school_id               CHAR(24) NOT NULL,
    name                    VARCHAR(120) NOT NULL,
    email                   VARCHAR(190) NOT NULL UNIQUE,
    password_hash           VARCHAR(255) NULL,
    subject                 VARCHAR(190) NULL,
    status                  ENUM('Active','On Leave','Inactive') NOT NULL DEFAULT 'Active',
    verified                TINYINT(1) NOT NULL DEFAULT 0,
    otp_hash                VARCHAR(255) NULL,
    otp_expires_at          DATETIME NULL,
    created_at              DATETIME NOT NULL,
    updated_at              DATETIME NOT NULL,
    KEY idx_teachers_school (school_id),
    CONSTRAINT fk_teachers_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS classes (
    id                      CHAR(24) NOT NULL PRIMARY KEY,
    school_id               CHAR(24) NOT NULL,
    class_name              VARCHAR(60) NOT NULL,
    subjects_json           LONGTEXT NOT NULL,
    teacher_email           VARCHAR(190) NULL,
    created_at              DATETIME NOT NULL,
    updated_at              DATETIME NOT NULL,
    UNIQUE KEY uq_classes_school_name (school_id, class_name),
    KEY idx_classes_school (school_id),
    CONSTRAINT fk_classes_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS students (
    id                      CHAR(24) NOT NULL PRIMARY KEY,
    school_id               CHAR(24) NOT NULL,
    student_id              VARCHAR(40) NOT NULL UNIQUE,
    full_name               VARCHAR(120) NOT NULL,
    gender                  ENUM('Male','Female') NOT NULL,
    dob                     DATE NOT NULL,
    current_class           VARCHAR(60) NOT NULL,
    password_hash           VARCHAR(255) NOT NULL,
    historical_results      LONGTEXT NOT NULL,
    guardian_name           VARCHAR(120) NULL,
    guardian_phone          VARCHAR(40) NULL,
    address                 VARCHAR(255) NULL,
    created_at              DATETIME NOT NULL,
    updated_at              DATETIME NOT NULL,
    KEY idx_students_school_class (school_id, current_class),
    CONSTRAINT fk_students_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessments (
    id                      CHAR(24) NOT NULL PRIMARY KEY,
    school_id               CHAR(24) NOT NULL,
    class_id                CHAR(24) NOT NULL,
    class_name              VARCHAR(60) NOT NULL,
    subject                 VARCHAR(80) NOT NULL,
    teacher_id              CHAR(24) NULL,
    teacher_email           VARCHAR(190) NOT NULL,
    student_ref             CHAR(24) NOT NULL,
    student_id              VARCHAR(40) NOT NULL,
    ca1                     DECIMAL(5,1) NOT NULL DEFAULT 0,
    ca2                     DECIMAL(5,1) NOT NULL DEFAULT 0,
    exam                    DECIMAL(5,1) NOT NULL DEFAULT 0,
    total                   DECIMAL(5,1) NOT NULL DEFAULT 0,
    grade                   VARCHAR(2) NOT NULL DEFAULT '',
    status                  ENUM('Pending Approval','Approved','Revised') NOT NULL DEFAULT 'Pending Approval',
    principal_name          VARCHAR(120) NOT NULL DEFAULT '',
    term                    ENUM('First Term','Second Term','Third Term') NOT NULL,
    session                 VARCHAR(9) NOT NULL,
    submitted_at            DATETIME NULL,
    approved_at             DATETIME NULL,
    note                    VARCHAR(500) NOT NULL DEFAULT '',
    created_at              DATETIME NOT NULL,
    updated_at              DATETIME NOT NULL,
    UNIQUE KEY uq_assessments_sheet (school_id, class_id, subject, student_ref, term, session),
    KEY idx_assessments_student (school_id, student_ref),
    KEY idx_assessments_class (school_id, class_id, subject),
    KEY idx_assessments_status (school_id, status),
    CONSTRAINT fk_assessments_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE,
    CONSTRAINT fk_assessments_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
    CONSTRAINT fk_assessments_student FOREIGN KEY (student_ref) REFERENCES students (id) ON DELETE CASCADE,
    CONSTRAINT fk_assessments_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions_log (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    school_id               CHAR(24) NOT NULL,
    payment_proof_ref       VARCHAR(120) NOT NULL,
    amount                  DECIMAL(10,2) NOT NULL DEFAULT 0,
    status                  ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
    note                    VARCHAR(500) NULL,
    created_at              DATETIME NOT NULL,
    verified_at             DATETIME NULL,
    KEY idx_subscriptions_school (school_id, created_at),
    CONSTRAINT fk_subscriptions_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS counters (
    counter_key             VARCHAR(100) NOT NULL PRIMARY KEY,
    seq                     BIGINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limits (
    bucket                  VARCHAR(40) NOT NULL,
    identifier              VARCHAR(64) NOT NULL,
    window_start            BIGINT NOT NULL,
    hits                    INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (bucket, identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
