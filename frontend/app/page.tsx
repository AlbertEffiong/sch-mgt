"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/constants";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? ROLE_HOME[user.role] : "/login");
  }, [loading, router, user]);

  return (
    <div className="loading-panel" style={{ minHeight: "100vh" }}>
      <span className="spinner dark" aria-hidden="true" />
      Opening Syntax…
    </div>
  );
}
