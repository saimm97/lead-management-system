import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-slate-200">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">LP</div>
          <span className="font-semibold">LeadPro</span>
        </div>
        <p className="text-sm text-slate-400">© {new Date().getFullYear()} LeadPro. All rights reserved.</p>
        <div className="flex gap-6 text-sm text-slate-500">
          <Link href="/login" className="hover:text-slate-900">Sign in</Link>
          <Link href="/register" className="hover:text-slate-900">Create account</Link>
        </div>
      </div>
    </footer>
  );
}
