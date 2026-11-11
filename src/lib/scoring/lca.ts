import type { Criterion, Evidence, Extraction, HardCheck, JobScore } from "../types";
import { weightedMonths } from "../extract/dates";
import { buildUnits, findTerm, round1, scoreTerms, snippet, type TermDef, type Unit } from "./evidence";

export const LCA_CORE_RE =
  /\b(LCA|LCAs|life[- ]?cycle (assessment|analysis|inventory|inventories)|LCI|EPDs?|environmental product (declaration|profile)|PCF|product carbon footprint|cradle[- ]to[- ](gate|grave)|PEP\b)/i;
const LCA_ADJACENT_RE =
  /\b(GHG|greenhouse|carbon|emission|ESG|sustainab\w*|environment\w*|climate|decarboni\w*|circular|net zero|BRSR|CBAM|eco[- ]?design)/i;

const PRIMARY_TOOL_RE = /\b(gabi|sima ?pro|sphera lca|sphera)\b/i;
const OTHER_TOOL_RE = /\b(open ?lca|one ?click ?lca|umberto|eime|air\.e|brightway|ecochain|mobius|lca for experts)\b/i;

const METHOD_TERMS: TermDef[] = [
  { term: "Life cycle inventory (LCI)", re: /\b(LCI|life cycle inventor(y|ies))\b/i },
  { term: "Cradle-to-gate / grave", re: /cradle[- ]to[- ](gate|grave)/i },
  { term: "Functional unit", re: /functional unit/i },
  { term: "System boundaries", re: /system boundar/i },
  { term: "Impact assessment", re: /\b(LCIA|impact assessment|ReCiPe|CML|EF 3|environmental impacts?)\b/i },
  { term: "ecoinvent / databases", re: /\b(ecoinvent|ELCD|BAFU|GaBi database|secondary database)\b/i },
  { term: "Hotspot analysis", re: /hotspot/i },
  { term: "Allocation", re: /\ballocation/i },
  { term: "Data collection & validation", re: /\b(data (collection|validation|gathering|gaps?)|validated|gathered and evaluated data|collected, validated)\b/i },
  { term: "Benchmarking", re: /benchmark/i },
  { term: "Sensitivity / scenario analysis", re: /\b(sensitivity|scenario)\b/i },
  { term: "Bill of Materials / plant data", re: /\b(BOMs?|bill of materials|plant[- ]level|energy use|logistics)\b/i },
];

const STANDARD_EXPLICIT_RE = /ISO\s*14040|ISO\s*14044|14040\s*\/\s*(14044|44)/i;
const STANDARD_RELATED_RE = /ISO\s*(14067|14025|14064|21930)|EN\s*15804|\bPCR\b|GHG Protocol|Catena[- ]X|PEF\b/i;
const STANDARD_REDACTED_RE = /\bISO\s*(?:\/|\s(?=,|and\b|\.|-)|,|\.)/;

const ENV_DEGREE_RE = /environment|sustainab|ecolog|climate|energy and environment|renewable energy/i;
const ENG_SCI_RE = /engineering|b\.?\s?tech|m\.?\s?tech|b\.?\s?e\b|b\.e\.|m\.?\s?e\b|chemical|mechanical|civil|biotech|chemistry|science|automobile|physics|technology|b\.?\s?sc|m\.?\s?sc/i;

function experienceWeight(e: Extraction["experience"][number]): { weight: number; tier: "core" | "adjacent" | "none" } {
  const text = [e.role, ...e.bullets].join(" ");
  let weight = 0;
  let tier: "core" | "adjacent" | "none" = "none";
  if (LCA_CORE_RE.test(text)) {
    weight = 1;
    tier = "core";
  } else if (LCA_ADJACENT_RE.test(text)) {
    weight = 0.25;
    tier = "adjacent";
  }
  if (e.kind === "internship") weight *= 0.5;
  if (e.kind === "academic") weight *= 0.5;
  return { weight, tier };
}

function countLcaStudies(units: Unit[]): { count: number; evidence: Evidence[] } {
  const evidence: Evidence[] = [];
  let count = 0;
  const seenProjects = new Set<string>();
  for (const u of units) {
    if (!u.handsOn) continue;
    if (u.section === "experience" && u.text === u.label.split(" · ")[0]) continue; // role title line
    const m = u.text.match(LCA_CORE_RE);
    if (!m || m.index === undefined) continue;
    if (u.section === "project") {
      if (seenProjects.has(u.label)) continue;
      seenProjects.add(u.label);
    }
    // "Published 40 EPDs", "LCA studies for cement, pharmaceutical, animal healthcare…"
    const num = u.text.match(/\b(\d{1,3})\+?\s+(EPDs?|LCAs?|LCA studies|PEPs?|life cycle assessments)/i);
    let n = 1;
    if (num) n = Math.min(10, parseInt(num[1], 10));
    else {
      const list = u.text.match(/\b(?:LCA|life cycle assessments?|LCA studies)\b[^.]{0,60}?\bfor\b([^.]+)/i);
      if (list) n = Math.min(4, list[1].split(/,|\band\b/).filter((s) => s.trim().length > 2).length);
    }
    count += n;
    evidence.push({
      term: n > 1 ? `${n} studies` : "LCA study",
      section: u.section,
      label: u.label,
      snippet: snippet(u.text, m.index, m[0].length, 90),
      handsOn: true,
    });
  }
  return { count, evidence };
}

