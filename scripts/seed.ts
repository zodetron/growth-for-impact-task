/**
 * Ingest the job descriptions and the resume pile.
 *   npm run seed                      # rules + LLM (env: LLM_*)
 *   npm run seed -- --no-llm          # rules only
 *   npm run seed -- --dir <folder> --jd-dir <folder>
 * Re-running is safe: resumes are keyed by file hash; an existing AI summary is kept if the LLM is skipped/fails.
 */
import fs from "fs";
import path from "path";
import { pool } from "../src/lib/db";
import { processResume } from "../src/lib/pipeline";
import { saveProcessed, upsertJobs } from "../src/lib/repo";
import { llmConfig } from "../src/lib/llm";
import { normalizeText } from "../src/lib/extract/read";

const args = process.argv.slice(2);
const arg = (name: string, def: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const root = path.join(__dirname, "..", "..");
const resumeDir = arg("--dir", path.join(root, "Software Development Assignment Resumes"));
const jdDir = arg("--jd-dir", root);
const useLlm = !args.includes("--no-llm");
const concurrency = Number(arg("--concurrency", llmConfig().provider === "Ollama" ? "1" : "2"));

async function pdfText(file: string) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync(file)));
  const r = await extractText(pdf, { mergePages: true });
  return normalizeText(String(r.text)).replace(/Made with Tally\n?/g, "").replace(/^\d+\/\d+\/\d+, \d+:\d+.*$/gm, "").replace(/^https:\/\/tally\.so.*$/gm, "");
}

(async () => {
  const cfg = llmConfig();
  console.log(`DB: ${process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ":***@")}`);
  console.log(`LLM: ${useLlm && cfg.enabled ? `${cfg.provider} · ${cfg.model}` : "off (rules only)"}`);

  const jd: Partial<Record<"lca" | "ux", string>> = {};
  for (const [id, f] of [["lca", "JD1.pdf"], ["ux", "JD2.pdf"]] as const) {
    const p = path.join(jdDir, f);
    if (fs.existsSync(p)) jd[id] = await pdfText(p);
    else console.warn(`! ${f} not found in ${jdDir}`);
  }
  await upsertJobs(jd);
  console.log(`✓ jobs ingested (${Object.keys(jd).length} JDs)`);

  const files = fs.readdirSync(resumeDir).filter((f) => /\.(docx|pdf|txt)$/i.test(f)).sort();
  let done = 0;
  const queue = [...files];
  async function worker() {
    while (queue.length) {
      const f = queue.shift()!;
      const buf = fs.readFileSync(path.join(resumeDir, f));
      const t0 = Date.now();
      const r = await processResume(f, buf, { useLlm });
      await saveProcessed(r, buf, { source: "seed", inPile: true });
      done++;
      console.log(
        `[${String(done).padStart(2)}/${files.length}] ${f.padEnd(42)} ${r.status.padEnd(7)} LCA ${String(r.scores?.lca.score ?? "–").padStart(5)}  UX ${String(r.scores?.ux.score ?? "–").padStart(5)}  ${r.classification.label.padEnd(9)} llm:${r.llmStatus} ${((Date.now() - t0) / 1000).toFixed(1)}s`,
      );
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  await pool().end();
  console.log("✓ seed complete");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
