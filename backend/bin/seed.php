<?php

declare(strict_types=1);

/**
 * Database seeder.
 *
 *   php bin/seed.php            # platform owner only (from .env)
 *   php bin/seed.php --demo     # owner + full demo tenant (Bright Future Academy …)
 *   php bin/seed.php --fresh --demo   # wipe every table first, then seed
 */

require dirname(__DIR__) . '/src/bootstrap.php';

use Syntax\Db;
use Syntax\Schema;
use Syntax\Support\Clock;
use Syntax\Support\Env;
use Syntax\Support\Grading;
use Syntax\Support\Ids;
use Syntax\Support\Password;

$args = array_slice($argv, 1);
$fresh = in_array('--fresh', $args, true);
$demo = in_array('--demo', $args, true) || in_array('--all', $args, true);

if (in_array('--help', $args, true) || in_array('-h', $args, true)) {
    echo "Usage: php bin/seed.php [--fresh] [--demo]\n";
    echo "  --fresh  delete all rows before seeding\n";
    echo "  --demo   seed demo schools, teachers, classes, students and results\n";
    exit(0);
}

Env::load(dirname(__DIR__) . '/.env');
Schema::migrate();

if ($fresh) {
    foreach (['assessments', 'students', 'classes', 'teachers', 'schools', 'owners', 'counters', 'rate_limits'] as $table) {
        Db::run('DELETE FROM ' . $table);
    }
    echo "[seed] wiped all tables\n";
}

// ------------------------------------------------------------------ owner

$ownerEmail = strtolower((string) Env::get('OWNER_EMAIL', 'owner@syntaxsaas.io'));
$ownerName = (string) Env::get('OWNER_NAME', 'SaaS Owner');
$ownerPassword = (string) Env::get('OWNER_PASSWORD', 'ChangeMe@123');
$now = Clock::nowIso();

$owner = Db::one('SELECT id FROM owners WHERE email = :email', ['email' => $ownerEmail]);
if ($owner === null) {
    Db::insert('owners', [
        'id' => Ids::newId(),
        'name' => $ownerName,
        'email' => $ownerEmail,
        'password' => Password::hash($ownerPassword),
        'created_at' => $now,
        'updated_at' => $now,
    ]);
    echo "[seed] owner {$ownerEmail} created\n";
} else {
    Db::run('UPDATE owners SET name = :name, password = :password, updated_at = :now WHERE id = :id', [
        'name' => $ownerName,
        'password' => Password::hash($ownerPassword),
        'now' => $now,
        'id' => $owner['id'],
    ]);
    echo "[seed] owner {$ownerEmail} updated\n";
}

if (!$demo) {
    echo "[seed] done — run with --demo to seed a demo school\n";
    exit(0);
}

// ------------------------------------------------------------------ demo tenants

const ADMIN_PASSWORD = 'school123';
const TEACHER_PASSWORD = 'teach123';
const STUDENT_PASSWORD = '1234'; // demo PIN pre-filled by the portal login form

$CLASS_SUBJECTS = [
    'JSS1' => ['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Civic Education', 'Computer Studies'],
    'JSS2' => ['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Civic Education', 'Computer Studies'],
    'JSS3' => ['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Civic Education', 'Computer Studies', 'Agricultural Science'],
    'SS1' => ['Mathematics', 'English Language', 'Physics', 'Chemistry', 'Biology', 'Further Mathematics'],
    'SS2' => ['Mathematics', 'English Language', 'Physics', 'Chemistry', 'Biology', 'Further Mathematics'],
    'SS3' => ['Mathematics', 'English Language', 'Physics', 'Chemistry', 'Biology', 'Further Mathematics', 'Economics'],
];
$FORM_TEACHERS = [
    'JSS1' => 'Mrs. A. Bello', 'JSS2' => 'Mr. C. Okafor', 'JSS3' => 'Mrs. E. Adeyemi',
    'SS1' => 'Mr. F. Danjuma', 'SS2' => 'Mrs. G. Nwosu', 'SS3' => 'Mr. H. Ijeoma',
];

$schools = [
    ['BFA', 'Bright Future Academy', 'admin@brightfuture.edu', 'A. Bello', 49.0, 'Active', 30, null],
    ['GVH', 'Green Valley High', 'admin@greenvalley.edu', 'M. Okonkwo', 49.0, 'Active', 30, ['reference' => 'OPAY/GVH/88213', 'amount' => 49.0]],
    ['RPC', 'Royal Pride College', 'admin@royalpride.edu', 'S. Adewale', 49.0, 'Active', 5, null],
    ['SIS', 'Sunrise International', 'admin@sunrise.edu', 'E. Bassey', 99.0, 'Expired', -12, null],
    ['UGS', 'Unity Grammar School', 'admin@unity.edu', 'H. Yakubu', 49.0, 'Active', 45, null],
    ['CMS', 'Crescent Model School', 'admin@crescent.edu', 'I. Salami', 49.0, 'Expired', -40, null],
];

