"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Target,
  AlertCircle,
  BarChart3,
  Settings,
  LogOut,
  Briefcase,
  FileText,
  Shield,
  ChevronRight,
  Upload,
} from "lucide-react";
import { cn, Button } from "./ui";
import { clearTokens } from "@/lib/api";
import { User } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: string[];
  children?: { href: string; label: string }[];
};

const mainNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "bd", "engineer"] },
  { href: "/leads", label: "Leads", icon: Briefcase, roles: ["admin", "manager", "bd", "engineer"] },
  { href: "/monthly-targets", label: "Monthly Targets", icon: Target, roles: ["admin", "manager", "engineer"] },
  { href: "/profiles", label: "Profiles", icon: Users, roles: ["admin", "manager"] },
  {
    href: "/teams",
    label: "Teams",
    icon: Users,
    roles: ["admin", "manager"],
    children: [
      { href: "/teams/engineering", label: "Engineering Team" },
      { href: "/teams/bd", label: "BD Team" },
    ],
  },
  { href: "/issues", label: "Issues", icon: AlertCircle, roles: ["admin", "manager", "bd", "engineer"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager"] },
];

const adminNav: NavItem[] = [
  { href: "/admin/users", label: "Users", icon: Users, roles: ["admin"] },
  { href: "/admin/import", label: "Data Import", icon: Upload, roles: ["admin"] },
  { href: "/admin/status-config", label: "Status Config", icon: FileText, roles: ["admin"] },
  { href: "/admin/audit", label: "Audit Log", icon: Shield, roles: ["admin"] },
  { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const hasChildren = !!item.children?.length;
  const sectionActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const active = hasChildren ? sectionActive : pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <div>
      <Link
        href={hasChildren ? item.children![0].href : item.href}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
          active
            ? "bg-brand-600 text-white shadow-sm"
            : "text-slate-400 hover:bg-slate-800 hover:text-white"
        )}
      >
        <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
        <span className="flex-1">{item.label}</span>
        {active && <ChevronRight className={cn("h-4 w-4 opacity-70 transition", sectionActive && hasChildren && "rotate-90")} />}
      </Link>
      {hasChildren && sectionActive && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-800 pl-3">
          {item.children!.map((child) => {
            const childActive = pathname === child.href;
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "block rounded-md px-3 py-2 text-xs font-medium transition",
                  childActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-200"
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const filteredMain = mainNav.filter((i) => i.roles.includes(user.role));
  const filteredAdmin = adminNav.filter((i) => i.roles.includes(user.role));

  const logout = () => {
    clearTokens();
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <aside className="flex h-screen w-[260px] shrink-0 flex-col bg-slate-950 text-white">
      <div className="border-b border-slate-800 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white shadow-lg shadow-brand-600/30">
            LP
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">LeadPro</h1>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Business Development</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Main</p>
          <div className="space-y-0.5">
            {filteredMain.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        </div>
        {filteredAdmin.length > 0 && (
          <div>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Administration</p>
            <div className="space-y-0.5">
              {filteredAdmin.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-900/80 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold">
            {user.full_name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.full_name}</p>
            <p className="flex items-center gap-1.5 text-xs capitalize text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {user.role.replace("_", " ")}
            </p>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-2 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={logout}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </aside>
  );
}
