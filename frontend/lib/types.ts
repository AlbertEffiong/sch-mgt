export type Role = "owner" | "admin" | "teacher" | "student";

export type SubscriptionStatus = "Active" | "Expired";
export type Term = "First Term" | "Second Term" | "Third Term";
export type AssessmentStatus = "Pending Approval" | "Approved" | "Revised";
export type TeacherStatus = "Active" | "On Leave" | "Inactive";

export interface AcademicSettings {
  currentSession: string;
  currentTerm: Term;
  termsPerSession: number;
}

export interface PendingPayment {
  reference: string;
  amount: number;
  submittedAt: string | null;
  status: "pending" | "verified" | "rejected";
}

export interface School {
  id: string;
  name: string;
  email: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: string | null;
  uniqueSchoolPrefix: string;
  principalName: string;
  planMonthly: number;
  academic: AcademicSettings;
  hasPendingPayment: boolean;
  pendingPayment: PendingPayment | null;
  createdAt: string | null;
  isActive?: boolean;
  studentCount?: number;
}

export interface Owner {
  id: string;
  name: string;
  email: string;
}

export interface Teacher {
  id: string;
  schoolId: string;
  name: string;
  email: string;
  subject: string | null;
  status: TeacherStatus;
  verified: boolean;
  createdAt: string | null;
}

export interface Student {
  id: string;
  studentId: string;
  fullName: string;
  gender: "Male" | "Female";
  dob: string;
  currentClass: string;
  guardianName?: string | null;
  guardianPhone?: string | null;
  address?: string | null;
  createdAt?: string | null;
}

export interface SchoolClass {
  id: string;
  className: string;
  subjects: string[];
  teacherEmail?: string;
}

export interface Assessment {
  id: string;
  classId: string;
  className: string;
  subject: string;
  teacherEmail: string;
  studentId: string;
  ca1: number;
  ca2: number;
  exam: number;
  total: number;
  grade: string;
  status: AssessmentStatus;
  principalName: string;
  term: Term;
  session: string;
  submittedAt: string | null;
  approvedAt: string | null;
  note: string | null;
}

export interface SubscriptionLog {
  id: number;
  schoolId: string;
  reference: string;
  amount: number;
  status: "pending" | "verified" | "rejected";
  note: string | null;
  createdAt: string | null;
  verifiedAt: string | null;
  schoolName?: string;
}

export interface AuthUser {
  id: string;
  role: Role;
  schoolId: string | null;
  email: string | null;
  name?: string;
  profile?: Owner | School | Teacher | Student;
  school?: School | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface OwnerDashboard {
  mrr: number;
  totalSchools: number;
  activeSchools: number;
  expiredSchools: number;
  totalStudents: number;
  activeSubscriptions: number;
  pendingPayments: number;
}

export interface LoginResponse {
  user: AuthUser | Owner | School | Teacher | Student;
  token: string;
  csrfToken: string;
}

export interface ResultSubject {
  subject: string;
  ca1: number;
  ca2: number;
  exam: number;
  total: number;
  grade: string;
  remark: string;
  teacherName: string;
}

export interface StudentResult {
  schoolId: string;
  school: {
    name: string;
    uniqueSchoolPrefix: string;
    principalName: string;
  };
  student: {
    id: string;
    studentId: string;
    fullName: string;
    gender: string;
    currentClass: string;
  };
  term: Term;
  session: string;
  subjects: ResultSubject[];
  total: number;
  average: number;
  position: number;
  classSize: number;
  principalName: string;
  classTeacherName: string;
  attendance?: { total: number; present: number } | null;
  remark?: string;
  published: boolean;
}

export interface BroadsheetEntry {
  studentId: string;
  ca1: number | "";
  ca2: number | "";
  exam: number | "";
}
