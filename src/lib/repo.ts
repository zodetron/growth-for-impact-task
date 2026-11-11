import { pool } from "./db";
import type { ProcessedResume } from "./types";
import { JOBS } from "./jobs";

export async function upsertJobs(jdText: Partial<Record<"lca" | "ux", string>> = {}) {
  for (const job of Object.values(JOBS)) {
    await pool().query(
      `insert into jobs (id, title, short_title, source_file, jd_text, profile, updated_at)
       values ($1,$2,$3,$4,$5,$6, now())
       on conflict (id) do update set title=excluded.title, short_title=excluded.short_title, source_file=excluded.source_file,
         jd_text=coalesce(excluded.jd_text, jobs.jd_text), profile=excluded.profile, updated_at=now()`,
      [job.id, job.title, job.shortTitle, job.sourceFile, jdText[job.id] ?? null, JSON.stringify(job)],
    );
  }
}

export async function saveProcessed(
  p: ProcessedResume,
  file: Buffer,
  opts: { source: "seed" | "upload"; inPile: boolean },
): Promise<string> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const r = await client.query<{ id: string }>(
      `insert into resumes (filename, file_hash, mime_type, file_bytes, candidate_code, headline, raw_text, status, source, in_pile,
                            extraction, issues, classification, llm, llm_status, processed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
       on conflict (file_hash) do update set filename=excluded.filename, mime_type=excluded.mime_type, candidate_code=excluded.candidate_code,
         headline=excluded.headline, raw_text=excluded.raw_text, status=excluded.status, extraction=excluded.extraction,
         issues=excluded.issues, classification=excluded.classification,
         llm=coalesce(excluded.llm, resumes.llm), llm_status=case when excluded.llm is null then coalesce(resumes.llm_status, excluded.llm_status) else excluded.llm_status end,
         in_pile = resumes.in_pile or excluded.in_pile, processed_at=now()
       returning id`,
      [
        p.filename,
        p.fileHash,
        p.mimeType,
        file,
        p.extraction?.code ?? null,
        p.llm?.headline || p.extraction?.headline || null,
        p.rawText,
        p.status,
        opts.source,
        opts.inPile,
        p.extraction ? JSON.stringify(p.extraction) : null,
        JSON.stringify(p.issues),
        JSON.stringify(p.classification),
        p.llm ? JSON.stringify(p.llm) : null,
        p.llmStatus,
      ],
    );
    const id = r.rows[0].id;
    await client.query("delete from scores where resume_id=$1", [id]);
    if (p.scores) {
      for (const s of [p.scores.lca, p.scores.ux]) {
        await client.query(
          `insert into scores (resume_id, job_id, score, breakdown, hard_requirements) values ($1,$2,$3,$4,$5)`,
          [id, s.jobId, s.score, JSON.stringify({ criteria: s.criteria, facts: s.facts, notes: s.notes }), JSON.stringify(s.hard)],
        );
      }
    }
    await client.query("commit");
    return id;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export async function findByHash(hash: string) {
  const r = await pool().query<{ id: string; in_pile: boolean }>("select id, in_pile from resumes where file_hash=$1", [hash]);
  return r.rows[0] ?? null;
}

const CANDIDATE_SELECT = `
  select r.id, r.filename, r.mime_type, r.candidate_code, r.headline, r.status, r.source, r.in_pile, r.extraction, r.issues,
         r.classification, r.llm, r.llm_status, r.created_at,
         coalesce(json_object_agg(s.job_id, json_build_object('score', s.score, 'breakdown', s.breakdown, 'hard', s.hard_requirements))
                  filter (where s.job_id is not null), '{}'::json) as scores
  from resumes r left join scores s on s.resume_id = r.id`;

export async function listCandidates(includeId?: string | null) {
  const r = await pool().query(
    `${CANDIDATE_SELECT} where r.in_pile or r.id::text = $1 group by r.id order by r.created_at`,
    [includeId ?? ""],
  );
  return r.rows;
}

export async function getCandidate(id: string) {
  const r = await pool().query(`${CANDIDATE_SELECT.replace("r.created_at,", "r.created_at, r.raw_text,")} where r.id::text=$1 group by r.id`, [id]);
  return r.rows[0] ?? null;
}

export async function getFile(id: string) {
  const r = await pool().query<{ filename: string; mime_type: string; file_bytes: Buffer }>(
    "select filename, mime_type, file_bytes from resumes where id::text=$1",
    [id],
  );
  return r.rows[0] ?? null;
}

export async function setInPile(id: string, inPile: boolean) {
  const r = await pool().query("update resumes set in_pile=$2 where id::text=$1 returning id", [id, inPile]);
  return r.rowCount === 1;
}

export async function deleteUpload(id: string) {
  const r = await pool().query("delete from resumes where id::text=$1 and source='upload' and not in_pile", [id]);
  return r.rowCount === 1;
}

export async function purgeStaleUploads() {
  await pool().query("delete from resumes where source='upload' and not in_pile and created_at < now() - interval '24 hours'");
}

export async function listJobs() {
  const r = await pool().query("select id, title, short_title, source_file, jd_text, profile from jobs order by id");
  return r.rows;
}
