// Sumber berita (RSS) dan kata kunci penyaring topik karhutla.
export const NEWS_FEEDS = [
  { source: "Antara", url: "https://www.antaranews.com/rss/terkini" },
  { source: "CNN Indonesia", url: "https://www.cnnindonesia.com/rss" },
  { source: "Tempo", url: "https://rss.tempo.co/nasional" },
  { source: "Republika", url: "https://www.republika.co.id/rss" },
  { source: "Liputan6", url: "https://feed.liputan6.com/rss/news" },
  { source: "CNBC Indonesia", url: "https://www.cnbcindonesia.com/rss" }
];

export const NEWS_KEYWORDS = [
  "karhutla",
  "kebakaran hutan",
  "kebakaran lahan",
  "kebakaran gambut",
  "lahan gambut",
  "titik panas",
  "hotspot",
  "kabut asap",
  "asap",
  "pembakaran lahan",
  "pembakaran hutan"
];

export const NEWS_FETCH_TIMEOUT_MS = 15000;
export const NEWS_CRON = "*/20 * * * *"; // setiap 20 menit
