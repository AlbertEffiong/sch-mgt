import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/layout.css";
import "./styles/pages.css";
import "./styles/print.css";
import "./styles/app.css";

export const metadata: Metadata = {
  title: {
    default: "Syntax SaaS — School Management Platform",
    template: "%s · Syntax SaaS",
  },
  description:
    "Multi-tenant school management for owners, administrators, teachers, students and parents. Results, enrollment and subscriptions in one secure workspace.",
  applicationName: "Syntax SaaS",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
