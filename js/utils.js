// Utilitas kecil yang dipakai lintas modul.

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Normalkan nama provinsi untuk pencocokan antar sumber data.
export function normalizeName(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/^(DI|DKI|D\.I\.|D\.K\.I\.)\s+/, "")
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

export function debounce(fn, wait = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

// Hash deterministik agar data mock stabil antar reload.
export function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededUnit(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function formatDateTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
