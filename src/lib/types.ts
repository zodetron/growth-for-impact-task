export type Severity = "info" | "warning" | "error";
export type Stage = "read" | "parse" | "extract" | "score" | "llm";

export interface Issue {
  stage: Stage;
  severity: Severity;
  code: string;
  message: string;
}

export interface DateRange {
  raw: string;
  start: string | null; // YYYY-MM
  end: string | null; // YYYY-MM
  ongoing: boolean;
  months: number | null;
  approximate: boolean;
}

export interface ExperienceEntry {
  role: string;
  org: string;
  dates: DateRange;
  bullets: string[];
  kind: "job" | "internship" | "academic" | "freelance";
}

export interface ProjectEntry {
  title: string;
  lines: string[];
}

export type EduLevel = "doctorate" | "masters" | "bachelors" | "diploma" | "certificate" | "school" | "other";

export interface EducationEntry {
  degree: string;
  institution: string;
  years: string | null;
  grade: string | null;
  level: EduLevel;
}

export interface Extraction {
  code: string;
  headline: string;
  summary: string;
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  certifications: string[];
  skills: Record<string, string[]>;
  awards: string[];
  languages: string[];
  sectionsFound: string[];
  parser: "template" | "heuristic" | "llm";
  claimedYears: number | null;
  totalMonths: number;
  wordCount: number;
}

export interface Evidence {
  term: string;
  section: string; // experience | project | skills | summary | education | certification
  label: string;
  snippet: string;
  handsOn: boolean;
}

export interface Criterion {
  key: string;
  label: string;
  weight: number;
  points: number;
  detail: string;
  evidence: Evidence[];
}

export type HardStatus = "pass" | "partial" | "fail" | "unknown";

export interface HardCheck {
  key: string;
  label: string;
  status: HardStatus;
  detail: string;
}

export interface JobScore {
  jobId: "lca" | "ux";
  score: number;
  criteria: Criterion[];
  hard: HardCheck[];
  facts: Record<string, string | number | null>;
  notes: string[];
}

export type ClassLabel = "lca" | "ux" | "both" | "neither" | "uncertain";

export interface Classification {
  label: ClassLabel;
  lean: "lca" | "ux" | null;
  confidence: "high" | "medium" | "low";
  reason: string;
}

export interface LlmNarrative {
  headline: string;
  summary: string;
  lca_take: string;
  ux_take: string;
  strengths: string[];
  concerns: string[];
  model: string;
}

export interface ProcessedResume {
  filename: string;
  mimeType: string;
  fileHash: string;
  rawText: string;
  status: "ok" | "partial" | "failed";
  extraction: Extraction | null;
  issues: Issue[];
  scores: { lca: JobScore; ux: JobScore } | null;
  classification: Classification;
  llm: LlmNarrative | null;
  llmStatus: "ok" | "skipped" | "failed";
}
