# Talent Lens — resume screening prototype

Talent Lens ingests the two job descriptions (JD1 *LCA Consultant*, JD2 *UI/UX Design Intern*) and the 47 anonymised resumes, extracts job‑relevant information, scores every resume against **both** roles with a transparent rubric, classifies it (LCA · UI/UX · Both · Uncertain · Neither) and ranks the pile separately per role. Reviewers can upload a new resume and see where it would land before saving it to the pile.

**Stack:** Next.js 16 (App Router) · PostgreSQL (local Postgres / Neon on Vercel) · any OpenAI‑compatible LLM (Ollama locally, Groq in production).

---

## How it works

```
file ─► read ─► parse/extract ─► score (LCA, UI/UX) ─► classify ─► AI reviewer note ─► Postgres ─► UI
        docx/pdf/txt   rules (+LLM fallback)   deterministic rubric      thresholds        LLM (explanatory only)
```

| Stage | What happens | Failure handling |
|---|---|---|
| **Read** | `.docx` via mammoth, `.pdf` via unpdf, `.txt` | Empty doc, scanned PDF (no text layer), legacy `.doc`, corrupt file → `error` issue, resume marked *Unreadable* but kept with a link to the original |
| **Extract** | Rule‑based section parser: experience (role, org, date range, bullets, internship/academic/freelance kind), projects, education (level, grade), skills, certifications, languages. Overlap‑aware month counting so concurrent roles aren't double counted | Unparseable / missing dates, future end dates, odd education years, sparse resumes, and **anonymiser damage** (e.g. `ISO /s` where digits were stripped) are recorded as warnings. If the layout isn't recognised at all, the LLM structures the resume into the same schema |
| **Score** | Two 100‑point rubrics (below). Every point is backed by quoted evidence with its section and source line | Pure functions → reproducible; no LLM involvement |
| **Classify** | Both ≥ 50 → **Both** · one ≥ 50 → that role · best 28–49 → **Uncertain** (with lean) · both < 28 → **Neither** · unreadable → **Uncertain/Unreadable**. Confidence drops when extraction was damaged | — |
| **Explain** | LLM writes a headline, summary, per‑role take, strengths and concerns from the extracted evidence | If the LLM is down/slow, the score is unaffected and the issue is shown |

### LCA Consultant rubric (JD1)

| Criterion | Pts | Rule |
|---|---|---|
| Relevant LCA experience | 25 | Months in roles whose text shows LCA work count 100%, adjacent sustainability/GHG roles 25%, internships/academic ×0.5. ≥2 yrs = full (JD: 2–3 yrs) |
| GaBi / SimaPro | 20 | Used in work 20 · listed only 15 · other LCA tool only (openLCA, Air.e…) 8 |
| Completed LCA projects | 15 | Distinct LCA studies/EPDs in experience & projects: ≥3 = 15, 2 = 10, 1 = 5 |
| Methodology depth | 15 | LCI, system boundary, functional unit, cradle‑to‑gate, ecoinvent, impact methods, hotspots, data validation, benchmarking… |
| ISO 14040/14044 | 10 | Explicit 10 · redacted‑digit ISO in LCA context 7 · related standards 5 |
| Education | 10 | Environmental 10 · engineering/science 6 · other 3 |
| EPD (preferred) | 5 | Applied 5 · mentioned 3 |

Must‑have checks shown as pass/partial/fail: 2–3 yrs, GaBi/SimaPro, ≥3 projects, ISO 14040/44, Chennai onsite (usually *unknown* — resumes don't state location).

### UI/UX Intern rubric (JD2)

| Criterion | Pts | Rule |
|---|---|---|
| Figma & prototyping | 20 | Figma in work 14 / listed 10, + prototyping 6 |
| User research & psychology | 20 | Interviews, usability tests, personas, journeys, heuristics, A/B, behavioural UX… 4 applied / 2 listed |
| Portfolio & projects | 15 | Design projects + design roles: 1→6 … 4+→15 |
| UI craft | 15 | Hierarchy, typography, design systems, responsive, WCAG, micro‑interactions… |
| Experience fit (0–1 yr) | 15 | ≤1.5 yrs 15 · fresher with projects 9 · 1.5–3 yrs 11 · >3 yrs 7 (over‑qualified) |
| Education | 10 | Design/HCI 10 · CS/IT/engineering 6 · other 4 · +2 UX certificate |
| Website / job‑board relevance | 5 | Websites, hiring platforms, dashboards, sustainability |

> **Note:** the problem statement says the LCA role needs 4–6 years, while JD1 says 2–3 years. The JD is used, as agreed; the band lives in `src/lib/scoring/lca.ts` and `src/lib/jobs.ts`.

---

## Run locally

```bash
cp .env.example .env.local          # DATABASE_URL + LLM_* (Ollama by default)
createdb talent_lens
npm install
npm run db:migrate
npm run seed                        # reads ../JD1.pdf ../JD2.pdf and ../Software Development Assignment Resumes
# npm run seed -- --no-llm          # rules only (seconds) — keeps any AI notes already stored
npm run dev
```

## Deploy to Vercel (free)

1. **Database:** create a free Neon Postgres (Vercel dashboard → Storage → Neon, or neon.tech). Copy its connection string.
2. **LLM:** create a free Groq API key at console.groq.com.
3. **Seed production DB** from your machine:
   ```bash
   DATABASE_URL="postgres://…neon…?sslmode=require" npm run db:migrate
   DATABASE_URL="postgres://…neon…?sslmode=require" \
   LLM_BASE_URL=https://api.groq.com/openai/v1 LLM_MODEL=openai/gpt-oss-120b LLM_API_KEY=gsk_… \
   npm run seed
   ```
4. **Deploy:** `vercel` → set env vars `DATABASE_URL`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_ENABLED=on` → `vercel --prod`.

Uploads run inside `/api/upload` (60 s max duration) and are stored as *unsaved* until a reviewer clicks **Save to pile**; unsaved uploads are purged after 24 h.

## Project layout

```
db/schema.sql                 jobs · resumes (original file bytes, raw text, extraction, issues, classification, AI note) · scores
scripts/seed.ts, migrate.ts   ingestion CLI
src/lib/extract/              read.ts (file → text) · parse.ts (sections, roles, education, quality checks) · dates.ts
src/lib/scoring/              lca.ts · ux.ts · classify.ts · evidence.ts (quoted evidence helpers)
src/lib/llm.ts                OpenAI-compatible client: narrative + layout fallback
src/lib/pipeline.ts           end-to-end processing of one file
src/app/api/                  candidates, candidate detail/save/discard, original file download, upload, jobs, health
src/components/               liquid-glass UI (App, JobPanel, Detail drawer, Upload dialog)
```
