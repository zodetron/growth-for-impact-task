import { pool } from "@/lib/db";
import { llmConfig } from "@/lib/llm";

export async function GET() {
  const cfg = llmConfig();
  let db = "ok";
  try {
    await pool().query("select 1");
  } catch (e) {
    db = (e as Error).message;
  }
  return Response.json({ db, llm: cfg.enabled ? { provider: cfg.provider, model: cfg.model } : null });
}
