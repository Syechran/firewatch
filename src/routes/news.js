import { Router } from "express";
import { pool } from "../db/pool.js";

export const newsRouter = Router();

// GET /api/news?limit=6 — berita karhutla terbaru dari cache DB.
newsRouter.get("/news", async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 30);
    const { rows } = await pool.query(
      `SELECT id, title, link, source, summary, image_url, published_at
       FROM news_items
       ORDER BY published_at DESC NULLS LAST, fetched_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({
      count: rows.length,
      fetchedAt: new Date().toISOString(),
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        link: row.link,
        source: row.source,
        summary: row.summary,
        imageUrl: row.image_url,
        publishedAt: row.published_at
      }))
    });
  } catch (err) {
    next(err);
  }
});
