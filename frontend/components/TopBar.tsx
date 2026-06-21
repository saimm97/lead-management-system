"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { cn } from "./ui";
import { User } from "@/lib/types";

const teamSubNav = [
  { href: "/teams/engineering", label: "Engineering Team" },
  { href: "/teams/bd", label: "BD Team" },
];

export function TopBar({ user }: { user: User }) {
  const pathname = usePathname();
  const roleLabel = user.role.replace("_", " ");
  const onTeams = pathname.startsWith("/teams");

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-md lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {onTeams ? (
          <nav className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {teamSubNav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? "bg-white text-brand-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : (
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search leads, contacts, accounts..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 md:ml-auto">
        <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-slate-900">{user.full_name}</p>
          <p className="text-xs capitalize text-slate-500">
            {user.manager_type ? user.manager_type.replace("_", " ") : roleLabel}
            {user.tenant_id ? " · Devsinc" : ""}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
          {user.full_name.charAt(0)}
        </div>
      </div>
    </header>
  );
}
