"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, FileText, AlertTriangle, XCircle, Info, ArrowDownWideNarrow, SlidersHorizontal } from "lucide-react";
import {
  type Candidate,
  type JobId,
  type JobRow,
  type Tier,
  TIERS,
  tierOf,
  classKey,
  displayName,
  headlineOf,
  relevantYears,
  warnCount,
  fmtYears,
} from "./model";
import { CandidateCard, CandidateRow, SectionHeader } from "./rows";
import { Avatar, ClassPill, ScoreCell } from "./ui";
import { JobPanel } from "./JobPanel";

export type Page = "overview" | "lca" | "ux" | "all" | "review" | "method";

const ROLE_NAME: Record<JobId, string> = { lca: "LCA Consultant", ux: "UI/UX Design Intern" };

/* ======================================================================
   Shared bits
   ====================================================================== */

export function PageHead({ eyebrow, title, sub, actions }: { eyebrow?: string; title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[13px] font-semibold text-muted">{eyebrow}</div>}
        <h1 className="large-title">{title}</h1>
        {sub && <div className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

function GlassMetric({ label, value, tint, onClick }: { label: string; value: number; tint: string; onClick: () => void }) {
  return (
    <div className="glass-tile-wrap" style={{ ["--tile-tint" as string]: tint }}>
      <button onClick={onClick} className="glass-tile block w-full px-5 py-5 text-left">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-muted">
          <span className="size-2 rounded-full" style={{ background: tint }} />
          {label}
        </div>
        <div className="num mt-2 text-[40px] leading-none">{value}</div>
      </button>
    </div>
  );
}

function TierBar({ counts, total }: { counts: Record<Tier, number>; total: number }) {
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
        {(Object.keys(TIERS) as Tier[]).map((t) => (counts[t] ? <div key={t} style={{ width: `${(counts[t] / total) * 100}%`, background: TIERS[t].color }} /> : null))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
        {(Object.keys(TIERS) as Tier[]).map((t) => (
          <div key={t} className="flex items-center gap-1.5 text-[12px]">
            <span className="size-2 rounded-full" style={{ background: TIERS[t].color }} />
            <span className="text-muted">{TIERS[t].label.replace(" matches", "")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function roleStats(cands: Candidate[], job: JobId) {
  const scored = cands.filter((c) => c.scores[job]?.score != null);
  const scores = scored.map((c) => c.scores[job]!.score);
  const counts: Record<Tier, number> = { strong: 0, good: 0, possible: 0, low: 0 };
  scores.forEach((s) => counts[tierOf(s)]++);
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const top = sorted.length ? sorted[sorted.length - 1] : 0;
  const matched = cands.filter((c) => [job, "both"].includes(classKey(c)));
  const avgMatched = matched.length ? matched.reduce((s, c) => s + (c.scores[job]?.score ?? 0), 0) / matched.length : 0;
  const mustAll = scored.filter((c) => c.scores[job]!.hard.every((h) => h.status === "pass" || h.status === "unknown")).length;
  return { scores, counts, median, top, matched: matched.length, avgMatched, mustAll, n: scored.length };
}

function matchesQuery(c: Candidate, q: string) {
  if (!q) return true;
  const hay = [
    displayName(c),
    headlineOf(c),
    c.filename,
    c.extraction?.summary,
    ...Object.values(c.extraction?.skills ?? {}).flat(),
    ...(c.extraction?.experience ?? []).map((x) => `${x.role} ${x.org}`),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

/* ======================================================================
   Overview
   ====================================================================== */

export function OverviewView({
  pile,
  rankMaps,
  go,
  open,
}: {
  pile: Candidate[];
  rankMaps: Record<JobId, Map<string, number>>;
  go: (p: Page) => void;
  open: (id: string, job?: JobId) => void;
}) {
  const lca = roleStats(pile, "lca");
  const ux = roleStats(pile, "ux");

  return (
    <div className="fade-in">
      <PageHead
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        title="Overview"
        sub={`${pile.length} resumes screened against 2 open roles. Every score is explainable and backed by quotes from the resume.`}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <GlassMetric label="Resumes screened" value={pile.length} tint="var(--accent)" onClick={() => go("all")} />
        <GlassMetric label="LCA matches" value={lca.matched} tint="var(--lca)" onClick={() => go("lca")} />
        <GlassMetric label="UI/UX matches" value={ux.matched} tint="var(--ux)" onClick={() => go("ux")} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {(["lca", "ux"] as JobId[]).map((job) => {
          const st = job === "lca" ? lca : ux;
          const top = [...pile]
            .filter((c) => c.scores[job]?.score != null)
            .sort((a, b) => b.scores[job]!.score - a.scores[job]!.score)
            .slice(0, 3);
          return (
            <section key={job} className="card rounded-2xl p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: job === "lca" ? "var(--lca)" : "var(--ux)" }}>
                    <span className="size-2 rounded-full" style={{ background: "currentColor" }} />
                    {job === "lca" ? "JD1 · Chennai onsite" : "JD2 · Remote internship"}
                  </div>
                  <h2 className="mt-1 text-[22px] font-extrabold tracking-tight">{ROLE_NAME[job]}</h2>
                </div>
                <button className="btn" onClick={() => go(job)}>
                  Open <ArrowRight className="size-3.5" />
                </button>
              </div>

              <p className="mt-2 text-[14px] text-muted">
                {st.counts.strong} strong {st.counts.strong === 1 ? "candidate" : "candidates"}, best score {Math.round(st.top)}.
              </p>

              <div className="mt-5">
                <TierBar counts={st.counts} total={st.n} />
              </div>

              <div className="mt-6">
                <div className="mb-2 text-[12px] font-semibold text-muted">Top candidates</div>
                <div className="glist" style={{ boxShadow: "none", border: "1px solid var(--border)" }}>
                  {top.map((c) => (
                    <button key={c.id} onClick={() => open(c.id, job)} className="row flex w-full items-center gap-3 px-3 py-2.5 text-left">
                      <span className="w-4 text-[12px] font-bold tabular-nums text-faint">{rankMaps[job].get(c.id)}</span>
                      <Avatar text={displayName(c)} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold">{displayName(c)}</div>
                        <div className="truncate text-[12px] text-muted">{headlineOf(c)}</div>
                      </div>
                      <span className="num text-[18px]" style={{ color: TIERS[tierOf(c.scores[job]!.score)].color }}>
                        {Math.round(c.scores[job]!.score)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ======================================================================
   Role page — tiers
   ====================================================================== */

export function RoleView({
  job,
  jobRow,
  cands,
  rankMap,
  query,
  open,
  go,
}: {
  job: JobId;
  jobRow: JobRow | null;
  cands: Candidate[];
  rankMap: Map<string, number>;
  query: string;
  open: (id: string) => void;
  go: (p: Page) => void;
}) {
  const [showLow, setShowLow] = useState(false);
  const [showJd, setShowJd] = useState(false);
  const sorted = useMemo(
    () =>
      cands
        .filter((c) => matchesQuery(c, query))
        .sort((a, b) => (b.scores[job]?.score ?? -1) - (a.scores[job]?.score ?? -1) || (relevantYears(b, job) ?? 0) - (relevantYears(a, job) ?? 0)),
    [cands, job, query],
  );
  const byTier = (t: Tier) => sorted.filter((c) => c.scores[job]?.score != null && tierOf(c.scores[job]!.score) === t);
  const strong = byTier("strong");
  const good = byTier("good");
  const possible = byTier("possible");
  const low = sorted.filter((c) => c.scores[job]?.score == null || tierOf(c.scores[job]!.score) === "low");
  const p = jobRow?.profile;

  return (
    <div className="fade-in">
      <PageHead
        eyebrow={job === "lca" ? "Job profile · JD1" : "Job profile · JD2"}
        title={ROLE_NAME[job]}
        sub={p ? `${p.location} · ${p.experienceBand}` : undefined}
        actions={
          <>
            <button className="btn" onClick={() => setShowJd(!showJd)} aria-expanded={showJd}>
              <FileText className="size-3.5" /> {showJd ? "Hide" : "Job details"} & rubric
            </button>
            <button className="btn" onClick={() => go("all")}>
              All candidates <ArrowRight className="size-3.5" />
            </button>
          </>
        }
      />

      {showJd && jobRow && (
        <div className="mt-6 fade-in">
          <JobPanel job={jobRow} />
        </div>
      )}

      {query && (
        <p className="mt-6 text-[13px] text-muted">
          Showing results for “<b className="text-fg">{query}</b>” · {sorted.length} candidates
        </p>
      )}

      <SectionHeader title="Best matches" count={strong.length} color={TIERS.strong.color} sub="Score 70 or more. Strong evidence against most must-haves." />
      {strong.length ? (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {strong.map((c) => (
            <CandidateCard key={c.id} c={c} job={job} rank={rankMap.get(c.id)} onOpen={() => open(c.id)} />
          ))}
        </div>
      ) : (
        <Empty text="No candidates scored 70 or more for this role." />
      )}

      <SectionHeader title="Good matches" count={good.length} color={TIERS.good.color} sub="Score 50–69. Clear fit with one or two gaps worth probing in an interview." />
      {good.length ? (
        <div className="glist">
          {good.map((c) => (
            <CandidateRow key={c.id} c={c} job={job} rank={rankMap.get(c.id)} onOpen={() => open(c.id)} />
          ))}
        </div>
      ) : (
        <Empty text="No candidates in this band." />
      )}

      <SectionHeader title="Possible matches" count={possible.length} color={TIERS.possible.color} sub="Score 28–49. Partial or adjacent experience — review manually." />
      {possible.length ? (
        <div className="glist">
          {possible.map((c) => (
            <CandidateRow key={c.id} c={c} job={job} rank={rankMap.get(c.id)} onOpen={() => open(c.id)} />
          ))}
        </div>
      ) : (
        <Empty text="No candidates in this band." />
      )}

      <div className="mt-10 flex flex-col items-center gap-3">
        <button className="btn" onClick={() => setShowLow(!showLow)} aria-expanded={showLow}>
          {showLow ? "Hide" : "Show"} remaining {low.length} candidates
          <ChevronDown className={`size-3.5 transition-transform ${showLow ? "rotate-180" : ""}`} />
        </button>
        <p className="text-[12px] text-faint">Score below 28 or unreadable — usually applicants for the other role.</p>
      </div>
      {showLow && (
        <div className="glist mt-4 fade-in">
          {low.map((c) => (
            <CandidateRow key={c.id} c={c} job={job} rank={rankMap.get(c.id)} onOpen={() => open(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="card rounded-2xl px-5 py-8 text-center text-[13px] text-muted">{text}</div>;
}

/* ======================================================================
   All candidates — full table with filters
   ====================================================================== */

type Sort = "best" | "lca" | "ux" | "exp" | "name" | "issues";

export function AllView({ cands, query, open }: { cands: Candidate[]; query: string; open: (id: string) => void }) {
  const [cls, setCls] = useState("all");
  const [sort, setSort] = useState<Sort>("best");
  const [minScore, setMinScore] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const rows = useMemo(() => {
    let list = cands.filter((c) => matchesQuery(c, query));
    if (cls !== "all") list = list.filter((c) => (cls === "issues" ? warnCount(c) > 0 : classKey(c) === cls));
    const best = (c: Candidate) => Math.max(c.scores.lca?.score ?? -1, c.scores.ux?.score ?? -1);
    if (minScore) list = list.filter((c) => best(c) >= minScore);
    const by: Record<Sort, (a: Candidate, b: Candidate) => number> = {
      best: (a, b) => best(b) - best(a),
      lca: (a, b) => (b.scores.lca?.score ?? -1) - (a.scores.lca?.score ?? -1),
      ux: (a, b) => (b.scores.ux?.score ?? -1) - (a.scores.ux?.score ?? -1),
      exp: (a, b) => (b.extraction?.totalMonths ?? -1) - (a.extraction?.totalMonths ?? -1),
      name: (a, b) => displayName(a).localeCompare(displayName(b)),
      issues: (a, b) => warnCount(b) - warnCount(a),
    };
    return [...list].sort(by[sort]);
  }, [cands, query, cls, sort, minScore]);

  const chips: [string, string][] = [
    ["all", "All"],
    ["lca", "LCA"],
    ["ux", "UI/UX"],
    ["both", "Both"],
    ["uncertain", "Uncertain"],
    ["neither", "Neither"],
    ["failed", "Unreadable"],
    ["issues", "Has issues"],
  ];

  return (
    <div className="fade-in">
      <PageHead title="All candidates" sub="Every resume with both role scores side by side. Filter by classification, sort by any score." />

      <div className="mt-7 flex flex-wrap items-center gap-2">
        <div className="seg flex-wrap">
          {chips.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={cls === k} onClick={() => setCls(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <ArrowDownWideNarrow className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <select className="input !w-auto !rounded-full" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by">
              <option value="best">Best score</option>
              <option value="lca">LCA score</option>
              <option value="ux">UI/UX score</option>
              <option value="exp">Total experience</option>
              <option value="name">Name</option>
              <option value="issues">Issues first</option>
            </select>
          </div>
          <button className="btn" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal className="size-3.5" /> Filter
          </button>
        </div>
      </div>
      {showFilters && (
        <div className="card mt-3 flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4 fade-in">
          <label className="flex flex-1 items-center gap-4 text-[13px] font-semibold">
            Minimum best score
            <input className="flex-1" type="range" min={0} max={90} step={5} value={minScore} onChange={(e) => setMinScore(+e.target.value)} />
            <span className="w-8 text-right tabular-nums">{minScore}</span>
          </label>
        </div>
      )}

      <div className="glist mt-5">
        <div className="hidden items-center gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-faint sm:flex" style={{ background: "var(--surface-2)" }}>
          <span className="w-9" />
          <span className="flex-1">Candidate · {rows.length}</span>
          <span className="w-20 text-right">Experience</span>
          <span className="w-16 text-right">LCA</span>
          <span className="w-16 text-right">UI/UX</span>
        </div>
        {rows.map((c) => (
          <button key={c.id} onClick={() => open(c.id)} className="row flex w-full items-center gap-3 px-4 py-3 text-left">
            <Avatar text={displayName(c)} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-[15px] font-semibold tracking-tight">{displayName(c)}</span>
                <ClassPill k={classKey(c)} lean={c.classification?.lean} small />
                {!c.in_pile && <span className="tag" style={{ color: "var(--both)" }}>New · unsaved</span>}
                {warnCount(c) > 0 && <AlertTriangle className="size-3.5 text-warn" />}
              </div>
              <div className="truncate text-[13px] text-muted">{headlineOf(c)}</div>
            </div>
            <div className="hidden w-20 text-right text-[13px] tabular-nums text-muted sm:block">{c.extraction ? fmtYears(c.extraction.totalMonths / 12) : "—"}</div>
            <ScoreCell score={c.scores.lca?.score} />
            <div className="hidden sm:block">
              <ScoreCell score={c.scores.ux?.score} />
            </div>
          </button>
        ))}
        {rows.length === 0 && <div className="py-12 text-center text-[13px] text-muted">No candidates match.</div>}
      </div>
    </div>
  );
}

/* ======================================================================
   Needs review — extraction & classification problems
   ====================================================================== */

const ISSUE_TITLES: Record<string, string> = {
  EMPTY_DOCUMENT: "Unreadable files",
  READ_FAILED: "Unreadable files",
  UNSUPPORTED_TYPE: "Unsupported files",
  UNSUPPORTED_DOC: "Unsupported files",
  REDACTION_DAMAGE: "Text damaged by anonymisation",
  DATE_UNPARSED: "Missing or unreadable dates",
  DATE_FUTURE: "Dates in the future",
  SPARSE: "Very short resumes",
  LAYOUT_UNRECOGNISED: "Unrecognised layout",
  LLM_STRUCTURE_FAILED: "Unrecognised layout",
};

export function ReviewView({ cands, open }: { cands: Candidate[]; open: (id: string) => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, { title: string; severity: string; items: { c: Candidate; message: string }[] }>();
    for (const c of cands) {
      for (const i of c.issues) {
        if (i.severity === "info") continue;
        const title = ISSUE_TITLES[i.code] ?? i.code;
        if (!m.has(title)) m.set(title, { title, severity: i.severity, items: [] });
        const g = m.get(title)!;
        if (!g.items.some((x) => x.c.id === c.id)) g.items.push({ c, message: i.message });
        if (i.severity === "error") g.severity = "error";
      }
    }
    return [...m.values()].sort((a, b) => (a.severity === "error" ? -1 : 0) - (b.severity === "error" ? -1 : 0) || b.items.length - a.items.length);
  }, [cands]);
  const uncertain = cands.filter((c) => classKey(c) === "uncertain");

  return (
    <div className="fade-in">
      <PageHead title="Needs review" sub="Resumes where extraction hit a problem or the classifier was unsure. These are worth a human look before deciding." />

      {uncertain.length > 0 && (
        <>
          <SectionHeader title="Uncertain classification" count={uncertain.length} color="var(--warn)" sub="Best score between 28 and 49 — partial fit for a role." />
          <div className="glist">
            {uncertain.map((c) => (
              <button key={c.id} onClick={() => open(c.id)} className="row flex w-full items-center gap-3 px-4 py-3 text-left">
                <Avatar text={displayName(c)} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold">{displayName(c)}</span>
                    <ClassPill k="uncertain" lean={c.classification?.lean} small />
                  </div>
                  <div className="truncate text-[13px] text-muted">{c.classification?.reason}</div>
                </div>
                <ScoreCell score={Math.max(c.scores.lca?.score ?? 0, c.scores.ux?.score ?? 0)} />
              </button>
            ))}
          </div>
        </>
      )}

      {groups.map((g) => (
        <div key={g.title}>
          <SectionHeader title={g.title} count={g.items.length} color={g.severity === "error" ? "var(--bad)" : "var(--warn)"} />
          <div className="glist">
            {g.items.map(({ c, message }) => (
              <button key={c.id} onClick={() => open(c.id)} className="row flex w-full items-start gap-3 px-4 py-3 text-left">
                {g.severity === "error" ? <XCircle className="mt-0.5 size-4 shrink-0 text-bad" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />}
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold">
                    {displayName(c)} <span className="font-mono text-[11px] font-normal text-faint">{c.filename}</span>
                  </div>
                  <div className="mt-0.5 text-[13px] leading-relaxed text-muted">{message}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ======================================================================
   Scoring method
   ====================================================================== */

export function MethodView({ jobs }: { jobs: JobRow[] }) {
  return (
    <div className="fade-in">
      <PageHead title="Scoring method" sub="How resumes are read, scored and classified. Scores are deterministic: the same resume always gets the same score." />

      <SectionHeader title="Pipeline" />
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["1", "Read", "Converts .docx, .pdf and .txt to text. Empty files, scanned PDFs and legacy .doc are flagged, never silently dropped."],
          ["2", "Extract", "A rule-based parser finds experience (with dates), projects, education, skills and certifications. The LLM structures unfamiliar layouts."],
          ["3", "Score", "A 100-point rubric per role. Each point links to a quoted line of the resume, so a reviewer can verify it."],
          ["4", "Explain", "The LLM writes a short reviewer note from the evidence. It never changes the score."],
        ].map(([n, h, t]) => (
          <div key={n} className="card rounded-2xl p-5">
            <div className="grid size-8 place-items-center rounded-full text-[14px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              {n}
            </div>
            <div className="mt-3 text-[16px] font-bold">{h}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{t}</p>
          </div>
        ))}
      </div>

      <SectionHeader title="Classification" sub="Each resume gets an independent score for both roles; the label comes from comparing them." />
      <div className="glist">
        {[
          ["both", "Both scores are 50 or more"],
          ["lca", "LCA score is 50 or more, UI/UX below"],
          ["ux", "UI/UX score is 50 or more, LCA below"],
          ["uncertain", "Best score is between 28 and 49"],
          ["neither", "Both scores are below 28"],
          ["failed", "The file could not be read"],
        ].map(([k, t]) => (
          <div key={k} className="flex items-center justify-between gap-3 px-4 py-3">
            <ClassPill k={k} />
            <span className="text-right text-[13px] text-muted">{t}</span>
          </div>
        ))}
      </div>

      <SectionHeader title="Match tiers" sub="Used on each role page to group candidates." />
      <div className="grid gap-3 sm:grid-cols-4">
        {(Object.keys(TIERS) as Tier[]).map((t) => (
          <div key={t} className="card rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <span className="size-2.5 rounded-full" style={{ background: TIERS[t].color }} />
              {TIERS[t].label}
            </div>
            <div className="num mt-1 text-[22px]">{TIERS[t].range}</div>
          </div>
        ))}
      </div>

      <SectionHeader title="Rubrics" sub="Click a criterion to see exactly how it is scored." />
      <div className="grid gap-4 xl:grid-cols-2">
        {jobs.map((j) => (
          <JobPanel key={j.id} job={j} />
        ))}
      </div>

      <div className="mt-6 flex items-start gap-2 text-[12px] text-faint">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Confidence drops when the anonymiser damaged the text (for example “ISO /s” instead of “ISO 14040/44”) or dates are missing.
      </div>
    </div>
  );
}

