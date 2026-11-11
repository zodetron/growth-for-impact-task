"use client";

import { useState } from "react";
import { Briefcase, ChevronDown, FileText, MapPin, Clock, Scale } from "lucide-react";
import type { JobRow } from "./model";

export function JobPanel({ job }: { job: JobRow }) {
  const [showJd, setShowJd] = useState(false);
  const [showHow, setShowHow] = useState<string | null>(null);
  const color = job.id === "lca" ? "var(--lca)" : "var(--ux)";
  const p = job.profile;
  return (
    <aside className="card rounded-2xl p-5 sm:p-6 fade-in">
      <div className="eyebrow flex items-center gap-2">
        <span className="size-2 rounded-[3px]" style={{ background: color }} />
        Job profile · {job.source_file}
      </div>
      <h2 className="mt-2 text-[18px] font-extrabold leading-snug tracking-tight">{job.title}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{p.pitch}</p>

      <dl className="mt-4 grid gap-2 text-[13px]">
        <Fact icon={<Briefcase className="size-3.5" />} text={p.company} />
        <Fact icon={<MapPin className="size-3.5" />} text={p.location} />
        <Fact icon={<Clock className="size-3.5" />} text={p.employment} />
        <Fact icon={<Scale className="size-3.5" />} text={`Experience: ${p.experienceBand}`} />
      </dl>

      <Section title="Must-haves">
        <ul className="grid gap-1.5">
          {p.mustHave.map((m) => (
            <li key={m} className="flex gap-2 text-[13px] leading-snug">
              <span className="mt-[7px] size-1 shrink-0 rounded-full" style={{ background: "var(--faint)" }} />
              {m}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Nice to have">
        <div className="flex flex-wrap gap-1.5">
          {p.niceToHave.map((m) => (
            <span key={m} className="tag !h-auto !whitespace-normal !py-1 text-left">
              {m}
            </span>
          ))}
        </div>
      </Section>

      <Section title="How the score is built (100 pts)">
        <div className="grid gap-1">
          {p.criteria.map((c) => (
            <button
              key={c.key}
              onClick={() => setShowHow(showHow === c.key ? null : c.key)}
              className="rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--surface-2)]"
            >
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="font-medium">{c.label}</span>
                <span className="flex items-center gap-1.5 tabular-nums text-muted">
                  {c.weight}
                  <ChevronDown className={`size-3.5 transition-transform ${showHow === c.key ? "rotate-180" : ""}`} />
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                <div className="h-full rounded-full" style={{ width: `${c.weight * 4}%`, background: color }} />
              </div>
              {showHow === c.key && <p className="mt-2 text-xs leading-relaxed text-muted fade-in">{c.how}</p>}
            </button>
          ))}
        </div>
      </Section>

      {job.jd_text && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setShowJd(!showJd)} className="flex w-full items-center justify-between text-[13px] font-medium text-muted hover:text-fg">
            <span className="flex items-center gap-2">
              <FileText className="size-3.5" /> Original job description
            </span>
            <ChevronDown className={`size-4 transition-transform ${showJd ? "rotate-180" : ""}`} />
          </button>
          {showJd && (
            <pre className="scroll-thin well mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl p-3 font-sans text-xs leading-relaxed text-muted fade-in">
              {job.jd_text}
            </pre>
          )}
        </div>
      )}
    </aside>
  );
}

function Fact({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 text-muted">
      <span className="mt-0.5 text-faint">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="eyebrow mb-2">{title}</div>
      {children}
    </div>
  );
}
