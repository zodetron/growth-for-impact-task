"use client";

import { AlertTriangle, ChevronRight, FileWarning } from "lucide-react";
import { type Candidate, type JobId, classKey, displayName, headlineOf, relevantYears, warnCount, fmtYears } from "./model";
import { Avatar, ClassPill, HardDot, ScoreCell, ScoreRing } from "./ui";

function topStrengths(c: Candidate, job: JobId, n = 3) {
  const s = c.scores[job];
  if (!s) return [];
  // Same criteria, same order on every card, so cards can be compared at a glance.
  return s.breakdown.criteria.slice(0, n).map((cr) => ({ label: cr.label, pct: Math.round((cr.points / cr.weight) * 100) }));
}

/** Large card used for the "Best matches" tier. */
export function CandidateCard({ c, job, rank, onOpen }: { c: Candidate; job: JobId; rank?: number; onOpen: () => void }) {
  const s = c.scores[job];
  const name = displayName(c);
  return (
    <button onClick={onOpen} className="group card flex flex-col rounded-2xl p-5 text-left transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar text={name} size={44} />
          {rank != null && (
            <span className="absolute -left-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold text-white" style={{ background: "var(--fg)" }}>
              {rank}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[17px] font-bold tracking-tight">{name}</span>
            {!c.in_pile && <span className="tag" style={{ color: "var(--both)" }}>New</span>}
            {warnCount(c) > 0 && <AlertTriangle className="size-3.5 shrink-0 text-warn" />}
          </div>
          <div className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">{headlineOf(c)}</div>
        </div>
        <ScoreRing score={s?.score} size={54} stroke={5} />
      </div>

      <div className="mt-4 grid gap-2">
        {topStrengths(c, job, 4).map((t) => (
          <div key={t.label} className="flex items-center gap-3">
            <span className="w-44 shrink-0 truncate text-[12px] text-muted">{t.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(t.pct, 2)}%`, background: t.pct >= 80 ? "var(--tier-strong)" : t.pct >= 50 ? "var(--tier-good)" : t.pct > 0 ? "var(--tier-possible)" : "var(--tier-low)" }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-[12px]" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1">{s?.hard.map((h) => <HardDot key={h.key} status={h.status} title={h.label} />)}</div>
        <div className="flex items-center gap-3 text-muted">
          <span>
            <b className="font-semibold text-fg">{fmtYears(relevantYears(c, job))}</b>
          </span>
          <ChevronRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </button>
  );
}

/** Compact grouped-list row. */
export function CandidateRow({ c, job, rank, onOpen, active }: { c: Candidate; job: JobId; rank?: number; onOpen: () => void; active?: boolean }) {
  const s = c.scores[job];
  const name = displayName(c);
  const warns = warnCount(c);
  const failed = c.status === "failed";
  return (
    <button onClick={onOpen} data-active={active} className="row flex w-full items-center gap-3 px-4 py-3 text-left">
      <span className="hidden w-6 text-center text-[13px] font-semibold tabular-nums text-faint sm:block">{rank ?? "–"}</span>
      <Avatar text={name} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[15px] font-semibold tracking-tight">{name}</span>
          <ClassPill k={classKey(c)} lean={c.classification?.lean} small />
          {!c.in_pile && <span className="tag" style={{ color: "var(--both)" }}>New · unsaved</span>}
          {warns > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: failed ? "var(--bad)" : "var(--warn)" }} title={c.issues.map((i) => i.message).join("\n")}>
              {failed ? <FileWarning className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
              {warns}
            </span>
          )}
        </div>
        <div className="truncate text-[13px] text-muted">{headlineOf(c)}</div>
      </div>
      <div className="hidden items-center gap-1 lg:flex">{s?.hard.map((h) => <HardDot key={h.key} status={h.status} title={h.label} />)}</div>
      <ScoreCell score={s?.score} />
      <ChevronRight className="size-4 shrink-0 text-faint" />
    </button>
  );
}

export function SectionHeader({ title, count, color, sub, right }: { title: string; count?: number; color?: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-10 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2.5">
          {color && <span className="size-2.5 rounded-full" style={{ background: color }} />}
          <h2 className="section-title">{title}</h2>
          {count != null && <span className="text-[15px] font-semibold tabular-nums text-faint">{count}</span>}
        </div>
        {sub && <p className="mt-1 text-[13px] text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
