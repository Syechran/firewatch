import { Client } from "basic-ftp";
import { Writable } from "node:stream";
import { config } from "../config.js";

/**
 * Connect to JAXA P-Tree FTP and run `fn(client)`.
 * Always closes the connection.
 */
export async function withPtree(fn) {
  const client = new Client();
  client.ftp.verbose = false;
  try {
    await client.access({
      host: config.ptree.host,
      user: config.ptree.user,
      password: config.ptree.password,
      secure: false,
    });
    return await fn(client);
  } finally {
    client.close();
  }
}

/**
 * WLF Level-2 directory for a 10-minute slot (UTC).
 * Path: {root}/himawari/L2/WLF/{VER}/{YYYYMM}/{DD}/{HH}
 */
export function wlfSlotPath(slotDate, version = config.wlf.version) {
  const y = slotDate.getUTCFullYear();
  const m = String(slotDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(slotDate.getUTCDate()).padStart(2, "0");
  const h = String(slotDate.getUTCHours()).padStart(2, "0");
  return `${config.ptree.root}/himawari/L2/WLF/${version}/${y}${m}/${d}/${h}`;
}

/** List remote CSV file names in a directory. Returns [] if missing. */
export async function listDirSafe(client, path) {
  try {
    const entries = await client.list(path);
    return entries
      .filter((e) => e.isFile)
      .map((e) => e.name)
      .filter((name) => /\.csv$/i.test(name));
  } catch (err) {
    // Directory may not exist yet (no observation / housekeeping window)
    if (
      err &&
      (err.code === 550 || /No such file|not found|550/i.test(String(err.message)))
    ) {
      return [];
    }
    throw err;
  }
}

/** Download a remote file and return its UTF-8 text. */
export async function downloadText(client, remotePath) {
  const chunks = [];
  const sink = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk);
      cb();
    },
  });
  await client.downloadTo(sink, remotePath);
  return Buffer.concat(chunks).toString("utf8");
}
