import { processResume } from "@/lib/pipeline";
import { findByHash, getCandidate, purgeStaleUploads, saveProcessed } from "@/lib/repo";
import crypto from "crypto";

export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data with a 'file' field." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file received." }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "The uploaded file is empty (0 bytes)." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "File is larger than 5 MB." }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha256").update(buf).digest("hex");

  try {
    await purgeStaleUploads();
    const existing = await findByHash(hash);
    if (existing) {
      return Response.json({ candidate: await getCandidate(existing.id), duplicate: true, alreadyInPile: existing.in_pile });
    }
    const processed = await processResume(file.name, buf);
    const id = await saveProcessed(processed, buf, { source: "upload", inPile: false });
    return Response.json({ candidate: await getCandidate(id), duplicate: false, alreadyInPile: false });
  } catch (e) {
    return Response.json({ error: `Processing failed: ${(e as Error).message}` }, { status: 500 });
  }
}