$schoolIds = [];
foreach ($schools as [$prefix, $name, $email, $principal, $plan, $status, $days, $pending]) {
    $expires = Clock::iso(Clock::plusDays($days));
    $existing = Db::one('SELECT id FROM schools WHERE unique_school_prefix = :prefix', ['prefix' => $prefix]);
    $id = $existing['id'] ?? Ids::newId();
    $row = [
        'id' => $id,
        'name' => $name,
        'email' => $email,
        'password' => Password::hash(ADMIN_PASSWORD),
        'subscription_status' => $status,
        'subscription_expires_at' => $expires,
        'unique_school_prefix' => $prefix,
        'principal_name' => $principal,
        'plan_monthly' => $plan,
        'current_session' => Clock::defaultSession(),
        'current_term' => 'First Term',
        'terms_per_session' => 3,
        'pending_reference' => $pending['reference'] ?? null,
        'pending_amount' => $pending['amount'] ?? null,
        'pending_submitted_at' => $pending !== null ? Clock::nowIso() : null,
        'pending_status' => $pending !== null ? 'pending' : null,
        'created_at' => $now,
        'updated_at' => $now,
    ];
    if ($existing === null) {
        Db::insert('schools', $row);
    } else {
        Db::run(
            'UPDATE schools SET name = :name, email = :email, subscription_status = :subscription_status,
             subscription_expires_at = :subscription_expires_at, principal_name = :principal_name,
             plan_monthly = :plan_monthly, current_session = :current_session, current_term = :current_term,
             pending_reference = :pending_reference, pending_amount = :pending_amount,
             pending_submitted_at = :pending_submitted_at, pending_status = :pending_status, updated_at = :now
             WHERE id = :id',
            $row + ['now' => $now],
        );
    }
    $schoolIds[$prefix] = $id;
    echo "[seed] school {$prefix} — {$name} ({$status})\n";
}

$bfa = $schoolIds['BFA'];

// ------------------------------------------------------------------ classes (BFA)

$classIds = [];
foreach ($CLASS_SUBJECTS as $level => $subjects) {
    $existing = Db::one('SELECT id FROM classes WHERE school_id = :school AND class_name = :name', ['school' => $bfa, 'name' => $level]);
    $id = $existing['id'] ?? Ids::newId();
    $row = [
        'id' => $id,
        'school_id' => $bfa,
        'class_name' => $level,
        'subjects' => json_encode($subjects, JSON_UNESCAPED_UNICODE),
        'teacher_email' => null,
        'created_at' => $now,
        'updated_at' => $now,
    ];
    if ($existing === null) {
        Db::insert('classes', $row);
    } else {
        Db::run('UPDATE classes SET subjects = :subjects, updated_at = :now WHERE id = :id', [
            'subjects' => $row['subjects'], 'now' => $now, 'id' => $id,
        ]);
    }
    $classIds[$level] = $id;
}
echo '[seed] ' . count($classIds) . " classes (JSS1-SS3)\n";

// ------------------------------------------------------------------ teachers (BFA)

$teachers = [
    ['Mrs. A. Bello', 'teacher@brightfuture.edu', 'Mathematics', 1],
    ['Mr. C. Okafor', 'okafor@brightfuture.edu', 'English Language', 1],
    ['Mrs. E. Adeyemi', 'adeyemi@brightfuture.edu', 'Basic Science', 1],
    ['Mr. F. Danjuma', 'danjuma@brightfuture.edu', 'Physics', 1],
    ['Mrs. G. Nwosu', 'nwosu@brightfuture.edu', 'Biology', 1],
];

$teacherIds = [];
foreach ($teachers as [$name, $email, $subject, $verified]) {
    $existing = Db::one('SELECT id FROM teachers WHERE email = :email', ['email' => $email]);
    $id = $existing['id'] ?? Ids::newId();
    $row = [
        'id' => $id,
        'school_id' => $bfa,
        'name' => $name,
        'email' => $email,
        'password' => Password::hash(TEACHER_PASSWORD),
        'subject' => $subject,
        'verified' => $verified,
        'otp_hash' => null,
        'otp_expires_at' => null,
        'created_at' => $now,
        'updated_at' => $now,
    ];
    if ($existing === null) {
        Db::insert('teachers', $row);
    } else {
        Db::run('UPDATE teachers SET name = :name, school_id = :school_id, subject = :subject, verified = :verified, updated_at = :now WHERE id = :id', [
            'name' => $name, 'school_id' => $bfa, 'subject' => $subject, 'verified' => $verified, 'now' => $now, 'id' => $id,
        ]);
    }
    $teacherIds[$email] = $id;
}
echo '[seed] ' . count($teacherIds) . " teachers (password " . TEACHER_PASSWORD . ")\n";

