import { Badge, Card } from "@/components/ui";

export type TechShare = {
  name: string;
  mentions: number;
  percent: number;
};

export type EngineerSuggestion = {
  id: number;
  name: string;
  devsinc_id: string | null;
  match_percent: number;
  technologies: string[];
};

function showPercent(value: number): string {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function JobTechMatch({
  techStack,
  engineers,
}: {
  techStack: TechShare[];
  engineers: EngineerSuggestion[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-slate-900">Tech stack required</h3>
          <p className="mt-1 text-xs text-slate-500">Share of the skills named in this posting.</p>
        </div>
        {techStack.length === 0 ? (
          <p className="text-sm text-slate-500">This posting does not name a specific tech stack.</p>
        ) : (
          <ul className="space-y-4">
            {techStack.map((tech, index) => (
              <li key={tech.name} className="grid grid-cols-[1.5rem_minmax(0,1fr)_4.5rem] items-center gap-3">
                <span className="text-xs tabular-nums text-slate-400">{index + 1}</span>
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium text-slate-900">{tech.name}</span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {tech.mentions} mention{tech.mentions === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, tech.percent)}%` }} />
                  </div>
                </div>
                <span className="text-right text-sm font-semibold tabular-nums text-slate-900">{showPercent(tech.percent)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="xl:col-span-2">
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-slate-900">Suggested engineers</h3>
          <p className="mt-1 text-xs text-slate-500">Coverage of the stack above.</p>
        </div>
        {engineers.length === 0 ? (
          <p className="text-sm text-slate-500">No engineer in the pipeline covers this stack yet.</p>
        ) : (
          <ul className="space-y-4">
            {engineers.map((engineer) => (
              <li key={engineer.id} className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                  {initials(engineer.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{engineer.name}</p>
                      {engineer.devsinc_id && (
                        <p className="text-xs text-slate-400">{engineer.devsinc_id}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-brand-700">
                      {showPercent(engineer.match_percent)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, engineer.match_percent)}%` }} />
                  </div>
                  {engineer.technologies.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {engineer.technologies.map((tech) => (
                        <Badge key={tech} variant="green">{tech}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
