import type { EduLevel, EducationEntry, ExperienceEntry, Extraction, Issue, ProjectEntry } from "../types";
import { parseDateRange, TRAILING_RANGE_RE, weightedMonths, nowYm, monthIndex } from "./dates";

type SectionKey =
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "summary"
  | "skills"
  | "tools"
  | "awards"
  | "languages";

const SECTION_PATTERNS: [SectionKey, RegExp][] = [
  ["experience", /^(work |professional |relevant |industry )?(experience|employment( history)?|work history|internships?( experience)?)$/i],
  ["projects", /^(projects?( \/ deliverables)?|academic projects|key projects|selected projects|portfolio|case studies)$/i],
  ["education", /^(education|academic background|academics|qualifications?|education & training)$/i],
  ["certifications", /^(certifications?( & licen[cs]es)?|licen[cs]es|courses|certifications & courses|trainings?)$/i],
  ["summary", /^(professional summary|summary|profile|about me|about|objective|career objective|professional profile)$/i],
  ["skills", /^(core skills|skills|technical skills|key skills|core competencies|competencies|skills & tools|skill set)$/i],
  ["tools", /^(tools \/ technologies|tools|technologies|software|tools & technologies)$/i],
  ["awards", /^(awards \/ honors|awards|honors|honours|achievements|awards & achievements|accomplishments)$/i],
  ["languages", /^languages?( known)?$/i],
];

function sectionOf(line: string): SectionKey | null {
  const clean = line.replace(/[:：]\s*$/, "").trim();
  if (clean.length > 40) return null;
  for (const [key, re] of SECTION_PATTERNS) if (re.test(clean)) return key;
  return null;
}

const BULLET_RE = /^[•▪●◦\-*–·]\s*/;
const isBullet = (l: string) => BULLET_RE.test(l);
const stripBullet = (l: string) => l.replace(BULLET_RE, "").trim();

export function classifyKind(role: string): ExperienceEntry["kind"] {
  if (/\b(intern(ship)?s?|apprentice)\b/i.test(role)) return "internship";
  if (/\btrainee\b/i.test(role)) return /\b(graduate engineer|upskill|management|system engineer)\b/i.test(role) ? "job" : "internship";
  if (/\b(teaching assistant|research (fellow|assistant|scholar)|junior research fellow|graduate teaching)\b/i.test(role)) return "academic";
  if (/\b(freelanc|self[- ]directed|independent|creator)\b/i.test(role)) return "freelance";
  return "job";
}

const ROLE_WORD_RE =
  /\b(consultant|engineer|analyst|intern|designer|developer|manager|executive|associate|assistant|lead|head|officer|specialist|scientist|researcher|fellow|trainee|coordinator|director|founder|architect|writer)\b/i;

function parseExperienceHeader(line: string): Pick<ExperienceEntry, "role" | "org" | "dates"> | null {
  if (isBullet(line)) return null;
  // "Company, Role (Jan 2023 to Present)"
  const paren = line.match(/^(.{3,120}?)\s*[(\[]([^()\[\]]{4,40})[)\]]\s*$/);
  if (paren && TRAILING_RANGE_RE.test(paren[2].trim())) {
    const head = paren[1].replace(/[,|–—-]\s*$/, "").trim();
    const [a, b] = head.split(/\s+[—|–]\s+|\s+(?:at|@)\s+|,\s+/);
    if (!b) return { role: head, org: "", dates: parseDateRange(paren[2].trim()) };
    const roleFirst = ROLE_WORD_RE.test(a) || !ROLE_WORD_RE.test(b);
    return { role: (roleFirst ? a : b).trim(), org: (roleFirst ? b : a).trim(), dates: parseDateRange(paren[2].trim()) };
  }
  const parts = line.split(/\s+[—|]\s+/);
  if (parts.length < 2) {
    // "Role at Company   Jan 2020 – Present" style
    const m = line.match(TRAILING_RANGE_RE);
    if (m && line.length < 140 && m.index && m.index > 3) {
      const head = line.slice(0, m.index).replace(/[,|–-]\s*$/, "").trim();
      const [role, org] = head.split(/\s+(?:at|@)\s+|,\s+/);
      return { role: role.trim(), org: (org ?? "").trim(), dates: parseDateRange(m[1]) };
    }
    return null;
  }
  const role = parts[0].trim();
  let rest = parts.slice(1).join(" — ").trim();
  let datesRaw = "";
  const spaced = rest.match(/^(.*?)\s{2,}(.+)$/);
  if (spaced) {
    rest = spaced[1].trim();
    datesRaw = spaced[2].trim();
  } else {
    const m = rest.match(TRAILING_RANGE_RE);
    if (m && m.index !== undefined) {
      datesRaw = m[1];
      rest = rest.slice(0, m.index).trim();
    }
  }
  if (role.length > 120) return null;
  return { role, org: rest, dates: parseDateRange(datesRaw) };
}

