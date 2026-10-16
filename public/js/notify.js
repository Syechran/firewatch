// Notifikasi desktop (Chrome) saat status lokasi bukan AMAN.
// Memerlukan secure context (HTTPS) + izin user. Izin diminta otomatis:
// banner saat situs dibuka, lalu requestPermission pada interaksi pertama.
import { FIRE_STATUS_META } from "./config.js";

const STORAGE_KEY = "firewatch:notify:v1";
const DISMISS_KEY = "firewatch:notify:dismissed:v1";
const WARNING_LEVELS = new Set(["asap", "siaga", "evakuasi", "larikan_diri"]);
const URGENT_LEVELS = new Set(["evakuasi", "larikan_diri"]);

const supported =
  typeof window !== "undefined" && typeof window.Notification === "function";

let enabled = false;
let button = null;
let banner = null;
let autoArmed = false;

export function initNotifications() {
  button = document.getElementById("notify-toggle");
  banner = document.getElementById("notify-banner");
  enabled = readPref();

  if (!supported) {
    if (button) {
      button.disabled = true;
      button.textContent = "Notifikasi browser tidak didukung";
    }
    return;
  }

  // Preferensi lama tanpa izin aktif tidak berlaku.
  if (enabled && Notification.permission !== "granted") enabled = false;

  if (button) button.addEventListener("click", onToggle);
  document
    .getElementById("notify-enable")
    ?.addEventListener("click", enableFromPrompt);
  document
    .getElementById("notify-dismiss")
    ?.addEventListener("click", dismissPrompt);
  render();

  // Minta izin otomatis pada kunjungan pertama.
  if (Notification.permission === "default" && !isDismissed()) {
    showBanner();
  }
  armAutoRequest();
}

function readPref() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writePref(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Abaikan bila storage tidak tersedia.
  }
}

function isDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Abaikan.
  }
}

function showBanner() {
  if (banner) banner.hidden = false;
}

function hideBanner() {
  if (banner) banner.hidden = true;
}

function markEnabled() {
  enabled = true;
  writePref(true);
  render();
  hideBanner();
}

async function enableFromPrompt() {
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission === "granted") {
    markEnabled();
  } else {
    hideBanner();
  }
}

function dismissPrompt() {
  writeDismissed();
  hideBanner();
}

// Minta izin otomatis pada interaksi pertama (klik/ketik) — cara paling andal
// karena Chrome mensyaratkan gesture user. Klik pada banner sendiri dikecualikan.
function armAutoRequest() {
  if (autoArmed || Notification.permission !== "default" || isDismissed()) return;
  autoArmed = true;

  const handler = async (event) => {
    if (event.target?.closest?.("#notify-banner")) return;
    window.removeEventListener("click", handler, true);
    window.removeEventListener("keydown", handler, true);

    if (Notification.permission !== "default" || isDismissed()) return;
    const permission = await Notification.requestPermission();
    if (permission === "granted") markEnabled();
    else hideBanner();
  };

  window.addEventListener("click", handler, true);
  window.addEventListener("keydown", handler, true);
}

async function onToggle() {
  if (!supported) return;

  if (!enabled) {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      button.dataset.state = "blocked";
      button.textContent =
        permission === "denied"
          ? "Notifikasi diblokir — aktifkan di pengaturan situs"
          : "Izin notifikasi tidak diberikan";
      return;
    }
    enabled = true;
  } else {
    enabled = false;
  }

  writePref(enabled);
  render();
}

function render() {
  if (!button) return;
  button.dataset.state = enabled ? "on" : "off";
  button.setAttribute("aria-pressed", String(enabled));
  button.textContent = enabled
    ? "Peringatan browser: AKTIF"
    : "Aktifkan peringatan browser";
}

/**
 * Kirim notifikasi desktop bila diaktifkan dan statusnya bukan AMAN.
 * @param {{ place?: object, assessment: object, dataAvailable?: boolean }} args
 */
export function notifyStatus({ place, assessment, dataAvailable = true }) {
  if (!supported || !enabled) return;
  if (Notification.permission !== "granted") return;
  if (!dataAvailable || !WARNING_LEVELS.has(assessment.level)) return;

  const meta = FIRE_STATUS_META[assessment.level];
  if (!meta) return;

  const placeName = place?.display_name
    ? String(place.display_name).split(",").slice(0, 2).join(",")
    : "Lokasi yang dicari";

  try {
    const notification = new Notification(`FIREWATCH — ${meta.label}`, {
      body: `${placeName}\n${meta.description}`,
      tag: "firewatch-status",
      renotify: true,
      requireInteraction: URGENT_LEVELS.has(assessment.level)
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
    console.warn("Gagal menampilkan notifikasi:", error);
  }
}
