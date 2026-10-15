import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool, closePool } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function migrate() {
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => {
      console.log("Migration complete.");
      return closePool();
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exitCode = 1;
      return closePool();
    });
}
