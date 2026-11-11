import type { NextRequest } from "next/server";
import { getFile } from "@/lib/repo";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/candidates/[id]/file">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Invalid id", { status: 400 });
  const f = await getFile(id);
  if (!f || !f.file_bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(f.file_bytes), {
    headers: {
      "Content-Type": f.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${f.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
