import type { Criterion, Evidence, Extraction, HardCheck, JobScore } from "../types";
import { weightedMonths } from "../extract/dates";
import { buildUnits, findTerm, round1, scoreTerms, type TermDef } from "./evidence";

export const DESIGN_CORE_RE =
  /\b(UI|UX|UI\/UX|UX\/UI|user experience|user interface|product design\w*|interaction design|figma|wireframe\w*|prototyp\w*|web design|app design|usability|high[- ]fidelity)\b/i;
const DESIGN_ADJACENT_RE = /\b(graphic design\w*|visual design\w*|brand(ing)? identity|branding|front[- ]?end|motion graphics|illustrat\w*|creative head)\b/i;

const RESEARCH_TERMS: TermDef[] = [
  { term: "User research", re: /\b(user research|ux research|design research|primary research|research[- ]driven)\b/i },
  { term: "User interviews", re: /\b(user )?interviews?\b|stakeholder interviews/i },
  { term: "Usability testing", re: /usability (test|testing|feedback)|user testing|tested with users|maze\b/i },
  { term: "Personas", re: /\bpersonas?\b/i },
  { term: "Journey mapping", re: /journey map|user journeys?/i },
  { term: "Heuristic evaluation", re: /heuristic/i },
  { term: "Card sorting", re: /card sort/i },
  { term: "A/B testing", re: /\bA\/B\b/i },
  { term: "Surveys", re: /\bsurveys?\b/i },
  { term: "User psychology / behaviour", re: /user (psychology|behaviou?r|needs|pain points?|insights?)|behaviou?ral (ux|feedback|design)|pain points|cognitive load|friction/i },
  { term: "Competitive analysis", re: /competi(tor|tive) analysis/i },
  { term: "Task analysis", re: /task (analysis|success|completion)/i },
];

const CRAFT_TERMS: TermDef[] = [
  { term: "Visual hierarchy", re: /visual hierarchy|information hierarchy/i },
  { term: "Typography", re: /typograph/i },
  { term: "Design systems", re: /design system|component library|reusable (ui )?components|design tokens|style guide/i },
  { term: "Responsive design", re: /responsive|mobile[- ]first|across devices/i },
  { term: "Accessibility", re: /accessib|WCAG/i },
  { term: "Micro-interactions / motion", re: /micro[- ]?interaction|motion|animation|interaction design/i },
  { term: "Information architecture", re: /information architecture|\bIA\b/i },
  { term: "High-fidelity UI", re: /high[- ]fidelity|hi[- ]fi|mockups?/i },
  { term: "Grids, spacing & layout", re: /grid|spacing|layout/i },
  { term: "Wireframing", re: /wirefram/i },
];

const DOMAIN_TERMS: TermDef[] = [
  { term: "Website / landing page", re: /website|landing page|web app|web application/i },
  { term: "Hiring / job platform", re: /hiring|job board|recruit|career|talent|worker/i },
  { term: "Dashboards / SaaS", re: /dashboard|saas/i },
  { term: "Sustainability", re: /sustainab|climate|green|impact/i },
];

const DESIGN_DEGREE_RE = /\b(b\.?\s?des|m\.?\s?des|design|hci|human[- ]computer|interaction|ui ?\/? ?ux|ux|communication design|fashion technology|NID)\b/i;
const TECH_DEGREE_RE = /computer|information (technology|science)|\bit\b|engineering|b\.?\s?tech|bca|mca|electronics|\bai\b|machine learning/i;

