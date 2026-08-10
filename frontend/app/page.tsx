import type { Metadata } from "next";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Roles } from "@/components/landing/Roles";
import { ReportsShowcase } from "@/components/landing/ReportsShowcase";
import { Integrations } from "@/components/landing/Integrations";
import { Faq } from "@/components/landing/Faq";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "LeadPro — Business Development Lead Management Platform",
  description:
    "End-to-end lead management for BD teams, engineers and managers — pipeline tracking, role-based access, Google Calendar invites, AI CV optimization and real-time reporting.",
  openGraph: {
    title: "LeadPro — Business Development Lead Management Platform",
    description: "Manage leads, track pipeline, close deals — with targets, profiles, calendar invites, AI CV tooling and real-time reporting.",
    type: "website",
  },
};

// This page is a server component — only the small auth-aware islands
// (Header, AuthLink, Faq accordion) opt into client rendering, so the bulk
// of the landing page ships as static HTML for faster first paint and SEO.
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />
      <Hero />
      <Features />
      <HowItWorks />
      <Roles />
      <ReportsShowcase />
      <Integrations />
      <Faq />
      <CTA />
      <Footer />
    </div>
  );
}
