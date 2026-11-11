"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  ChevronDown,
  Download,
  FileWarning,
  FolderKanban,
  GraduationCap,
  Info,
  Sparkles,
  X,
  XCircle,
  Award,
  Languages,
  Wrench,
  Quote,
} from "lucide-react";
import type { Criterion, Issue } from "@/lib/types";
import { type Candidate, type JobId, classKey, displayName, headlineOf, rankFor, fmtYears } from "./model";
import { Avatar, Bar, ClassPill, HardDot, ScoreRing, hardWord } from "./ui";

type Tab = "why" | "profile" | "source" | "issues";

export function Detail({
  candidate,
  all,
  job,
  onClose,
  footer,
}: {
  candidate: Candidate;
  all: Candidate[];
  job: JobId;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("why");
  const [viewJob, setViewJob] = useState<JobId>(job);
  const [fullState, setFull] = useState<Candidate | null>(null);
  const full = fullState?.id === candidate.id ? fullState : null;

  useEffect(() => {
    let alive = true;
    fetch(`/api/candidates/${candidate.id}`)
      .then((r) => r.json())
      .then((d) => alive && d.candidate && setFull(d.candidate))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [candidate.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const c = candidate;
  const name = displayName(c);
  const k = classKey(c);
  const issueCount = c.issues.filter((i) => i.severity !== "info").length;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal aria-label={`Candidate ${name}`}>
      <button aria-label="Close" className="absolute inset-0 bg-black/30 fade-in" onClick={onClose} />
      <section className="panel sheet-in relative m-0 flex h-full w-full max-w-[640px] flex-col overflow-hidden sm:m-3 sm:h-[calc(100%-1.5rem)] sm:rounded-lg">
        {/* header */}
        <header className="border-b px-5 pb-4 pt-5 sm:px-6" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-start gap-3.5">
            <Avatar text={name} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[24px] font-extrabold tracking-tight">{name}</h2>
                <ClassPill k={k} lean={c.classification?.lean} />
                {!c.in_pile && <span className="tag" style={{ color: "var(--both)" }}>New upload · not saved</span>}
              </div>
              <p className="mt-0.5 truncate text-sm text-muted">{headlineOf(c)}</p>
              <p className="mt-1 truncate font-mono text-[11px] text-faint">{c.filename}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <a href={`/api/candidates/${c.id}/file`} className="btn" title="Download original resume">
                <Download className="size-4" />
                <span className="hidden sm:inline">Original</span>
              </a>
              <button onClick={onClose} className="btn btn-icon" aria-label="Close panel">
                <X className="size-4" />
              </button>
            </div>
          </div>

          {c.classification && (
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              <span className="font-medium text-fg">Classification:</span> {c.classification.reason}{" "}
              <span className="text-faint">({c.classification.confidence} confidence)</span>
            </p>
          )}

          <div className="seg mt-4 flex w-full overflow-x-auto" role="tablist">
            {(
              [
                ["why", "Why this rank"],
                ["profile", "Extracted profile"],
                ["source", "Source text"],
                ["issues", `Issues${c.issues.length ? ` · ${c.issues.length}` : ""}`],
              ] as [Tab, string][]
            ).map(([t, l]) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="flex-1">
                {l}
                {t === "issues" && issueCount > 0 && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-warn align-middle" />}
              </button>
            ))}
          </div>
        </header>

        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {tab === "why" && <WhyTab c={c} all={all} job={viewJob} setJob={setViewJob} />}
          {tab === "profile" && <ProfileTab c={c} />}
          {tab === "source" && <SourceTab c={full ?? c} loading={!full} />}
          {tab === "issues" && <IssuesTab c={c} />}
        </div>

        {footer && (
          <footer className="border-t px-5 py-3.5 sm:px-6" style={{ borderColor: "var(--border)" }}>
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
}

/* ---------------------------------- WHY ---------------------------------- */

function WhyTab({ c, all, job, setJob }: { c: Candidate; all: Candidate[]; job: JobId; setJob: (j: JobId) => void }) {
  const s = c.scores[job];
  const rank = rankFor(all, job, c);
  const color = job === "lca" ? "var(--lca)" : "var(--ux)";
  const take = job === "lca" ? c.llm?.lca_take : c.llm?.ux_take;

  if (c.status === "failed" || !s) {
    return (
      <Empty
        icon={<FileWarning className="size-6" />}
        title="This resume could not be scored"
        body={c.issues.find((i) => i.severity === "error")?.message ?? "No text could be extracted."}
      />
    );
  }

  return (
    <div className="grid gap-5 fade-in">
      <div className="seg w-fit" role="tablist" aria-label="Role">
        {(["lca", "ux"] as JobId[]).map((j) => (
          <button key={j} role="tab" aria-selected={job === j} onClick={() => setJob(j)}>
            {j === "lca" ? "LCA Consultant" : "UI/UX Intern"} · {Math.round(c.scores[j]?.score ?? 0)}
          </button>
        ))}
      </div>

      <div className="well flex items-center gap-5 rounded-xl p-4">
        <ScoreRing score={s.score} size={84} stroke={7} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color }}>
            {job === "lca" ? "LCA Consultant" : "UI/UX Design Intern"} match
          </div>
          <div className="num mt-1 text-[30px]">
            {s.score}
            <span className="text-base font-normal text-faint"> / 100</span>
          </div>
          <div className="mt-1 text-[13px] text-muted">
            {rank ? (
              <>
                Ranked <span className="font-semibold text-fg">#{rank.rank}</span> of {rank.of} · {fmtYears(s.breakdown.facts.relevantYears as number)} relevant experience
              </>
            ) : (
              "Not ranked"
            )}
          </div>
        </div>
      </div>

      {(take || c.llm?.summary) && (
        <div className="relative overflow-hidden rounded-xl border p-4" style={{ borderColor: "color-mix(in oklab, var(--accent) 25%, transparent)", background: "color-mix(in oklab, var(--accent) 7%, transparent)" }}>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--accent)" }}>
            <Sparkles className="size-3.5" /> AI reviewer note
          </div>
          {take && <p className="mt-2 text-sm leading-relaxed">{take}</p>}
          {c.llm?.summary && <p className="mt-2 text-[13px] leading-relaxed text-muted">{c.llm.summary}</p>}
          {(c.llm?.strengths?.length || c.llm?.concerns?.length) ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MiniList title="Strengths" items={c.llm?.strengths ?? []} color="var(--ok)" />
              <MiniList title="Concerns" items={c.llm?.concerns ?? []} color="var(--warn)" />
            </div>
          ) : null}
          <p className="mt-3 text-[11px] text-faint">Written by {c.llm?.model ?? "LLM"} from the extracted evidence. The score itself is computed by the rubric, not the AI.</p>
        </div>
      )}

      <div>
        <H3>Must-have requirements</H3>
        <div className="grid gap-1.5">
          {s.hard.map((h) => (
            <div key={h.key} className="well flex items-center gap-3 rounded-lg px-3 py-2.5">
              <HardDot status={h.status} />
              <div className="min-w-0 flex-1 text-[13px] font-medium">{h.label}</div>
              <div className="text-right text-xs text-muted">
                <span className="font-medium">{hardWord(h.status)}</span>
                <span className="text-faint"> · {h.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <H3>Score breakdown & evidence</H3>
        <div className="grid gap-2">
          {s.breakdown.criteria.map((cr) => (
            <CriterionRow key={cr.key} cr={cr} color={color} />
          ))}
        </div>
      </div>

      {s.breakdown.notes.length > 0 && (
        <div className="grid gap-1.5">
          {s.breakdown.notes.map((n) => (
            <div key={n} className="flex gap-2 rounded-lg px-3 py-2 text-[13px]" style={{ background: "color-mix(in oklab, var(--warn) 10%, transparent)" }}>
              <Info className="mt-0.5 size-4 shrink-0 text-warn" />
              {n}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CriterionRow({ cr, color }: { cr: Criterion; color: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="well rounded-lg">
      <button className="w-full px-3.5 py-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium">{cr.label}</span>
          <span className="flex items-center gap-2 text-[13px] tabular-nums">
            <span className="font-semibold">{cr.points}</span>
            <span className="text-faint">/ {cr.weight}</span>
            <ChevronDown className={`size-4 text-faint transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </div>
        <div className="mt-2">
          <Bar value={cr.points} max={cr.weight} color={color} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">{cr.detail}</p>
      </button>
      {open && (
        <div className="grid gap-1.5 px-3.5 pb-3.5 fade-in">
          {cr.evidence.length === 0 && <p className="text-xs text-faint">No quotable evidence — this criterion was scored from structured fields (dates / education).</p>}
          {cr.evidence.map((e, i) => (
            <div key={i} className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)" }}>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-semibold" style={{ color }}>
                  {e.term}
                </span>
                <span className="text-faint">·</span>
                <span className="text-muted">{e.section}</span>
                <span className="text-faint">·</span>
                <span className="truncate text-muted">{e.label}</span>
                {!e.handsOn && <span className="tag !h-4 !px-1.5 !text-[10px]">listed only</span>}
              </div>
              <p className="mt-1 flex gap-1.5 text-xs leading-relaxed">
                <Quote className="mt-0.5 size-3 shrink-0 text-faint" />
                {e.snippet}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- PROFILE -------------------------------- */

function ProfileTab({ c }: { c: Candidate }) {
  const e = c.extraction;
  if (!e) return <Empty icon={<FileWarning className="size-6" />} title="Nothing extracted" body="The file could not be read, so there is no structured profile." />;
  return (
    <div className="grid gap-6 fade-in">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="tag">Parser: {e.parser === "template" ? "rules (template)" : e.parser === "llm" ? "LLM-structured" : "rules (heuristic)"}</span>
        <span className="tag">{e.wordCount} words</span>
        <span className="tag">Total experience {fmtYears(e.totalMonths / 12)}</span>
        {e.claimedYears != null && <span className="tag">Claims {e.claimedYears}+ yrs</span>}
      </div>

      {e.summary && (
        <Block icon={<BookOpen className="size-4" />} title="Summary">
          <p className="text-[13px] leading-relaxed text-muted">{e.summary}</p>
        </Block>
      )}

      <Block icon={<Briefcase className="size-4" />} title={`Experience · ${e.experience.length}`}>
        {e.experience.length === 0 ? (
          <p className="text-[13px] text-faint">No work experience listed.</p>
        ) : (
          <ol className="relative grid gap-4 border-l pl-5" style={{ borderColor: "var(--border)" }}>
            {e.experience.map((x, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2" style={{ borderColor: "var(--accent)", background: "var(--bg)" }} />
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <div className="text-[13px] font-semibold">{x.role}</div>
                  <div className="text-xs tabular-nums text-faint">
                    {x.dates.raw || "No dates"}
                    {x.dates.months ? ` · ${x.dates.months} mo` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  {x.org}
                  {x.kind !== "job" && <span className="tag !h-4 !px-1.5 !text-[10px]">{x.kind}</span>}
                </div>
                {x.bullets.length > 0 && (
                  <ul className="mt-1.5 grid gap-1">
                    {x.bullets.map((b, j) => (
                      <li key={j} className="text-xs leading-relaxed text-muted">
                        • {b}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </Block>

      {e.projects.length > 0 && (
        <Block icon={<FolderKanban className="size-4" />} title={`Projects · ${e.projects.length}`}>
          <div className="grid gap-2">
            {e.projects.map((p, i) => (
              <div key={i} className="well rounded-lg p-3">
                <div className="text-[13px] font-semibold">{p.title}</div>
                {p.lines.map((l, j) => (
                  <p key={j} className="mt-1 text-xs leading-relaxed text-muted">
                    {l}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </Block>
      )}

      <Block icon={<GraduationCap className="size-4" />} title="Education">
        <div className="grid gap-2">
          {e.education.map((d, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium">{d.degree}</div>
                <div className="text-xs text-muted">{d.institution}</div>
              </div>
              <div className="shrink-0 text-right text-xs text-faint">
                {d.years}
                {d.grade && <div>{d.grade}</div>}
              </div>
            </div>
          ))}
          {e.education.length === 0 && <p className="text-[13px] text-faint">No education listed.</p>}
        </div>
      </Block>

      {Object.keys(e.skills).length > 0 && (
        <Block icon={<Wrench className="size-4" />} title="Skills & tools">
          <div className="grid gap-3">
            {Object.entries(e.skills).map(([k, v]) => (
              <div key={k}>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">{k}</div>
                <div className="flex flex-wrap gap-1.5">
                  {v.map((s, i) => (
                    <span key={i} className="tag">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Block>
      )}

      {(e.certifications.length > 0 || e.awards.length > 0) && (
        <Block icon={<Award className="size-4" />} title="Certifications & awards">
          <ul className="grid gap-1">
            {[...e.certifications, ...e.awards].map((x, i) => (
              <li key={i} className="text-xs text-muted">
                • {x}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {e.languages.length > 0 && (
        <Block icon={<Languages className="size-4" />} title="Languages">
          <div className="flex flex-wrap gap-1.5">
            {e.languages.map((l) => (
              <span key={l} className="tag">
                {l}
              </span>
            ))}
          </div>
        </Block>
      )}
    </div>
  );
}

/* -------------------------------- SOURCE -------------------------------- */

function SourceTab({ c, loading }: { c: Candidate; loading: boolean }) {
  const [q, setQ] = useState("");
  const text = c.raw_text ?? "";
  const parts = useMemo(() => {
    if (!q.trim()) return [text];
    const re = new RegExp(`(${q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    return text.split(re);
  }, [q, text]);
  if (loading) return <div className="shimmer h-80 rounded-3xl" />;
  return (
    <div className="grid gap-3 fade-in">
      <div className="flex items-center gap-2">
        <input className="input !pl-3" placeholder="Highlight a word in the source…" value={q} onChange={(e) => setQ(e.target.value)} />
        <a href={`/api/candidates/${c.id}/file`} className="btn shrink-0">
          <Download className="size-4" /> Download
        </a>
      </div>
      <p className="text-xs text-faint">Exact text extracted from {c.filename}. Use it to verify any evidence quote.</p>
      {text ? (
        <pre className="well whitespace-pre-wrap rounded-xl p-4 font-sans text-[13px] leading-relaxed">
          {parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}
        </pre>
      ) : (
        <Empty icon={<FileWarning className="size-6" />} title="No text in this file" body="The document is empty or the text layer could not be read." />
      )}
    </div>
  );
}

/* -------------------------------- ISSUES -------------------------------- */

const SEV: Record<Issue["severity"], { color: string; Icon: typeof Info; label: string }> = {
  error: { color: "var(--bad)", Icon: XCircle, label: "Error" },
  warning: { color: "var(--warn)", Icon: AlertTriangle, label: "Warning" },
  info: { color: "var(--both)", Icon: Info, label: "Note" },
};

const STAGE: Record<string, string> = { read: "Reading file", parse: "Layout parsing", extract: "Field extraction", score: "Scoring", llm: "AI summary" };

function IssuesTab({ c }: { c: Candidate }) {
  if (c.issues.length === 0)
    return <Empty icon={<Sparkles className="size-6" />} title="Clean extraction" body="No problems were detected while reading, parsing or scoring this resume." />;
  return (
    <div className="grid gap-2 fade-in">
      <p className="mb-1 text-xs text-faint">What went wrong (or looked odd) while processing this resume, and how it affects the score.</p>
      {c.issues.map((i, n) => {
        const m = SEV[i.severity];
        return (
          <div key={n} className="flex gap-3 rounded-lg border p-3" style={{ borderColor: `color-mix(in oklab, ${m.color} 28%, transparent)`, background: `color-mix(in oklab, ${m.color} 7%, transparent)` }}>
            <m.Icon className="mt-0.5 size-4 shrink-0" style={{ color: m.color }} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: m.color }}>
                {m.label} <span className="text-faint">· {STAGE[i.stage] ?? i.stage}</span> <span className="font-mono text-faint normal-case">{i.code}</span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed">{i.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------- bits -------------------------------- */

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="eyebrow mb-2">{children}</h3>;
}

function Block({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold">
        <span className="text-faint">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

function MiniList({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color }}>
        {title}
      </div>
      <ul className="grid gap-1">
        {items.map((s, i) => (
          <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-muted">
            <span className="mt-1.5 size-1 shrink-0 rounded-full" style={{ background: color }} />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="grid place-items-center gap-2 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-xl text-muted well">{icon}</div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="max-w-sm text-[13px] text-muted">{body}</p>
    </div>
  );
}