function parseExperience(lines: string[]): ExperienceEntry[] {
  const out: ExperienceEntry[] = [];
  for (const line of lines) {
    const head = parseExperienceHeader(line);
    if (head) {
      out.push({ ...head, bullets: [], kind: classifyKind(head.role) });
      continue;
    }
    const text = stripBullet(line);
    if (!text) continue;
    if (out.length === 0) out.push({ role: "Unlabelled role", org: "", dates: parseDateRange(""), bullets: [], kind: "job" });
    out[out.length - 1].bullets.push(text);
  }
  return out;
}

function parseProjects(lines: string[]): ProjectEntry[] {
  const out: ProjectEntry[] = [];
  let lastWasBullet = false;
  for (const line of lines) {
    const bullet = isBullet(line);
    const text = stripBullet(line);
    if (!text) continue;
    const cur = out[out.length - 1];
    if (bullet) {
      if (!cur) out.push({ title: text.slice(0, 80), lines: [text] });
      else cur.lines.push(text);
      lastWasBullet = true;
      continue;
    }
    const looksLikeTitle = text.length <= 90 && !/[.]$/.test(text);
    if (!cur || lastWasBullet) out.push({ title: text, lines: [] });
    else if (cur.lines.length === 0) cur.lines.push(text);
    else if (looksLikeTitle) out.push({ title: text, lines: [] });
    else cur.lines.push(text);
    lastWasBullet = false;
  }
  return out;
}

const DEGREE_RE =
  /\b(ph\.?\s?d|doctor|master|m\.?\s?tech|m\.?\s?sc|m\.?\s?e\b|m\.?\s?s\b|m\.s\.|mba|m\.?\s?des|m\.?\s?a\b|m\.a\.|pgd\w*|post ?graduat\w*|bachelor|b\.?\s?tech|b\.?\s?e\b|b\.e\.|b\.?\s?sc|b\.?\s?des|bca|bba|b\.?\s?a\b|b\.a\.|b\.?\s?com|diploma|class\s+(x|xii|10|12)|\bxii?\b|hsc|ssc|sslc|hse|sse|higher secondary|intermediate|pre[- ]?university|science stream|cbse|madhymik|high school|certificate|dual m\.?sc|^x$|^xii$|^(10|12)th\b)/i;

export function eduLevel(degree: string): EduLevel {
  const d = degree.toLowerCase();
  if (/ph\.?\s?d|doctor/.test(d)) return "doctorate";
  if (/master|m\.?\s?tech|m\.?\s?sc|\bm\.?\s?e\b|\bm\.?s\b|m\.s\.|mba|m\.?\s?des|\bm\.a\b|m\.a\.|pgd|post ?graduat|dual m\.?sc/.test(d)) return "masters";
  if (/bachelor|b\.?\s?tech|\bb\.?\s?e\b|b\.e\.|b\.?\s?sc|b\.?\s?des|\bbca\b|\bbba\b|\bb\.?\s?a\b|b\.a\.|b\.?\s?com/.test(d)) return "bachelors";
  if (/diploma/.test(d)) return "diploma";
  if (/certificate|course/.test(d)) return "certificate";
  if (/class|xii|\bx\b|hsc|ssc|sslc|hse|sse|higher secondary|intermediate|pre[- ]?university|science stream|cbse|madhymik|high school/.test(d)) return "school";
  return "other";
}

const GRADE_RE = /\b(c?gpa|ogpa|cgpi|percentage|score|grade)\b|^\d{1,3}(\.\d+)?\s*%$|^\d(\.\d+)?\s*cgpa/i;

