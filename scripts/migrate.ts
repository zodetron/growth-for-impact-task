import fs from "fs";
import path from "path";
import { pool } from "../src/lib/db";

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  await pool().query(sql);
  console.log("✓ schema applied");
  await pool().end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
