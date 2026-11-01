import {
  BadgeCheck,
  BookOpen,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  School,
  Settings,
  Upload,
  Users,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const OWNER_NAV: NavItem[] = [
  { href: "/owner", label: "Overview", icon: LayoutDashboard },
  { href: "/owner/schools", label: "Schools", icon: School },
  { href: "/owner/payments", label: "Payments", icon: WalletCards },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/classes", label: "Classes", icon: BookOpen },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/teachers", label: "Teachers", icon: GraduationCap },
  { href: "/admin/approvals", label: "Approvals", icon: BadgeCheck },
  { href: "/admin/subscription", label: "Subscription", icon: CreditCard },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export const TEACHER_NAV: NavItem[] = [
  { href: "/teacher", label: "Workspace", icon: LayoutDashboard },
  { href: "/teacher/broadsheet", label: "Score entry", icon: ClipboardCheck },
  { href: "/teacher/upload", label: "Upload results", icon: Upload },
];

export const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "Report card", icon: FileText },
];