function splitYears(line: string): { head: string; years: string | null } {
  const m = line.match(TRAILING_RANGE_RE) ?? line.match(/((?:expected in |completed in )?(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s)?\d{4}(?:-\d{2})?)\s*$/i);
  if (m && m.index !== undefined && m.index > 0) {
    return { head: line.slice(0, m.index).replace(/[,\s]+$/, "").trim(), years: m[1].trim() };
  }
  return { head: line, years: null };
}

function parseEducation(lines: string[]): EducationEntry[] {
  const out: EducationEntry[] = [];
  for (const raw of lines) {
    const line = stripBullet(raw);
    if (!line) continue;
    const cur = out[out.length - 1];
    if (cur && GRADE_RE.test(line)) {
      cur.grade = line.replace(/^(c?gpa|ogpa|cgpi|percentage|score)\s*[:–-]?\s*/i, "").trim();
      continue;
    }
    if (cur && /^(specialization|focus|coursework|foundations)\b/i.test(line)) {
      cur.degree += ` (${line})`;
      continue;
    }
    if (DEGREE_RE.test(line) && (!cur || cur.institution)) {
      out.push({ degree: line, institution: "", years: null, grade: null, level: eduLevel(line) });
      continue;
    }
    if (cur && !cur.institution) {
      const { head, years } = splitYears(line);
      cur.institution = head;
      cur.years = years;
      continue;
    }
    if (cur) cur.institution += ` · ${line}`;
    else out.push({ degree: line, institution: "", years: null, grade: null, level: eduLevel(line) });
  }
  return out;
}

function splitList(s: string): string[] {
  return s
    .split(/\s*[,;|•·]\s*/)
    .map((x) => x.trim().replace(/\.$/, ""))
    .filter((x) => x.length > 0 && x.length < 80);
}

function parseSkills(lines: string[], into: Record<string, string[]>) {
  for (const raw of lines) {
    const line = stripBullet(raw);
    const m = line.match(/^([A-Za-z][A-Za-z /&-]{1,30}):\s*(.+)$/);
    if (m) {
      const key = m[1].trim().toLowerCase();
      into[key] = [...(into[key] ?? []), ...splitList(m[2])];
    } else {
      into.other = [...(into.other ?? []), ...splitList(line)];
    }
  }
}

const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

export function claimedYearsFrom(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s*\+?\s*(?:years?|yrs?)/i);
  if (!m) return null;
  const v = m[1].toLowerCase();
  return NUM_WORDS[v] ?? parseFloat(v);
}

export function codeFromFilename(filename: string): string | null {
  const m = filename.match(/^anonymized_([A-Za-z]+)_\d+/i);
  if (m && m[1].toLowerCase() !== "resume") return m[1].toUpperCase();
  return null;
}

export interface ParseOutput {
  extraction: Extraction;
  issues: Issue[];
}