export function scoreLca(e: Extraction, rawText: string): JobScore {
  const units = buildUnits(e);
  const criteria: Criterion[] = [];
  const notes: string[] = [];

  // 1. Experience ---------------------------------------------------------
  const weighted = e.experience.map((x) => ({ x, ...experienceWeight(x) }));
  const lcaMonths = weightedMonths(weighted.map((w) => ({ range: w.x.dates, weight: w.weight })));
  const lcaYears = lcaMonths / 12;
  const f = lcaYears >= 2 ? 1 : lcaYears >= 1 ? 0.5 + 0.5 * (lcaYears - 1) : 0.5 * lcaYears;
  const expEvidence: Evidence[] = weighted
    .filter((w) => w.tier !== "none")
    .map((w) => ({
      term: w.tier === "core" ? "LCA role" : "Adjacent sustainability role",
      section: "experience",
      label: [w.x.role, w.x.org].filter(Boolean).join(" · "),
      snippet: `${w.x.dates.raw || "dates not given"} · ${w.x.dates.months ?? "?"} mo × ${Math.round(w.weight * 100)}% weight${w.x.kind !== "job" ? ` (${w.x.kind})` : ""}`,
      handsOn: true,
    }));
  criteria.push({
    key: "experience",
    label: "Relevant LCA experience",
    weight: 25,
    points: round1(25 * f),
    detail: `${lcaYears.toFixed(1)} weighted years of LCA-relevant work (target 2–3 yrs).`,
    evidence: expEvidence,
  });
  if (lcaYears > 3.5) notes.push(`About ${lcaYears.toFixed(1)} years of LCA-weighted experience — above the 2–3 year band; may be senior for the role.`);

  // 2. Software -----------------------------------------------------------
  const primary = findTerm(units, { term: "GaBi / SimaPro", re: PRIMARY_TOOL_RE }, 3);
  const other = findTerm(units, { term: "Other LCA software", re: OTHER_TOOL_RE }, 2);
  let swPoints = 0;
  let swDetail = "No LCA software mentioned.";
  if (primary.some((p) => p.handsOn)) {
    swPoints = 20;
    swDetail = "GaBi/SimaPro used in experience or projects.";
  } else if (primary.length) {
    swPoints = 15;
    swDetail = "GaBi/SimaPro listed in skills but not shown in project work.";
  } else if (other.length) {
    swPoints = 8;
    swDetail = "Only other LCA tools (e.g. openLCA) — JD requires GaBi or SimaPro.";
  }
  criteria.push({ key: "software", label: "GaBi / SimaPro", weight: 20, points: swPoints, detail: swDetail, evidence: [...primary, ...other] });

  // 3. Projects -----------------------------------------------------------
  const studies = countLcaStudies(units);
  const projPoints = studies.count >= 3 ? 15 : studies.count === 2 ? 10 : studies.count === 1 ? 5 : 0;
  criteria.push({
    key: "projects",
    label: "Completed LCA projects",
    weight: 15,
    points: projPoints,
    detail: `${studies.count >= 10 ? "10+" : studies.count} LCA studies / EPDs evidenced (need ≥3).`,
    evidence: studies.evidence.slice(0, 6),
  });

  // 4. Methods ------------------------------------------------------------
  const methods = scoreTerms(units, METHOD_TERMS, 2.5, 1, 15);
  criteria.push({
    key: "methods",
    label: "LCA methodology depth",
    weight: 15,
    points: round1(methods.points),
    detail: methods.matched.length ? `${methods.handsOnMatched.length} applied / ${methods.matched.length} total method signals.` : "No LCA methodology terms found.",
    evidence: methods.evidence,
  });

  // 5. Standards ----------------------------------------------------------
  const explicit = findTerm(units, { term: "ISO 14040/14044", re: STANDARD_EXPLICIT_RE }, 2);
  const related = findTerm(units, { term: "Related standard", re: STANDARD_RELATED_RE }, 2);
  const redacted = units
    .filter((u) => (u.handsOn || u.section === "summary" || u.section === "skills") && STANDARD_REDACTED_RE.test(u.text) && LCA_CORE_RE.test(u.text))
    .slice(0, 2)
    .map<Evidence>((u) => {
      const m = u.text.match(STANDARD_REDACTED_RE)!;
      return { term: "ISO (digits redacted)", section: u.section, label: u.label, snippet: snippet(u.text, m.index ?? 0, 5), handsOn: u.handsOn };
    });
  let stdPoints = 0;
  let stdDetail = "No LCA standard referenced.";
  if (explicit.length) {
    stdPoints = 10;
    stdDetail = "Explicit ISO 14040/14044 reference.";
  } else if (redacted.length) {
    stdPoints = 7;
    stdDetail = "ISO reference in LCA context with the number stripped by anonymisation — very likely ISO 14040/44.";
  } else if (related.length) {
    stdPoints = 5;
    stdDetail = "Related standards only (ISO 14067, EN 15804, PCR, GHG Protocol…).";
  }
  criteria.push({ key: "standards", label: "ISO 14040/14044 & standards", weight: 10, points: stdPoints, detail: stdDetail, evidence: [...explicit, ...redacted, ...related].slice(0, 3) });

  // 6. Education ----------------------------------------------------------
  const degrees = e.education.filter((d) => ["bachelors", "masters", "doctorate", "diploma"].includes(d.level));
  let eduPoints = 0;
  let eduBest = "";
  for (const d of degrees) {
    const t = `${d.degree} ${d.institution}`;
    const p = ENV_DEGREE_RE.test(d.degree) ? 10 : ENG_SCI_RE.test(t) ? 6 : 3;
    if (p > eduPoints) {
      eduPoints = p;
      eduBest = d.degree;
    }
  }
  criteria.push({
    key: "education",
    label: "Education",
    weight: 10,
    points: eduPoints,
    detail: eduBest ? `${eduPoints === 10 ? "Environmental-domain" : eduPoints === 6 ? "Engineering / science" : "Other"} degree: ${eduBest}` : "No degree found.",
    evidence: [],
  });

  // 7. EPD -----------------------------------------------------------------
  const epd = findTerm(units, { term: "EPD", re: /\b(EPDs?|environmental product declaration|PEP\b|PEP eco-passport)/i }, 2);
  criteria.push({
    key: "epd",
    label: "EPD experience (preferred)",
    weight: 5,
    points: epd.some((x) => x.handsOn) ? 5 : epd.length ? 3 : 0,
    detail: epd.length ? (epd.some((x) => x.handsOn) ? "EPD work in experience/projects." : "EPD mentioned but not as applied work.") : "No EPD evidence.",
    evidence: epd,
  });

  // Hard requirements ---------------------------------------------------------
  const hard: HardCheck[] = [
    {
      key: "years",
      label: "2–3 yrs running LCA projects",
      status: lcaYears >= 2 ? "pass" : lcaYears >= 1 ? "partial" : "fail",
      detail: `${lcaYears.toFixed(1)} weighted LCA years${lcaYears >= 2 ? ", requirement satisfied" : ", 2 required"}`,
    },
    {
      key: "software",
      label: "GaBi or SimaPro",
      status: primary.some((p) => p.handsOn) ? "pass" : primary.length ? "partial" : "fail",
      detail: primary.length ? (primary.some((p) => p.handsOn) ? "Used in work" : "Listed in skills only") : other.length ? "Only openLCA/other tools" : "Not mentioned",
    },
    {
      key: "projects",
      label: "≥3 completed LCA projects",
      status: studies.count >= 3 ? "pass" : studies.count >= 1 ? "partial" : "fail",
      detail: studies.count >= 3 ? `${studies.count >= 10 ? "10 or more" : studies.count} studies found, requirement of 3 satisfied` : `only ${studies.count} found, 3 required`,
    },
    {
      key: "iso",
      label: "ISO 14040 / 14044",
      status: explicit.length ? "pass" : redacted.length ? "partial" : related.length ? "partial" : "fail",
      detail: explicit.length ? "Explicit" : redacted.length ? "Likely (digits redacted)" : related.length ? "Related standards only" : "Not mentioned",
    },
    {
      key: "location",
      label: "Chennai onsite / relocation",
      status: /chennai/i.test(rawText) ? "pass" : "unknown",
      detail: /chennai/i.test(rawText) ? "Chennai mentioned in resume" : "Location not stated — confirm with candidate",
    },
  ];

  const score = round1(criteria.reduce((s, c) => s + c.points, 0));
  return {
    jobId: "lca",
    score,
    criteria,
    hard,
    facts: {
      relevantYears: round1(lcaYears),
      totalYears: round1(e.totalMonths / 12),
      lcaStudies: studies.count,
      primaryTool: primary.length ? "GaBi/SimaPro" : other.length ? "Other LCA tool" : null,
    },
    notes,
  };
}
