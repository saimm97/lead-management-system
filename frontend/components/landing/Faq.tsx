"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "Is LeadPro free to use?",
    a: "Yes — LeadPro is self-hosted, so there's no per-seat license fee. You run it on your own infrastructure and control your own data.",
  },
  {
    q: "Can I import my existing leads?",
    a: "Yes. Admins can bulk-import leads, profiles and users from an Excel spreadsheet using the built-in import tool, with a downloadable template for the expected columns.",
  },
  {
    q: "What roles are supported?",
    a: "Admin, Manager, BD and Engineer — each with a focused view and permission set. Managers can approve new registrations and configure statuses; BDs and Engineers see only what's relevant to their work.",
  },
  {
    q: "Does it integrate with Google Calendar?",
    a: "Yes — connect a Google account once, and LeadPro can create interview invites that are emailed to attendees and added to their calendar automatically.",
  },
  {
    q: "How is my data secured?",
    a: "Access is role-based and every sensitive action is written to an audit log. Since it's self-hosted, your lead and candidate data never leaves infrastructure you control.",
  },
  {
    q: "Can I customize the pipeline stages?",
    a: "Yes — lead statuses, dropdown options and pipeline phases are configurable by Admins, so LeadPro can match how your team already works.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Frequently asked questions</h2>
        <p className="mt-4 text-lg text-slate-500">Everything you need to know before you get started.</p>
      </div>
      <div className="mt-12 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-card">
        {FAQS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={item.q}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="font-medium text-slate-900">{item.q}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <p className="px-6 pb-5 text-sm leading-relaxed text-slate-500">{item.a}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
