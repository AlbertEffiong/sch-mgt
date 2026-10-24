<?php

declare(strict_types=1);

namespace Syntax;

use Syntax\Http\Request;
use Syntax\Http\Response;
use Syntax\Support\Serialize;
use Syntax\Support\Session;

/**
 * Route table consumed by App::__construct().
 *
 * Every entry is [method, path, middleware, validations, handler].
 * Middleware names resolve in App::resolveMiddleware():
 *   authRate | auth | role:<role> | tenant | load | sub
 *
 * @return array<int, array{0: string, 1: string, 2: array<int, string>, 3: array<int, array>, 4: callable}>
 */
function buildRoutes(App $app): array
{
    $routes = [];
    $add = static function (string $method, string $path, array $middleware, array $validations, callable $handler) use (&$routes): void {
        $routes[] = [$method, $path, $middleware, $validations, $handler];
    };

    // ---------------------------------------------------------------- shared helpers

    /** Issue JWT + CSRF cookies and return the login payload. */
    $login = static function (array $credentials) use ($app): Response {
        $result = $app->auth->login($credentials);
        $response = Response::ok($result);
        $session = Session::establish($response, $result['token']);
        $response->body = ['success' => true, 'data' => array_merge($result, $session)];
        return $response;
    };

    /** Rich profile for /api/auth/me, hydrated from the JWT claims. */
    $profile = static function (array $claims): array {
        $base = [
            'id' => (string) ($claims['id'] ?? ''),
            'role' => (string) ($claims['role'] ?? ''),
            'schoolId' => $claims['schoolId'] ?? null,
            'email' => $claims['email'] ?? null,
        ];
        $row = match ($base['role']) {
            'owner' => Db::one('SELECT * FROM owners WHERE id = :id', ['id' => $base['id']]),
            'admin' => Db::one('SELECT * FROM schools WHERE id = :id', ['id' => $base['id']]),
            'teacher' => Db::one('SELECT * FROM teachers WHERE id = :id', ['id' => $base['id']]),
            'student' => Db::one('SELECT * FROM students WHERE id = :id', ['id' => $base['id']]),
            default => null,
        };
        if ($row === null) {
            return $base;
        }
        $base['email'] = (string) ($row['email'] ?? $row['student_id'] ?? $base['email']);
        $base['name'] = (string) ($row['name'] ?? $row['full_name'] ?? '');
        $base['profile'] = match ($base['role']) {
            'owner' => Serialize::owner($row),
            'admin' => Serialize::school($row),
            'teacher' => Serialize::teacher($row),
            'student' => Serialize::student($row) + ['schoolId' => $row['school_id']],
            default => [],
        };
        return $base;
    };

    $objectid = ['type' => 'string', 'objectid' => true];
    $termRule = ['type' => 'string', 'enum' => ['First Term', 'Second Term', 'Third Term']];
    $sessionRule = ['type' => 'string', 'regex' => '/^\d{4}\/\d{4}$/', 'regexMessage' => 'Session must look like 2025/2026.'];
    $pageRules = [
        'page' => ['type' => 'int', 'optional' => true, 'min' => 1],
        'limit' => ['type' => 'int', 'optional' => true, 'min' => 1, 'max' => 100],
    ];

    $adminScope = ['auth', 'role:admin', 'tenant', 'load'];
    $teacherScope = ['auth', 'role:teacher', 'tenant', 'load', 'sub'];
    $ownerScope = ['auth', 'role:owner'];

    // ---------------------------------------------------------------- health

    $add('GET', '/health', [], [], static fn(): Response => Response::ok([
        'status' => 'ok',
        'service' => 'syntax-saas-api',
        'time' => \Syntax\Support\Clock::nowIso(),
    ]));

    $add('GET', '/ready', [], [], static function (): Response {
        Db::value('SELECT 1');
        return Response::ok(['status' => 'ready', 'database' => 'sqlite']);
    });

    // ---------------------------------------------------------------- auth

    $add('POST', '/api/auth/register-school', ['authRate'], [
        'body' => [
            'name' => ['type' => 'string', 'min' => 2, 'max' => 120],
            'email' => ['type' => 'string', 'email' => true, 'lower' => true],
            'password' => ['type' => 'string', 'password' => true],
            'uniqueSchoolPrefix' => ['type' => 'string', 'regex' => '/^[A-Za-z]{2,6}$/', 'regexMessage' => 'School prefix must be 2-6 letters.', 'upper' => true],
            'otp' => ['type' => 'string', 'regex' => '/^\d{6}$/', 'regexMessage' => 'OTP must be a 6-digit code.'],
            'principalName' => ['type' => 'string', 'optional' => true, 'max' => 120],
            'planMonthly' => ['type' => 'number', 'optional' => true, 'min' => 0],
            'subscriptionStatus' => ['type' => 'string', 'optional' => true, 'enum' => ['Active', 'Expired']],
        ],
    ], static function (Request $r) use ($app): Response {
        return Response::created($app->auth->registerSchool($r->body), 'School registered successfully.');
    });

    $add('POST', '/api/auth/login', ['authRate'], [
        'body' => [
            'role' => ['type' => 'string', 'enum' => ['owner', 'admin', 'teacher', 'student']],
            'email' => ['type' => 'string', 'email' => true, 'optional' => true, 'lower' => true],
            'password' => ['type' => 'string'],
            'studentId' => ['type' => 'string', 'optional' => true],
            'otp' => ['type' => 'string', 'optional' => true, 'regex' => '/^\d{6}$/', 'regexMessage' => 'OTP must be a 6-digit code.'],
        ],
    ], static fn(Request $r) => $login($r->body));

    $add('POST', '/api/auth/invite-teacher', $adminScope, [
        'body' => [
            'name' => ['type' => 'string', 'min' => 2, 'max' => 120],
            'email' => ['type' => 'string', 'email' => true, 'lower' => true],
            'subject' => ['type' => 'string', 'optional' => true, 'max' => 120],
        ],
    ], static function (Request $r) use ($app): Response {
        $result = $app->auth->inviteTeacher(
            ['schoolId' => $r->tenantSchoolId],
            $r->body,
        );
        return Response::created($result, 'Teacher invited. An activation code was sent to their email.');
    });

    $add('POST', '/api/auth/verify-otp', ['authRate'], [
        'body' => [
            'email' => ['type' => 'string', 'email' => true, 'lower' => true],
            'otp' => ['type' => 'string', 'regex' => '/^\d{6}$/', 'regexMessage' => 'OTP must be a 6-digit code.'],
            'password' => ['type' => 'string', 'password' => true],
        ],
    ], static function (Request $r) use ($app): Response {
        return Response::ok($app->auth->verifyOtp($r->body), 'Teacher account activated.');
    });

    $add('GET', '/api/auth/me', ['auth'], [], static function (Request $r) use ($profile): Response {
        return Response::ok(['user' => $profile($r->user ?? [])]);
    });

    $add('POST', '/api/auth/logout', [], [], static function (): Response {
        $response = Response::ok(['loggedOut' => true]);
        Session::clear($response);
        return $response;
    });

    // ---------------------------------------------------------------- owner (SaaS console)

    $add('GET', '/api/owner/dashboard', $ownerScope, [], static fn() => Response::ok($app->owner->dashboard()));

    $add('GET', '/api/owner/schools', $ownerScope, [
        'query' => $pageRules + [
            'status' => ['type' => 'string', 'optional' => true, 'enum' => ['Active', 'Expired']],
            'q' => ['type' => 'string', 'optional' => true, 'max' => 120],
        ],
    ], static fn(Request $r) => Response::ok($app->owner->listSchools($r->query)));

    $add('PATCH', '/api/owner/schools/{id}/status', $ownerScope, [
        'params' => ['id' => $objectid],
        'body' => ['status' => ['type' => 'string', 'enum' => ['Active', 'Expired', 'active', 'expired']]],
    ], static function (Request $r) use ($app): Response {
        $status = strtolower($r->body['status']) === 'active' ? 'Active' : 'Expired';
        return Response::ok($app->owner->setSchoolStatus($r->params['id'], $status));
    });

    $add('POST', '/api/owner/verify-payment', $ownerScope, [
        'body' => [
            'schoolId' => $objectid,
            'reference' => ['type' => 'string', 'optional' => true, 'max' => 120],
        ],
    ], static function (Request $r) use ($app): Response {
        return Response::ok($app->owner->verifyPayment($r->body), 'Payment verified. Subscription renewed.');
    });

    // ---------------------------------------------------------------- school admin

    $add('GET', '/api/admin/school', $adminScope, [], static fn(Request $r) => Response::ok($app->admin->getSchool($r->tenantSchoolId)));

    $add('PATCH', '/api/admin/academic-setting', $adminScope, [
        'body' => [
            'current_session' => ['type' => 'string', 'optional' => true] + $sessionRule,
            'current_term' => ['type' => 'string', 'optional' => true] + $termRule,
            'terms_per_session' => ['type' => 'int', 'optional' => true, 'min' => 1, 'max' => 3],
        ],
    ], static fn(Request $r) => Response::ok($app->admin->updateAcademicSetting($r->tenantSchoolId, $r->body)));

    $add('POST', '/api/admin/classes', $adminScope, [
        'body' => [
            'className' => ['type' => 'string', 'min' => 2, 'max' => 40],
            'subjects' => ['type' => 'array', 'min' => 1, 'items' => ['type' => 'string', 'min' => 2, 'max' => 80]],
            'teacherEmail' => ['type' => 'string', 'email' => true, 'optional' => true, 'lower' => true],
        ],
    ], static function (Request $r) use ($app): Response {
        return Response::created($app->admin->createClass($r->tenantSchoolId, $r->body), 'Class created.');
    });

    $add('GET', '/api/admin/classes', $adminScope, [], static fn(Request $r) => Response::ok($app->admin->listClasses($r->tenantSchoolId)));

    $add('POST', '/api/admin/students', $adminScope, [
        'body' => [
            'fullName' => ['type' => 'string', 'min' => 2, 'max' => 120],
            'gender' => ['type' => 'string', 'enum' => ['Male', 'Female']],
            'dob' => ['type' => 'date'],
            'currentClass' => ['type' => 'string', 'min' => 2, 'max' => 40],
            'password' => ['type' => 'string', 'min' => 4, 'max' => 128],
        ],
    ], static function (Request $r) use ($app): Response {
        return Response::created($app->admin->enrollStudent($r->tenantSchoolId, $r->body), 'Student enrolled.');
    });

    $add('GET', '/api/admin/students', $adminScope, [
        'query' => $pageRules + [
            'currentClass' => ['type' => 'string', 'optional' => true, 'max' => 40],
            'q' => ['type' => 'string', 'optional' => true, 'max' => 120],
        ],
    ], static fn(Request $r) => Response::ok($app->admin->listStudents($r->tenantSchoolId, $r->query)));

    $add('GET', '/api/admin/teachers', $adminScope, [
        'query' => $pageRules,
    ], static fn(Request $r) => Response::ok($app->admin->listTeachers($r->tenantSchoolId, $r->query)));

    $add('PATCH', '/api/admin/teachers/{id}', $adminScope, [
        'params' => ['id' => $objectid],
        'body' => [
            'name' => ['type' => 'string', 'optional' => true, 'min' => 2, 'max' => 120],
            'subject' => ['type' => 'string', 'optional' => true, 'max' => 120],
        ],
    ], static fn(Request $r) => Response::ok($app->admin->updateTeacher($r->tenantSchoolId, $r->params['id'], $r->body)));

    $add('DELETE', '/api/admin/teachers/{id}', $adminScope, [
        'params' => ['id' => $objectid],
    ], static function (Request $r) use ($app): Response {
        $app->admin->removeTeacher($r->tenantSchoolId, $r->params['id']);
        return Response::ok(['removed' => true]);
    });

    $add('GET', '/api/admin/pending-assessments', $adminScope, [
        'query' => $pageRules + [
            'status' => ['type' => 'string', 'optional' => true, 'max' => 40],
        ],
    ], static fn(Request $r) => Response::ok($app->admin->listAssessments($r->tenantSchoolId, $r->query)));

    $add('POST', '/api/admin/pending-assessments', $adminScope, [
        'body' => [
            'assessmentId' => $objectid,
            'action' => ['type' => 'string', 'enum' => ['approve', 'reject']],
            'note' => ['type' => 'string', 'optional' => true, 'max' => 500],
        ],
    ], static fn(Request $r) => Response::ok($app->admin->reviewAssessment($r->tenantSchoolId, $r->body)));

    $add('POST', '/api/admin/subscription/bank-transfer', $adminScope, [
        'body' => [
            'reference' => ['type' => 'string', 'min' => 3, 'max' => 120],
            'amount' => ['type' => 'number', 'min' => 0],
        ],
    ], static function (Request $r) use ($app): Response {
        return Response::ok($app->admin->submitBankTransfer($r->tenantSchoolId, $r->body), 'Receipt submitted for verification.');
    });

    // ---------------------------------------------------------------- teacher

    $add('GET', '/api/teacher/classes-subjects', $teacherScope, [], static fn(Request $r) => Response::ok($app->teacher->classesSubjects($r->tenantSchoolId)));

    $add('GET', '/api/teacher/roster', $teacherScope, [
        'query' => ['classId' => $objectid],
    ], static fn(Request $r) => Response::ok($app->teacher->getRoster($r->tenantSchoolId, $r->query['classId'])));

    $add('GET', '/api/teacher/broadsheet', $teacherScope, [
        'query' => [
            'classId' => $objectid,
            'subject' => ['type' => 'string', 'min' => 2, 'max' => 80],
            'term' => $termRule,
            'session' => $sessionRule,
        ],
    ], static fn(Request $r) => Response::ok($app->teacher->getBroadsheet($r->tenantSchoolId, $r->query)));

    $add('POST', '/api/teacher/broadsheet/save', $teacherScope, [
        'body' => [
            'classId' => $objectid,
            'subject' => ['type' => 'string', 'min' => 2, 'max' => 80],
            'term' => $termRule,
            'session' => $sessionRule,
            'entries' => [
                'type' => 'array',
                'min' => 1,
                'items' => [
                    'studentId' => ['type' => 'string', 'min' => 3, 'max' => 40],
                    'ca1' => ['type' => 'number', 'min' => 0, 'max' => 100],
                    'ca2' => ['type' => 'number', 'min' => 0, 'max' => 100],
                    'exam' => ['type' => 'number', 'min' => 0, 'max' => 100],
                ],
            ],
        ],
    ], static function (Request $r) use ($app): Response {
        return Response::ok($app->teacher->saveBroadsheet($r->user, $r->tenantSchoolId, $r->body));
    });

    $add('POST', '/api/teacher/broadsheet/submit', $teacherScope, [
        'body' => [
            'classId' => $objectid,
            'subject' => ['type' => 'string', 'min' => 2, 'max' => 80],
            'term' => $termRule,
            'session' => $sessionRule,
            'principalName' => ['type' => 'string', 'optional' => true, 'max' => 120],
        ],
    ], static function (Request $r) use ($app): Response {
        return Response::ok($app->teacher->submitBroadsheet($r->user, $r->tenantSchoolId, $r->body), 'Broadsheet submitted for approval.');
    });

    // ---------------------------------------------------------------- student portal

    $add('POST', '/api/student/login', ['authRate'], [
        'body' => [
            'studentId' => ['type' => 'string', 'min' => 3, 'max' => 40],
            'password' => ['type' => 'string'],
        ],
    ], static fn(Request $r) => $login([
        'role' => 'student',
        'studentId' => $r->body['studentId'],
        'password' => $r->body['password'],
    ]));

    $add('GET', '/api/student/results', ['auth', 'role:student', 'tenant', 'load', 'sub'], [
        'query' => [
            'term' => ['type' => 'string', 'optional' => true, 'enum' => ['First Term', 'Second Term', 'Third Term']],
            'session' => ['type' => 'string', 'optional' => true, 'regex' => '/^\d{4}\/\d{4}$/', 'regexMessage' => 'Session must look like 2025/2026.'],
        ],
    ], static fn(Request $r) => Response::ok($app->student->getResults($r->tenantSchoolId, (string) $r->user['id'], $r->query)));

    return $routes;
}
