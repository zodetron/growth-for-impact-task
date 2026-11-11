import crypto from "crypto";
import type { Extraction, Issue, ProcessedResume } from "./types";
import { readResume } from "./extract/read";
import { parseResume, eduLevel, classifyKind, claimedYearsFrom } from "./extract/parse";
import { parseDateRange, weightedMonths } from "./extract/dates";
import { scoreLca } from "./scoring/lca";
import { scoreUx } from "./scoring/ux";
import { classify } from "./scoring/classify";
import { llmConfig, narrate, structureResume } from "./llm";

export interface ProcessOptions {
  useLlm?: boolean;
}

function fromStructured(s: Awaited<ReturnType<typeof structureResume>>, base: Extraction): Extraction {
  const experience = s.experience.map((x) => ({
    role: x.role || "Unlabelled role",
    org: x.org,
    dates: parseDateRange(x.dates),
    bullets: x.bullets,
    kind: classifyKind(x.role),
  }));
  return {
    ...base,
    headline: base.headline || s.headline,
    summary: s.summary || base.summary,
    experience,
    projects: s.projects.map((p) => ({ title: p.title, lines: p.lines })),
    education: s.education.map((d) => ({ degree: d.degree, institution: d.institution, years: d.years || null, grade: d.grade || null, level: eduLevel(d.degree) })),
    skills: { skills: s.skills },
    certifications: s.certifications,
    languages: s.languages,
    parser: "llm",
    claimedYears: claimedYearsFrom(s.summary),
    totalMonths: Math.round(weightedMonths(experience.filter((e) => e.kind !== "academic").map((e) => ({ range: e.dates, weight: 1 })))),
  };
}

/** Full pipeline: read → parse (rules, LLM fallback) → score both jobs → classify → LLM narrative. */
export async function processResume(filename: string, buffer: Buffer, opts: ProcessOptions = {}): Promise<ProcessedResume> {
  const useLlm = (opts.useLlm ?? true) && llmConfig().enabled;
  const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
  const read = await readResume(filename, buffer);
  const issues: Issue[] = [...read.issues];

  if (read.issues.some((i) => i.severity === "error")) {
    return {
      filename,
      mimeType: read.mimeType,
      fileHash,
      rawText: read.text,
      status: "failed",
      extraction: null,
      issues,
      scores: null,
      classification: classify(null, null, issues),
      llm: null,
      llmStatus: "skipped",
    };
  }

  const parsed = parseResume(read.text, filename);
  let extraction = parsed.extraction;
  let parseIssues = parsed.issues;

  // Non-template resume: the rules found too little structure → ask the LLM to structure it.
  const weak = extraction.parser === "heuristic" && extraction.experience.length === 0 && Object.keys(extraction.skills).length === 0;
  if (weak) {
    if (useLlm) {
      try {
        extraction = fromStructured(await structureResume(read.text), extraction);
        parseIssues = parseIssues.filter((i) => i.code !== "NO_EXPERIENCE");
        issues.push({ stage: "parse", severity: "info", code: "LLM_STRUCTURED", message: "Resume layout was not recognised by the rule-based parser; sections were structured by the LLM (verify against the source)." });
      } catch (err) {
        issues.push({ stage: "llm", severity: "warning", code: "LLM_STRUCTURE_FAILED", message: `Layout not recognised and LLM structuring failed (${(err as Error).message}). Scored from keywords only — treat with caution.` });
      }
    } else {
      issues.push({ stage: "parse", severity: "warning", code: "LAYOUT_UNRECOGNISED", message: "Resume layout not recognised; sections could not be separated. Scored from keywords only — treat with caution." });
    }
  }
  issues.push(...parseIssues);

  const lca = scoreLca(extraction, read.text);
  const ux = scoreUx(extraction);
  const classification = classify(lca, ux, issues);

  let llm = null;
  let llmStatus: ProcessedResume["llmStatus"] = "skipped";
  if (useLlm) {
    try {
      llm = await narrate(extraction, { lca, ux });
      llmStatus = "ok";
    } catch (err) {
      llmStatus = "failed";
      issues.push({ stage: "llm", severity: "info", code: "LLM_UNAVAILABLE", message: `AI summary unavailable (${(err as Error).message}). Scores are unaffected — they are computed by the rubric.` });
    }
  }

  const hasWarn = issues.some((i) => i.severity === "warning" && i.stage !== "llm");
  return {
    filename,
    mimeType: read.mimeType,
    fileHash,
    rawText: read.text,
    status: hasWarn ? "partial" : "ok",
    extraction,
    issues,
    scores: { lca, ux },
    classification,
    llm,
    llmStatus,
  };
}
