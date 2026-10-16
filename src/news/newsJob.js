// Menghimpun berita karhutla dari RSS media, disaring kata kunci, lalu
// disimpan ke PostgreSQL. Dijalankan sebagai job terjadwal (bukan per request).
import cron from "node-cron";
import Parser from "rss-parser";
import { query } from "../db/pool.js";
import {
  NEWS_FEEDS,
  NEWS_KEYWORDS,
  NEWS_FETCH_TIMEOUT_MS,
  NEWS_CRON
} from "./feeds.js";

const USER_AGENT = "Firewatch/0.1 (karhutla monitoring; contact: admin)";

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: false }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: false }],
      ["content:encoded", "contentEncoded"]
    ]
  }
});

function matchesKeywords(text) {
  const lower = String(text || "").toLowerCase();
  return NEWS_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function cleanText(value, max = 280) {
  if (!value) return null;
  const text = String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function itemImage(item) {
  const enclosure = item.enclosure?.url;
  if (enclosure && /^https?:/i.test(enclosure)) return enclosure;

  const media = item.mediaContent?.$?.url || item.mediaThumbnail?.$?.url;
  if (media) return media;

  const html = item.contentEncoded || item.content || "";
  const match = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  return match ? match[1] : null;
}

function itemDate(item) {
  const raw = item.isoDate || item.pubDate || null;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function fetchFeed(feed) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NEWS_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(feed.url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    const parsed = await parser.parseString(xml);
    return parsed.items ?? [];
  } finally {
    clearTimeout(timer);
  }
}

export async function refreshNews() {
  let stored = 0;
  const errors = [];

  for (const feed of NEWS_FEEDS) {
    try {
      const items = await fetchFeed(feed);

      for (const item of items) {
        const title = cleanText(item.title, 200);
        const link = item.link;
        if (!title || !link) continue;

        const summary = cleanText(
          item.contentSnippet || item.summary || item.content,
          280
        );

        if (!matchesKeywords(`${title} ${summary ?? ""}`)) continue;

        await query(
          `INSERT INTO news_items (link, title, source, summary, image_url, published_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (link) DO UPDATE SET
             title = EXCLUDED.title,
             summary = EXCLUDED.summary,
             image_url = EXCLUDED.image_url,
             published_at = EXCLUDED.published_at,
             fetched_at = now()`,
          [link, title, feed.source, summary, itemImage(item), itemDate(item)]
        );
        stored += 1;
      }
    } catch (err) {
      errors.push(`${feed.source}: ${err.message}`);
    }
  }

  return { stored, errors };
}

export function startNewsScheduler() {
  const run = () => {
    refreshNews()
      .then((result) =>
        console.log(
          `[news] refreshed stored=${result.stored}` +
            (result.errors.length ? ` errors=${result.errors.join("; ")}` : "")
        )
      )
      .catch((err) => console.error("[news] failed:", err.message));
  };

  run();
  return cron.schedule(NEWS_CRON, run);
}
