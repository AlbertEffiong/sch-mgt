import type {
  Assessment,
  AssessmentStatus,
  AuthUser,
  BroadsheetEntry,
  LoginResponse,
  OwnerDashboard,
  Page,
  Role,
  School,
  SchoolClass,
  Student,
  StudentResult,
  SubscriptionLog,
  Teacher,
  Term,
} from "@/lib/types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const CSRF_COOKIE = "csrfToken";
const CSRF_HEADER = "x-csrf-token";

let bearerToken: string | null = null;

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, status: number, code = "API_ERROR", details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const item = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

function queryString(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const value = search.toString();
  return value ? `?${value}` : "";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const csrf = readCookie(CSRF_COOKIE);
  if (csrf) headers.set(CSRF_HEADER, csrf);
  if (bearerToken) headers.set("Authorization", `Bearer ${bearerToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      method,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Cannot reach the API server. Confirm the PHP backend is running on port 4000.",
      0,
      "NETWORK_ERROR",
    );
  }

  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body = payload as { error?: { message?: string; code?: string; details?: unknown } } | null;
    throw new ApiError(
      body?.error?.message || `Request failed with status ${response.status}.`,
      response.status,
      body?.error?.code || "HTTP_ERROR",
      body?.error?.details,
    );
  }

  if (response.status === 204 || raw === "") {
    return undefined as T;
  }

  const body = payload as { success?: boolean; data?: T; error?: { message?: string; code?: string; details?: unknown } } | null;
  if (!body || body.success !== true) {
    throw new ApiError(
      body?.error?.message || "The API returned an unexpected response.",
      response.status,
      body?.error?.code || "BAD_RESPONSE",
      body?.error?.details,
    );
  }
  return body.data as T;
}

export const api = {
  setToken(token: string | null) {
    bearerToken = token;
  },

  getToken() {
    return bearerToken;
  },

  login(payload: {
    role: Role;
    email?: string;
    password: string;
    studentId?: string;
    otp?: string;
  }) {
    return request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  me() {
    return request<{ user: AuthUser }>("/api/auth/me");
  },

  logout() {
    return request<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST" });
  },

  registerSchool(payload: {
    name: string;
    email: string;
    password: string;
    uniqueSchoolPrefix: string;
    otp: string;
    principalName?: string;
    planMonthly?: number;
  }) {
    return request<School>("/api/auth/register-school", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  inviteTeacher(payload: { name: string; email: string; subject?: string }) {
    return request<{ teacher: Teacher; otp?: string }>("/api/auth/invite-teacher", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  verifyTeacherOtp(payload: { email: string; otp: string; password: string }) {
    return request<Teacher>("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  ownerDashboard() {
    return request<OwnerDashboard>("/api/owner/dashboard");
  },

  ownerSchools(params: { status?: "Active" | "Expired"; q?: string; page?: number; limit?: number } = {}) {
    return request<Page<School>>(`/api/owner/schools${queryString(params)}`);
  },

  setSchoolStatus(schoolId: string, status: "Active" | "Expired") {
    return request<School>(`/api/owner/schools/${schoolId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  verifyPayment(schoolId: string, reference?: string) {
    return request<School>("/api/owner/verify-payment", {
      method: "POST",
      body: JSON.stringify({ schoolId, reference }),
    });
  },

  rejectPayment(schoolId: string, note?: string) {
    return request<School>("/api/owner/reject-payment", {
      method: "POST",
      body: JSON.stringify({ schoolId, note }),
    });
  },

  ownerPayments(params: { page?: number; limit?: number } = {}) {
    return request<Page<SubscriptionLog>>(`/api/owner/payments${queryString(params)}`);
  },

  ownerSubscriptions(params: { page?: number; limit?: number } = {}) {
    return request<Page<SubscriptionLog>>(`/api/owner/payments${queryString(params)}`);
  },

  getSchool() {
    return request<School>("/api/admin/school");
  },

  updateAcademicSetting(payload: {
    current_session?: string;
    current_term?: Term;
    terms_per_session?: number;
    principalName?: string;
  }) {
    return request<School>("/api/admin/academic-setting", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  listClasses() {
    return request<SchoolClass[]>("/api/admin/classes");
  },

  createClass(payload: { className: string; subjects: string[]; teacherEmail?: string }) {
    return request<SchoolClass>("/api/admin/classes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateClass(classId: string, payload: { className?: string; subjects?: string[]; teacherEmail?: string }) {
    return request<SchoolClass>(`/api/admin/classes/${classId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  deleteClass(classId: string) {
    return request<{ removed: boolean }>(`/api/admin/classes/${classId}`, { method: "DELETE" });
  },

  listStudents(params: { q?: string; currentClass?: string; page?: number; limit?: number } = {}) {
    return request<Page<Student>>(`/api/admin/students${queryString(params)}`);
  },

  enrollStudent(payload: {
    fullName: string;
    gender: "Male" | "Female";
    dob: string;
    currentClass: string;
    password: string;
    guardianName?: string;
    guardianPhone?: string;
    address?: string;
  }) {
    return request<Student>("/api/admin/students", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateStudent(
    studentId: string,
    payload: {
      fullName?: string;
      gender?: "Male" | "Female";
      dob?: string;
      currentClass?: string;
      guardianName?: string;
      guardianPhone?: string;
      address?: string;
    },
  ) {
    return request<Student>(`/api/admin/students/${studentId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  deleteStudent(studentId: string) {
    return request<{ removed: boolean }>(`/api/admin/students/${studentId}`, { method: "DELETE" });
  },

  resetStudentPassword(studentId: string, password: string) {
    return request<Student>(`/api/admin/students/${studentId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },

  listTeachers(params: { page?: number; limit?: number } = {}) {
    return request<Page<Teacher>>(`/api/admin/teachers${queryString(params)}`);
  },

  updateTeacher(teacherId: string, payload: { name?: string; subject?: string; status?: string }) {
    return request<Teacher>(`/api/admin/teachers/${teacherId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  deleteTeacher(teacherId: string) {
    return request<{ removed: boolean }>(`/api/admin/teachers/${teacherId}`, { method: "DELETE" });
  },

  listAssessments(params: { status?: AssessmentStatus | "all"; page?: number; limit?: number } = {}) {
    return request<Page<Assessment>>(`/api/admin/pending-assessments${queryString(params)}`);
  },

  reviewAssessment(assessmentId: string, action: "approve" | "reject", note?: string) {
    return request<Assessment>("/api/admin/pending-assessments", {
      method: "POST",
      body: JSON.stringify({ assessmentId, action, note }),
    });
  },

  submitBankTransfer(reference: string, amount: number) {
    return request<School>("/api/admin/subscription/bank-transfer", {
      method: "POST",
      body: JSON.stringify({ reference, amount }),
    });
  },

  subscriptionLogs() {
    return request<SubscriptionLog[]>("/api/admin/subscription/logs");
  },

  teacherClasses() {
    return request<SchoolClass[]>("/api/teacher/classes-subjects");
  },

  roster(classId: string) {
    return request<Student[]>(`/api/teacher/roster${queryString({ classId })}`);
  },

  broadsheet(params: { classId: string; subject: string; term: Term; session: string }) {
    return request<Assessment[]>(`/api/teacher/broadsheet${queryString(params)}`);
  },

  saveBroadsheet(payload: {
    classId: string;
    subject: string;
    term: Term;
    session: string;
    entries: Array<{ studentId: string; ca1: number; ca2: number; exam: number }>;
  }) {
    return request<{ saved: number }>("/api/teacher/broadsheet/save", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  submitBroadsheet(payload: {
    classId: string;
    subject: string;
    term: Term;
    session: string;
    principalName?: string;
  }) {
    return request<{ submitted: number; principalName: string }>("/api/teacher/broadsheet/submit", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  studentResults(params: { term?: Term; session?: string } = {}) {
    return request<StudentResult>(`/api/student/results${queryString(params)}`);
  },
};

export function toEntries(rows: Array<{ studentId: string; ca1: number | ""; ca2: number | ""; exam: number | "" }>): BroadsheetEntry[] {
  return rows.map((row) => ({
    studentId: row.studentId,
    ca1: row.ca1,
    ca2: row.ca2,
    exam: row.exam,
  }));
}
