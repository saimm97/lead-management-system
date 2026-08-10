import { AuthLink } from "./AuthLink";

export function CTA() {
  return (
    <section className="px-6 pb-24">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-slate-950 px-8 py-16 text-center text-white shadow-2xl">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to run a tighter pipeline?</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">Create an account and start tracking leads, targets and performance in minutes.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <AuthLink variant="cta" />
        </div>
      </div>
    </section>
  );
}
