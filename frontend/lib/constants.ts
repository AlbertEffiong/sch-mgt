import type { Role, Term } from "@/lib/types";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "SaaS Owner",
  admin: "School Admin",
  teacher: "Teacher",
  student: "Student / Parent",
};

export const ROLE_HOME: Record<Role, string> = {
  owner: "/owner",
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
};

export const TERMS: Term[] = ["First Term", "Second Term", "Third Term"];

export const DEMO_CREDENTIALS: Record<Role, { label: string; value: string; hint?: string }[]> = {
  owner: [
    { label: "Email", value: "owner@syntaxsaas.io" },
    { label: "Password", value: "Owner@123" },
  ],
  admin: [
    { label: "Email", value: "admin@brightfuture.edu" },
    { label: "Password", value: "School@123" },
    { label: "Sign-in OTP", value: "081689" },
  ],
  teacher: [
    { label: "Email", value: "teacher@brightfuture.edu" },
    { label: "Password", value: "Teach@123" },
  ],
  student: [
    { label: "Student ID", value: "BFA/2026/001" },
    { label: "Password", value: "Student@123" },
  ],
};

export const BANK_DETAILS = {
  bank: "OPay",
  accountNumber: process.env.NEXT_PUBLIC_OPAY_ACCOUNT_NUMBER || "8168998060",
  accountName: process.env.NEXT_PUBLIC_OPAY_ACCOUNT_NAME || "Albert Effiong",
};

export const REGISTRATION_OTP = process.env.NEXT_PUBLIC_REGISTRATION_OTP || "081689";
export const ADMIN_OTP = process.env.NEXT_PUBLIC_ADMIN_OTP || "081689";

export const SESSION_OPTIONS = (() => {
  const year = new Date().getFullYear();
  return [-2, -1, 0, 1].map((offset) => {
    const start = year + offset;
    return `${start}/${start + 1}`;
  });
})();

export const CLASS_LEVEL_SUGGESTIONS = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];

export const SUBJECT_SUGGESTIONS = [
  "Mathematics",
  "English Language",
  "Basic Science",
  "Social Studies",
  "Civic Education",
  "Computer Studies",
  "Physics",
  "Chemistry",
  "Biology",
  "Further Mathematics",
  "Economics",
  "Agricultural Science",
];
