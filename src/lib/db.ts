import { Pool } from "pg";

declare global {
  var __pgPool: Pool | undefined;
}

/** Local Postgres: plain TCP. Hosted (Neon): verified TLS; libpq-only params are stripped so node-postgres doesn't warn. */
export function pool(): Pool {
  if (!globalThis.__pgPool) {
    const raw = process.env.DATABASE_URL;
    if (!raw) throw new Error("DATABASE_URL is not set");
    const local = /localhost|127\.0\.0\.1/.test(raw);
    let connectionString = raw;
    if (!local) {
      const u = new URL(raw);
      u.searchParams.delete("sslmode");
      u.searchParams.delete("channel_binding");
      connectionString = u.toString();
    }
    globalThis.__pgPool = new Pool({
      connectionString,
      ssl: local ? undefined : true,
      max: local ? 5 : 3,
      idleTimeoutMillis: 10000,
    });
  }
  return globalThis.__pgPool;
}
