import type { Evidence, Extraction } from "../types";

/** A searchable piece of the resume with provenance, so every match can be quoted back to the reviewer. */
export interface Unit {
  section: "experience" | "project" | "skills" | "summary" | "education" | "certification" | "headline";
  label: string;
  text: string;
  handsOn: boolean; // experience bullets and project lines count as applied evidence; skill lists do not
  expIndex?: number;
}

export function buildUnits(e: Extraction): Unit[] {
  const units: Unit[] = [];
  if (e.headline) units.push({ section: "headline", label: "Headline", text: e.headline, handsOn: false });
  e.experience.forEach((x, i) => {
    const label = [x.role, x.org].filter(Boolean).join(" · ");
    units.push({ section: "experience", label, text: x.role, handsOn: true, expIndex: i });
    for (const b of x.bullets) units.push({ section: "experience", label, text: b, handsOn: true, expIndex: i });
  });
  for (const p of e.projects) {
    units.push({ section: "project", label: p.title, text: p.title, handsOn: true });
    for (const l of p.lines) units.push({ section: "project", label: p.title, text: l, handsOn: true });
  }
  if (e.summary) units.push({ section: "summary", label: "Professional summary", text: e.summary, handsOn: false });
  for (const [k, v] of Object.entries(e.skills)) {
    if (v.length) units.push({ section: "skills", label: `Skills · ${cap(k)}`, text: v.join(", "), handsOn: false });
  }
  for (const ed of e.education) {
    units.push({ section: "education", label: ed.institution || "Education", text: ed.degree, handsOn: false });
  }
  for (const c of e.certifications) units.push({ section: "certification", label: "Certification", text: c, handsOn: false });
  return units;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function snippet(text: string, index: number, len: number, radius = 70): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + len + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export interface TermDef {
  term: string; // display label
  re: RegExp;
}

/** Find a term across units. Prefers hands-on evidence; returns up to `max` distinct evidence items. */
export function findTerm(units: Unit[], def: TermDef, max = 2): Evidence[] {
  const found: Evidence[] = [];
  const ordered = [...units].sort((a, b) => Number(b.handsOn) - Number(a.handsOn));
  const seen = new Set<string>();
  for (const u of ordered) {
    const re = new RegExp(def.re.source, def.re.flags.replace("g", ""));
    const m = u.text.match(re);
    if (!m || m.index === undefined) continue;
    const key = `${u.section}|${u.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({
      term: def.term,
      section: u.section,
      label: u.label,
      snippet: snippet(u.text, m.index, m[0].length),
      handsOn: u.handsOn,
    });
    if (found.length >= max) break;
  }
  return found;
}

/** Score a list of terms: `hands` points if applied, `listed` points if only listed. */
export function scoreTerms(
  units: Unit[],
  defs: TermDef[],
  hands: number,
  listed: number,
  cap: number,
): { points: number; evidence: Evidence[]; matched: string[]; handsOnMatched: string[] } {
  let points = 0;
  const evidence: Evidence[] = [];
  const matched: string[] = [];
  const handsOnMatched: string[] = [];
  for (const d of defs) {
    const ev = findTerm(units, d, 1);
    if (!ev.length) continue;
    matched.push(d.term);
    if (ev[0].handsOn) handsOnMatched.push(d.term);
    points += ev[0].handsOn ? hands : listed;
    evidence.push(ev[0]);
  }
  return { points: Math.min(cap, points), evidence, matched, handsOnMatched };
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
