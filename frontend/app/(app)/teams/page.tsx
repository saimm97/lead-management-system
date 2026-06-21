"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";

export default function TeamsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    let target = "/teams/engineering";
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const user = JSON.parse(stored) as { manager_type?: string };
        if (user.manager_type === "bd_manager") target = "/teams/bd";
      }
    } catch {
      /* use default */
    }
    router.replace(target);
  }, [router]);

  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}