// ------------------------------------------------------------------ students (BFA)

$seeds = [
    ['Chinedu Okeke', 'Male', '2013-04-12', 'JSS2', 'JSS1', 2025],
    ['Aisha Bello', 'Female', '2012-08-03', 'JSS3', 'JSS2', 2025],
    ['Tunde Adeyemi', 'Male', '2011-01-27', 'SS1', 'JSS3', 2025],
    ['Ngozi Eze', 'Female', '2010-11-19', 'SS2', 'SS1', 2025],
    ['Emeka Obi', 'Male', '2009-06-30', 'SS3', 'SS2', 2025],
    ['Fatima Yusuf', 'Female', '2013-09-15', 'JSS1', 'JSS1', 2026],
    ['Bola Ogunleye', 'Male', '2012-02-08', 'JSS2', 'JSS1', 2025],
    ['Kelechi Nwankwo', 'Male', '2011-12-05', 'JSS3', 'JSS1', 2024],
    ['Zainab Musa', 'Female', '2010-03-22', 'SS1', 'SS1', 2026],
    ['Samuel Johnson', 'Male', '2009-07-11', 'SS2', 'SS1', 2025],
    ['Grace Adeleke', 'Female', '2008-10-02', 'SS3', 'SS1', 2024],
    ['Ibrahim Sani', 'Male', '2013-05-18', 'JSS1', 'JSS1', 2026],
];

$sequences = [];
foreach ($seeds as [$name, $gender, $dob, $class, $entryClass, $year]) {
    $key = 'BFA:' . $year;
    $sequences[$key] = ($sequences[$key] ?? 0) + 1;
    $seq = $sequences[$key];
    $studentId = sprintf('BFA/%d/%03d', $year, $seq);
    $existing = Db::one('SELECT id FROM students WHERE student_id = :sid', ['sid' => $studentId]);
    $id = $existing['id'] ?? Ids::newId();
    $history = buildStudentHistory($studentId, $class, $entryClass, $year);
    $row = [
        'id' => $id,
        'school_id' => $bfa,
        'student_id' => $studentId,
        'full_name' => $name,
        'gender' => $gender,
        'dob' => $dob,
        'current_class' => $class,
        'password' => Password::hash(STUDENT_PASSWORD),
        'historical_results' => json_encode($history, JSON_UNESCAPED_UNICODE),
        'created_at' => $year . '-09-01T08:00:00.000Z',
        'updated_at' => $now,
    ];
    if ($existing === null) {
        Db::insert('students', $row);
    } else {
        Db::run('UPDATE students SET full_name = :full_name, gender = :gender, dob = :dob, current_class = :current_class, historical_results = :historical_results, updated_at = :now WHERE id = :id', [
            'full_name' => $name, 'gender' => $gender, 'dob' => $dob, 'current_class' => $class,
            'historical_results' => $row['historical_results'], 'now' => $now, 'id' => $id,
        ]);
    }
    // Keep the enrollment counter ahead of the seeded IDs.
    Db::run(
        'INSERT INTO counters (key, seq) VALUES (:key, :seq)
         ON CONFLICT (key) DO UPDATE SET seq = MAX(seq, excluded.seq)',
        ['key' => $key, 'seq' => $seq],
    );
}
echo '[seed] ' . count($seeds) . ' students with historical results (password/PIN ' . STUDENT_PASSWORD . ")\n";

// ------------------------------------------------------------------ pending assessments (BFA)

$pendingSets = [
    ['SS1', 'Physics', 'danjuma@brightfuture.edu'],
    ['JSS2', 'English Language', 'okafor@brightfuture.edu'],
];
$term = 'First Term';
$session = Clock::defaultSession();

