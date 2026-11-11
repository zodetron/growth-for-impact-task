import type { Classification, Criterion, Extraction, HardCheck, Issue, LlmNarrative } from "@/lib/types";

export type JobId = "lca" | "ux";

export interface ScoreRow {
  score: number;
  breakdown: { criteria: Criterion[]; facts: Record<string, string | number | null>; notes: string[] };
  hard: HardCheck[];
}

export interface Candidate {
  id: string;
  filename: string;
  mime_type: string | null;
  candidate_code: string | null;
  headline: string | null;
  status: "ok" | "partial" | "failed";
  source: "seed" | "upload";
  in_pile: boolean;
  extraction: Extraction | null;
  issues: Issue[];
  classification: Classification;
  llm: LlmNarrative | null;
  llm_status: string | null;
  created_at: string;
  raw_text?: string;
  scores: Partial<Record<JobId, ScoreRow>>;
}

export interface JobRow {
  id: JobId;
  title: string;
  short_title: string;
  source_file: string;
  jd_text: string | null;
  profile: {
    company: string;
    location: string;
    employment: string;
    experienceBand: string;
    pitch: string;
    mustHave: string[];
    niceToHave: string[];
    criteria: { key: string; label: string; weight: number; how: string }[];
  };
}

export const CLASS_META: Record<string, { label: string; color: string }> = {
  lca: { label: "LCA match", color: "var(--lca)" },
  ux: { label: "UI/UX match", color: "var(--ux)" },
  both: { label: "Both roles", color: "var(--both)" },
  uncertain: { label: "Uncertain", color: "var(--warn)" },
  neither: { label: "Neither", color: "var(--neutral)" },
  failed: { label: "Unreadable", color: "var(--bad)" },
};

export function classKey(c: Candidate): string {
  return c.status === "failed" ? "failed" : c.classification?.label ?? "uncertain";
}

export function displayName(c: Candidate) {
  return c.candidate_code && c.candidate_code !== "Unknown" ? c.candidate_code : c.filename.replace(/\.[a-z]+$/i, "");
}

export function headlineOf(c: Candidate) {
  return c.extraction?.headline || c.llm?.headline || c.headline || (c.status === "failed" ? "Could not read this resume" : "—");
}

export function relevantYears(c: Candidate, job: JobId): number | null {
  const v = c.scores[job]?.breakdown.facts.relevantYears;
  return typeof v === "number" ? v : null;
}

export function warnCount(c: Candidate) {
  return c.issues.filter((i) => i.severity !== "info").length;
}

export type Tier = "strong" | "good" | "possible" | "low";

export const TIERS: Record<Tier, { label: string; range: string; color: string; min: number }> = {
  strong: { label: "Best matches", range: "70–100", color: "var(--tier-strong)", min: 70 },
  good: { label: "Good matches", range: "50–69", color: "var(--tier-good)", min: 50 },
  possible: { label: "Possible matches", range: "28–49", color: "var(--tier-possible)", min: 28 },
  low: { label: "Low fit", range: "0–27", color: "var(--tier-low)", min: 0 },
};

export function tierOf(score: number | null | undefined): Tier {
  if (score == null) return "low";
  if (score >= 70) return "strong";
  if (score >= 50) return "good";
  if (score >= 28) return "possible";
  return "low";
}

export function scoreColor(s: number | null | undefined) {
  if (s == null) return "var(--faint)";
  return TIERS[tierOf(s)].color;
}

/** Rank = position among in-pile candidates by score desc; an unsaved upload is ranked as if inserted. */
export function rankFor(list: Candidate[], job: JobId, c: Candidate): { rank: number; of: number } | null {
  const s = c.scores[job]?.score;
  if (s == null) return null;
  const pile = list.filter((x) => x.in_pile && x.id !== c.id && x.scores[job]?.score != null);
  const better = pile.filter((x) => (x.scores[job]!.score as number) > s).length;
  return { rank: better + 1, of: pile.length + 1 };
}

export function fmtYears(y: number | null | undefined) {
  if (y == null) return "—";
  if (y === 0) return "0 yrs";
  return `${y.toFixed(1)} yrs`;
}
