import type { NextRequest } from "next/server";
import { deleteUpload, getCandidate, setInPile } from "@/lib/repo";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/candidates/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
  const c = await getCandidate(id);
  return c ? Response.json({ candidate: c }) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/candidates/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { in_pile?: boolean };
  if (typeof body.in_pile !== "boolean") return Response.json({ error: "Expected { in_pile: boolean }" }, { status: 400 });
  return (await setInPile(id, body.in_pile)) ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/candidates/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
  return (await deleteUpload(id))
    ? Response.json({ ok: true })
    : Response.json({ error: "Only unsaved uploads can be discarded" }, { status: 409 });
}