foreach ($pendingSets as [$class, $subject, $teacherEmail]) {
    $students = Db::all('SELECT * FROM students WHERE school_id = :school AND current_class = :cls ORDER BY full_name ASC', [
        'school' => $bfa, 'cls' => $class,
    ]);
    $rnd = makeRng(crc32($bfa . $class . $subject));
    foreach ($students as $student) {
        $exists = Db::one(
            'SELECT id FROM assessments WHERE school_id = :school AND class_id = :classId AND subject = :subject AND student_ref = :ref AND term = :term AND session = :session',
            ['school' => $bfa, 'classId' => $classIds[$class], 'subject' => $subject, 'ref' => $student['id'], 'term' => $term, 'session' => $session],
        );
        if ($exists !== null) {
            continue;
        }
        $ca1 = (int) floor($rnd() * 16) + 5;
        $ca2 = (int) floor($rnd() * 16) + 5;
        $exam = (int) floor($rnd() * 36) + 25;
        $total = Grading::computeTotal($ca1, $ca2, $exam);
        Db::insert('assessments', [
            'id' => Ids::newId(),
            'school_id' => $bfa,
            'class_id' => $classIds[$class],
            'class_name' => $class,
            'subject' => $subject,
            'teacher_id' => $teacherIds[$teacherEmail],
            'teacher_email' => $teacherEmail,
            'student_ref' => $student['id'],
            'student_id' => $student['student_id'],
            'ca1' => $ca1,
            'ca2' => $ca2,
            'exam' => $exam,
            'total' => $total,
            'grade' => Grading::gradeFor($total),
            'status' => 'Pending Approval',
            'principal_name' => '',
            'term' => $term,
            'session' => $session,
            'submitted_at' => Clock::nowIso(),
            'approved_at' => null,
            'note' => '',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
}
echo "[seed] pending assessments for " . count($pendingSets) . " class/subject sheets\n";

echo "[seed] done — demo logins:\n";
echo "       owner    : {$ownerEmail} / {$ownerPassword}\n";
echo "       admin    : admin@brightfuture.edu / " . ADMIN_PASSWORD . "\n";
echo "       teacher  : teacher@brightfuture.edu / " . TEACHER_PASSWORD . "\n";
echo "       student  : BFA/2026/001 (or BFA/2025/001 …) / " . STUDENT_PASSWORD . "\n";

// ------------------------------------------------------------------ helpers

function makeRng(int $seed): Closure
{
    $s = $seed & 0xFFFFFFFF;
    return static function () use (&$s): float {
        $s = (int) ((($s * 1664525) + 1013904223) & 0xFFFFFFFF);
        return ($s & 0xFFFFFFFF) / 4294967296;
    };
}

/**
 * Deterministic result history (mirrors the front-end demo generator) so the
 * student portal has something to show before the current term is approved.
 */
function buildStudentHistory(string $studentId, string $class, string $entryClass, int $year): array
{
    global $CLASS_SUBJECTS, $FORM_TEACHERS;

    $levels = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];
    $terms = ['First Term', 'Second Term', 'Third Term'];
    $startIdx = max(0, (int) array_search($entryClass, $levels, true));
    $endIdx = max($startIdx, (int) array_search($class, $levels, true));
    $classSize = 30 + (int) floor(makeRng(crc32($studentId . 'size'))() * 15);
    $rnd = makeRng(crc32($studentId));

    $history = [];
    for ($y = 0; $y <= $endIdx - $startIdx; $y++) {
        $level = $levels[min($startIdx + $y, count($levels) - 1)];
        $sessionYear = $year + $y;
        $session = $sessionYear . '/' . ($sessionYear + 1);
        foreach ($terms as $term) {
            $subjects = [];
            $sum = 0;
            foreach ($CLASS_SUBJECTS[$level] as $subject) {
                $ca = 12 + (int) floor($rnd() * 26);
                $ca1 = (int) floor($ca / 2);
                $ca2 = $ca - $ca1;
                $exam = 28 + (int) floor($rnd() * 30);
                $total = Grading::computeTotal($ca1, $ca2, $exam);
                $sum += $total;
                $subjects[] = [
                    'subject' => $subject,
                    'ca1' => $ca1,
                    'ca2' => $ca2,
                    'exam' => $exam,
                    'total' => $total,
                    'grade' => Grading::gradeFor($total),
                ];
            }
            $count = count($subjects);
            $average = round($sum / $count, 1);
            $history[] = [
                'session' => $session,
                'year' => $sessionYear,
                'term' => $term,
                'cls' => $level,
                'subjects' => $subjects,
                'total' => $sum,
                'average' => $average,
                'position' => 1 + (int) floor($rnd() * min($classSize, $count * 3)),
                'classSize' => $classSize,
                'attendance' => ['total' => 116, 'present' => 96 + (int) floor($rnd() * 21)],
                'remark' => Grading::remarkFor((int) round($average)),
                'principalName' => 'A. Bello',
                'classTeacherName' => $FORM_TEACHERS[$level] ?? '',
            ];
        }
    }
    return $history;
}