export function scoreUx(e: Extraction): JobScore {
  const units = buildUnits(e);
  const criteria: Criterion[] = [];
  const notes: string[] = [];

  // 1. Figma & prototyping ----------------------------------------------------
  const figma = findTerm(units, { term: "Figma", re: /\bfigma\b/i }, 2);
  const proto = findTerm(units, { term: "Prototyping", re: /prototyp|framer|protopie|adobe xd|principle\b/i }, 2);
  const figmaPts = figma.some((x) => x.handsOn) ? 14 : figma.length ? 10 : 0;
  const protoPts = proto.length ? (proto.some((x) => x.handsOn) ? 6 : 4) : 0;
  criteria.push({
    key: "tools",
    label: "Figma & prototyping",
    weight: 20,
    points: Math.min(20, figmaPts + protoPts),
    detail: `${figma.length ? (figma.some((x) => x.handsOn) ? "Figma used in work" : "Figma listed") : "No Figma"}; ${proto.length ? "prototyping evidenced" : "no prototyping evidence"}.`,
    evidence: [...figma, ...proto],
  });

  // 2. Research & psychology --------------------------------------------------
  const research = scoreTerms(units, RESEARCH_TERMS, 4, 2, 20);
  criteria.push({
    key: "research",
    label: "User research & psychology",
    weight: 20,
    points: round1(research.points),
    detail: research.matched.length ? `${research.handsOnMatched.length} applied / ${research.matched.length} research methods.` : "No user-research evidence.",
    evidence: research.evidence,
  });

  // 3. Portfolio ---------------------------------------------------------------
  const designProjects = e.projects.filter((p) => DESIGN_CORE_RE.test([p.title, ...p.lines].join(" ")) || DESIGN_ADJACENT_RE.test([p.title, ...p.lines].join(" ")) || /\b(app|platform|website|dashboard|interface|experience)\b/i.test(p.title));
  const designRoles = e.experience.filter((x) => DESIGN_CORE_RE.test([x.role, ...x.bullets].join(" ")));
  const pieces = designProjects.length + designRoles.length;
  const portPts = pieces >= 4 ? 15 : pieces === 3 ? 12 : pieces === 2 ? 9 : pieces === 1 ? 6 : 0;
  criteria.push({
    key: "portfolio",
    label: "Portfolio & projects",
    weight: 15,
    points: portPts,
    detail: `${designProjects.length} design project(s) + ${designRoles.length} design role(s).`,
    evidence: [
      ...designRoles.slice(0, 3).map<Evidence>((x) => ({ term: "Design role", section: "experience", label: [x.role, x.org].filter(Boolean).join(" · "), snippet: x.bullets[0] ?? x.role, handsOn: true })),
      ...designProjects.slice(0, 4).map<Evidence>((p) => ({ term: "Design project", section: "project", label: p.title, snippet: p.lines[0] ?? p.title, handsOn: true })),
    ],
  });

  // 4. Craft ---------------------------------------------------------------------
  const craft = scoreTerms(units, CRAFT_TERMS, 2.5, 1.5, 15);
  criteria.push({
    key: "craft",
    label: "UI craft & visual design",
    weight: 15,
    points: round1(craft.points),
    detail: craft.matched.length ? `${craft.matched.length} craft signals (${craft.handsOnMatched.length} applied).` : "No UI craft signals.",
    evidence: craft.evidence,
  });

  // 5. Experience fit -------------------------------------------------------------
  const designMonths = weightedMonths(
    e.experience.map((x) => {
      const t = [x.role, ...x.bullets].join(" ");
      let w = DESIGN_CORE_RE.test(t) ? 1 : DESIGN_ADJACENT_RE.test(t) ? 0.3 : 0;
      if (x.kind === "freelance") w *= 0.5;
      return { range: x.dates, weight: w };
    }),
  );
  const dy = designMonths / 12;
  let fitPts: number;
  let fitDetail: string;
  if (dy === 0) {
    fitPts = designProjects.length >= 2 ? 9 : designProjects.length === 1 ? 6 : 2;
    fitDetail = "No dated design experience — fresher; scored on projects.";
  } else if (dy <= 1.5) {
    fitPts = 15;
    fitDetail = `${dy.toFixed(1)} yrs design experience — inside the intern band.`;
  } else if (dy <= 3) {
    fitPts = 11;
    fitDetail = `${dy.toFixed(1)} yrs design experience — above the 0–1 yr band.`;
    notes.push("More experienced than the 0–1 year band; check stipend expectations.");
  } else {
    fitPts = 7;
    fitDetail = `${dy.toFixed(1)} yrs design experience — likely over-qualified for an internship.`;
    notes.push("Likely over-qualified for a ₹10–15k internship.");
  }
  criteria.push({ key: "fit", label: "Experience fit (0–1 yr)", weight: 15, points: fitPts, detail: fitDetail, evidence: [] });

  // 6. Education ----------------------------------------------------------------
  let eduPts = 0;
  let eduBest = "";
  for (const d of e.education) {
    if (d.level === "school") continue;
    const t = `${d.degree} ${d.institution}`;
    const p = d.level === "certificate" ? 0 : DESIGN_DEGREE_RE.test(t) ? 10 : TECH_DEGREE_RE.test(t) ? 6 : 4;
    if (p > eduPts) {
      eduPts = p;
      eduBest = d.degree;
    }
  }
  const uxCert = [...e.certifications, ...e.education.filter((d) => d.level === "certificate").map((d) => d.degree)].some((c) => /ux|ui|design|figma|hci|human computer/i.test(c));
  if (uxCert) eduPts = Math.min(10, eduPts + 2);
  criteria.push({
    key: "education",
    label: "Education",
    weight: 10,
    points: eduPts,
    detail: `${eduBest || "No degree found"}${uxCert ? " + UX certification" : ""}`,
    evidence: [],
  });

  // 7. Domain -------------------------------------------------------------------
  const domain = scoreTerms(units.filter((u) => u.handsOn), DOMAIN_TERMS, 1.5, 0, 5);
  criteria.push({
    key: "domain",
    label: "Website / job-board relevance",
    weight: 5,
    points: round1(domain.points),
    detail: domain.matched.length ? domain.matched.join(", ") : "No directly relevant product domains.",
    evidence: domain.evidence,
  });

  const hard: HardCheck[] = [
    { key: "figma", label: "Figma & prototyping", status: figma.length && proto.length ? "pass" : figma.length || proto.length ? "partial" : "fail", detail: criteria[0].detail },
    {
      key: "psychology",
      label: "User psychology / research",
      status: research.handsOnMatched.length >= 2 ? "pass" : research.matched.length ? "partial" : "fail",
      detail: `${research.handsOnMatched.length} applied research methods`,
    },
    { key: "portfolio", label: "Design portfolio", status: pieces >= 2 ? "pass" : pieces === 1 ? "partial" : "fail", detail: `${pieces} design pieces` },
    { key: "band", label: "0–1 yr experience band", status: dy <= 1.5 ? "pass" : dy <= 3 ? "partial" : "fail", detail: `${dy.toFixed(1)} yrs design experience` },
  ];

  const score = round1(criteria.reduce((s, c) => s + c.points, 0));
  return {
    jobId: "ux",
    score,
    criteria,
    hard,
    facts: { relevantYears: round1(dy), totalYears: round1(e.totalMonths / 12), designPieces: pieces },
    notes,
  };
}
