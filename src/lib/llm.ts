import type { Extraction, JobScore, LlmNarrative } from "./types";

/**
 * Thin OpenAI-compatible client. Works with local Ollama (http://localhost:11434/v1)
 * and hosted providers such as Groq (https://api.groq.com/openai/v1) — only env vars change.
 */
export function llmConfig() {
  const enabled = (process.env.LLM_ENABLED ?? "on") !== "off" && !!process.env.LLM_BASE_URL;
  return {
    enabled,
    baseUrl: (process.env.LLM_BASE_URL ?? "").replace(/\/$/, ""),
    model: process.env.LLM_MODEL ?? "llama3.1:8b",
    apiKey: process.env.LLM_API_KEY ?? "",
    provider: /groq/i.test(process.env.LLM_BASE_URL ?? "")
      ? "Groq"
      : /11434|ollama/i.test(process.env.LLM_BASE_URL ?? "")
        ? "Ollama"
        : "OpenAI-compatible",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function chatJson(system: string, user: string, timeoutMs = 45000): Promise<unknown> {
  const cfg = llmConfig();
  if (!cfg.enabled) throw new Error("LLM disabled");
  const deadline = Date.now() + timeoutMs;
  for (let attempt = 0; ; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 1000) throw new Error(`${cfg.provider} timed out after ${timeoutMs / 1000}s`);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), remaining);
    try {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
        body: JSON.stringify({
          model: cfg.model,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (res.status === 429 || res.status >= 500) {
        const body = await res.text();
        const hinted = parseFloat(res.headers.get("retry-after") ?? "") || parseFloat(body.match(/try again in ([\d.]+)s/i)?.[1] ?? "");
        const waitMs = Math.min(20000, Math.max(1000, (hinted || 2 ** attempt * 2) * 1000));
        if (attempt < 4 && Date.now() + waitMs < deadline - 2000) {
          await sleep(waitMs);
          continue;
        }
        throw new Error(res.status === 429 ? `${cfg.provider} rate limit reached — try again in a minute` : `${cfg.provider} HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(`${cfg.provider} HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content ?? "";
      const jsonText = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
      return JSON.parse(jsonText);
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new Error(`${cfg.provider} timed out after ${timeoutMs / 1000}s`);
      throw e;
    } finally {
      clearTimeout(t);
    }
  }
}

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strArr = (v: unknown, n = 4, max = 200) =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, n).map((x: string) => x.trim().slice(0, max)) : [];

const STATUS_WORD = { pass: "MET", partial: "PARTLY MET", fail: "NOT MET", unknown: "UNKNOWN" } as const;

function compact(e: Extraction, s: { lca: JobScore; ux: JobScore }) {
  const best = s.lca.score >= s.ux.score ? "LCA Consultant" : "UI/UX Design Intern";
  return {
    best_fit_role: best,
    headline: e.headline,
    summary: e.summary.slice(0, 500),
    experience: e.experience.slice(0, 6).map((x) => ({ role: x.role, org: x.org, dates: x.dates.raw, highlights: x.bullets.slice(0, 3).map((b) => b.slice(0, 160)) })),
    projects: e.projects.slice(0, 5).map((p) => p.title),
    education: e.education.filter((d) => d.level !== "school").map((d) => d.degree),
    skills: Object.values(e.skills).flat().slice(0, 30),
    scores: {
      lca: { total: s.lca.score, criteria: s.lca.criteria.map((c) => `${c.label}: ${c.points}/${c.weight} — ${c.detail}`), requirements: s.lca.hard.map((h) => `${h.label}: ${STATUS_WORD[h.status]} (${h.detail})`) },
      ux: { total: s.ux.score, criteria: s.ux.criteria.map((c) => `${c.label}: ${c.points}/${c.weight} — ${c.detail}`), requirements: s.ux.hard.map((h) => `${h.label}: ${STATUS_WORD[h.status]} (${h.detail})`) },
    },
  };
}

const NARRATIVE_SYSTEM = `You are an assistant to a non-technical HR team screening resumes for two openings:
(1) LCA Consultant — 2–3 yrs running Life Cycle Assessments, GaBi/SimaPro, ≥3 LCA projects, ISO 14040/44, onsite Chennai.
(2) UI/UX Design Intern — 0–1 yr, Figma, user research & psychology, strong visual craft; remote; will redesign a sustainability jobs website.
You receive structured data extracted from ONE resume plus a deterministic rubric score. Do NOT change or re-compute the scores.
Write plain, specific, factual English grounded only in the provided data. Never invent employers, numbers or skills.
Requirement outcomes are already decided and labelled MET / PARTLY MET / NOT MET / UNKNOWN — repeat them faithfully; never call a MET requirement a gap.
"strengths" and "concerns" must be about the candidate's best_fit_role only. Concerns should name NOT MET or PARTLY MET requirements of that role, or real gaps visible in the data.
Return JSON: {"headline": string (max 12 words, describe the candidate's profile), "summary": string (2 sentences), "lca_take": string (1-2 sentences on fit for the LCA role referencing the score), "ux_take": string (1-2 sentences on fit for the UI/UX internship referencing the score), "strengths": string[] (max 3, short), "concerns": string[] (max 3, short; include gaps against must-have requirements)}`;

export async function narrate(e: Extraction, s: { lca: JobScore; ux: JobScore }): Promise<LlmNarrative> {
  const out = (await chatJson(NARRATIVE_SYSTEM, JSON.stringify(compact(e, s)))) as Record<string, unknown>;
  const n: LlmNarrative = {
    headline: str(out.headline, 120),
    summary: str(out.summary),
    lca_take: str(out.lca_take),
    ux_take: str(out.ux_take),
    strengths: strArr(out.strengths, 3),
    concerns: strArr(out.concerns, 3),
    model: `${llmConfig().provider} · ${llmConfig().model}`,
  };
  if (!n.summary && !n.lca_take) throw new Error("LLM returned an empty or malformed response");
  return n;
}

const STRUCTURE_SYSTEM = `Extract the resume into JSON. Copy text verbatim; do not invent anything. Use "" or [] when absent.
Schema: {"headline": string, "summary": string,
"experience": [{"role": string, "org": string, "dates": string (as written, e.g. "Jan 2022 – Present"), "bullets": string[]}],
"projects": [{"title": string, "lines": string[]}],
"education": [{"degree": string, "institution": string, "years": string, "grade": string}],
"skills": string[], "certifications": string[], "languages": string[]}`;

export interface StructuredResume {
  headline: string;
  summary: string;
  experience: { role: string; org: string; dates: string; bullets: string[] }[];
  projects: { title: string; lines: string[] }[];
  education: { degree: string; institution: string; years: string; grade: string }[];
  skills: string[];
  certifications: string[];
  languages: string[];
}

/** Used only when the rule-based parser cannot find the resume's structure (non-template uploads). */
export async function structureResume(text: string): Promise<StructuredResume> {
  const o = (await chatJson(STRUCTURE_SYSTEM, text.slice(0, 12000), 60000)) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]).filter((x) => x && typeof x === "object") : []);
  return {
    headline: str(o.headline, 160),
    summary: str(o.summary, 1500),
    experience: arr(o.experience).map((x) => ({ role: str(x.role, 160), org: str(x.org, 160), dates: str(x.dates, 60), bullets: strArr(x.bullets, 15, 400) })),
    projects: arr(o.projects).map((x) => ({ title: str(x.title, 160), lines: strArr(x.lines, 10, 400) })),
    education: arr(o.education).map((x) => ({ degree: str(x.degree, 200), institution: str(x.institution, 200), years: str(x.years, 40), grade: str(x.grade, 40) })),
    skills: strArr(o.skills, 60, 80),
    certifications: strArr(o.certifications, 20, 200),
    languages: strArr(o.languages, 10, 40),
  };
}