export function parseResume(text: string, filename: string): ParseOutput {
  const issues: Issue[] = [];
  const lines = text.split("\n").map((l) => l.trim());

  const sections: Partial<Record<SectionKey, string[]>> = {};
  const header: string[] = [];
  let current: SectionKey | null = null;
  for (const line of lines) {
    if (!line) continue;
    const s = sectionOf(line);
    if (s) {
      current = s;
      sections[s] = sections[s] ?? [];
      continue;
    }
    if (current) sections[current]!.push(line);
    else header.push(line);
  }

  const sectionsFound = Object.keys(sections);
  const templateLike = ["experience", "education", "skills", "summary"].filter((k) => k in sections).length >= 2;

  const skills: Record<string, string[]> = {};
  parseSkills(sections.skills ?? [], skills);
  if (sections.tools) skills.tools = [...(skills.tools ?? []), ...sections.tools.flatMap((l) => splitList(stripBullet(l)))];

  const experience = parseExperience(sections.experience ?? []);
  const projects = parseProjects(sections.projects ?? []);
  const education = parseEducation(sections.education ?? []);
  const summary = (sections.summary ?? []).join(" ");
  const code = codeFromFilename(filename) ?? (header[0] && header[0].length <= 40 ? header[0] : "Unknown");
  const headline = header.length > 1 ? header[1] : header[0] && header[0] !== code ? header[0] : "";

  // ---------- quality checks ----------
  const now = nowYm();
  const nowIdx = now.y * 12 + (now.m - 1);
  const undated = experience.filter((e) => !e.dates.start && !e.dates.months && !e.dates.ongoing);
  if (undated.length) {
    issues.push({
      stage: "extract",
      severity: "warning",
      code: "DATE_UNPARSED",
      message: `Dates missing or unreadable for ${undated.length} role(s): ${undated
        .map((e) => `"${e.role}"${e.dates.raw ? ` (“${e.dates.raw}”)` : ""}`)
        .join(", ")}. These roles are excluded from experience totals.`,
    });
  }
  const future = experience.filter((e) => e.dates.end && !e.dates.ongoing && monthIndex(e.dates.end) > nowIdx + 1);
  if (future.length) {
    issues.push({
      stage: "extract",
      severity: "warning",
      code: "DATE_FUTURE",
      message: `End date in the future for: ${future.map((e) => `"${e.role}" (${e.dates.raw})`).join(", ")}. Treated as ongoing up to today.`,
    });
    for (const e of future) e.dates.end = `${now.y}-${String(now.m).padStart(2, "0")}`;
  }
  const yearOnly = experience.filter((e) => e.dates.approximate && e.dates.start);
  if (yearOnly.length) {
    issues.push({
      stage: "extract",
      severity: "info",
      code: "DATE_APPROX",
      message: `Year-only or duration-only dates for ${yearOnly.length} role(s); month-level experience is approximated.`,
    });
  }
  // Education year sanity (e.g. "2016 - 2027" for school)
  for (const ed of education) {
    const yrs = (ed.years ?? "").match(/\d{4}/g)?.map(Number) ?? [];
    if (yrs.length === 2 && (yrs[1] < yrs[0] || yrs[1] - yrs[0] > 8)) {
      issues.push({
        stage: "extract",
        severity: "info",
        code: "EDU_DATE_ODD",
        message: `Unusual education dates "${ed.years}" for ${ed.degree}. Likely a typo in the source resume.`,
      });
    }
  }

  // Anonymisation damage: digits / words stripped from the source text
  const damagePatterns: RegExp[] = [
    /\bISO\s*(?:\/|:|\s{2,}|,|\)|$|\s(?=and\b|[A-Z][a-z]|-))/gm,
    /\bScope s\b/g,
    /\b(?:team of|from|of|across) s\b/g,
    /\b(?:ainability|uring units|ionable|anding perf|Led ion)\b/g,
    /\bover \d?\.?s\b/g,
    /-omers\b/g,
    /\bwith ry\b/g,
  ];
  const samples: string[] = [];
  for (const re of damagePatterns) {
    for (const m of text.matchAll(re)) {
      const i = m.index ?? 0;
      samples.push(text.slice(Math.max(0, i - 25), i + 25).replace(/\s+/g, " ").trim());
    }
  }
  if (samples.length) {
    issues.push({
      stage: "extract",
      severity: "warning",
      code: "REDACTION_DAMAGE",
      message: `Text appears partially redacted by the anonymiser (numbers or words removed) in ${samples.length} place(s), e.g. “…${samples[0]}…”. Standards like ISO 14040/14044 and some durations may be under-counted.`,
    });
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 80) {
    issues.push({
      stage: "extract",
      severity: "warning",
      code: "SPARSE",
      message: `Only ${wordCount} words of content. The resume lacks detail, so scores rely on very little evidence.`,
    });
  }
  if (!sections.experience) {
    issues.push({
      stage: "extract",
      severity: "info",
      code: "NO_EXPERIENCE",
      message: "No work-experience section found. Experience is counted as zero; projects and education still score.",
    });
  }

  const totalMonths = Math.round(
    weightedMonths(experience.filter((e) => e.kind !== "academic").map((e) => ({ range: e.dates, weight: 1 }))),
  );

  return {
    extraction: {
      code,
      headline,
      summary,
      experience,
      projects,
      education,
      certifications: (sections.certifications ?? []).map(stripBullet).filter(Boolean),
      skills,
      awards: (sections.awards ?? []).map(stripBullet).filter(Boolean),
      languages: (sections.languages ?? []).flatMap((l) => splitList(stripBullet(l))),
      sectionsFound,
      parser: templateLike ? "template" : "heuristic",
      claimedYears: claimedYearsFrom(summary),
      totalMonths,
      wordCount,
    },
    issues,
  };
}
