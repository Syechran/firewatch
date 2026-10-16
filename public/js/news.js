// Section berita: menampilkan berita karhutla terbaru dari /api/news
// (dihimpun backend dari RSS media). Tautan membuka artikel asli.
import { API_BASE, ENDPOINTS, REQUEST_TIMEOUT_MS } from "./config.js";
import { escapeHtml, formatDateTime } from "./utils.js";

export function initNews() {
  const root = document.getElementById("news-grid");
  if (!root) return;
  load(root);
}

async function load(root) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${ENDPOINTS.news}?limit=6`, {
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    render(root, data.items || []);
  } catch {
    root.innerHTML =
      '<p class="news-empty">Berita belum tersedia saat ini.</p>';
  } finally {
    clearTimeout(timer);
  }
}

function render(root, items) {
  if (!items.length) {
    root.innerHTML =
      '<p class="news-empty">Belum ada berita terkait kebakaran saat ini.</p>';
    return;
  }

  root.innerHTML = items
    .map((item) => {
      const time = item.publishedAt ? formatDateTime(item.publishedAt) : "";
      const summary = item.summary
        ? `<span class="news-summary">${escapeHtml(item.summary)}</span>`
        : "";
      return `
        <a class="news-card" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">
          <span class="news-source">${escapeHtml(item.source)}</span>
          <span class="news-title">${escapeHtml(item.title)}</span>
          ${summary}
          <span class="news-time">${escapeHtml(time)}</span>
        </a>`;
    })
    .join("");
}
