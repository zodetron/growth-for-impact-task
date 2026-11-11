-- Talent Lens schema (PostgreSQL 13+; works on local Postgres and Neon)
create table if not exists jobs (
  id            text primary key,              -- 'lca' | 'ux'
  title         text not null,
  short_title   text not null,
  source_file   text,
  jd_text       text,
  profile       jsonb not null,                -- requirements, rubric weights, facts
  updated_at    timestamptz not null default now()
);

create table if not exists resumes (
  id                uuid primary key default gen_random_uuid(),
  filename          text not null,
  file_hash         text not null unique,
  mime_type         text,
  file_bytes        bytea,
  candidate_code    text,
  headline          text,
  raw_text          text,
  status            text not null,             -- ok | partial | failed
  source            text not null default 'seed', -- seed | upload
  in_pile           boolean not null default true,
  extraction        jsonb,
  issues            jsonb not null default '[]'::jsonb,
  classification    jsonb,
  llm               jsonb,
  llm_status        text,                      -- ok | skipped | failed
  created_at        timestamptz not null default now(),
  processed_at      timestamptz
);

create table if not exists scores (
  resume_id         uuid not null references resumes(id) on delete cascade,
  job_id            text not null references jobs(id) on delete cascade,
  score             numeric(5,1) not null,
  breakdown         jsonb not null,
  hard_requirements jsonb not null,
  primary key (resume_id, job_id)
);

create index if not exists resumes_in_pile_idx on resumes (in_pile);
create index if not exists scores_job_idx on scores (job_id, score desc);
