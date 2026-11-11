import type { NextRequest } from "next/server";
import { listCandidates } from "@/lib/repo";

export async function GET(req: NextRequest) {
  try {
    const include = req.nextUrl.searchParams.get("include");
    return Response.json({ candidates: await listCandidates(include) });
  } catch (e) {
    return Response.json({ error: `Database unavailable: ${(e as Error).message}` }, { status: 500 });
  }
}
