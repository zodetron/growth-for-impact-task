import { listJobs } from "@/lib/repo";

export async function GET() {
  try {
    return Response.json({ jobs: await listJobs() });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
