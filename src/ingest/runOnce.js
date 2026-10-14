import { migrate } from "../db/migrate.js";
import { ingestRecent } from "./ingestJob.js";
import { closePool } from "../db/pool.js";

// One-shot ingest (npm run ingest:once)
await migrate();
const result = await ingestRecent();
console.log(JSON.stringify(result, null, 2));
await closePool();
