"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { Button, Spinner } from "@/components/ui";
import { api, clearTokens, getToken } from "@/lib/api";
import { User } from "@/lib/types";

function readStoredUser(): User | null {
  try {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const cached = readStoredUser();
    if (cached) setUser(cached);

    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled && !cached) setAuthError(true);
    }, 8000);

    api<User>("/auth/me")
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        localStorage.setItem("user", JSON.stringify(u));
        setAuthError(false);
      })
      .catch(() => {
        if (cancelled) return;
        clearTokens();
        router.replace("/login");
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [router]);

  if (authError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <p className="text-sm text-slate-600">Could not connect to the LeadPro API.</p>
        <p className="text-xs text-slate-400">Make sure the backend is running on port 8000.</p>
        <Button
          onClick={() => {
            clearTokens();
            window.location.href = "/login";
          }}
        >
          Back to Login
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <Spinner />
        <p className="text-sm text-slate-500">Loading LeadPro...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto">
          <div className="page-container">{children}</div>
        </main>
      </div>
    </div>
  );
}
