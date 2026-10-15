// Store sederhana dengan pola pub/sub agar peta, panel, dan UI lain
// bisa sinkron tanpa saling mengimpor secara langsung.

const listeners = new Map();

export const state = {
  provincesGeoJSON: null,
  selectedProvince: null,
  riskByProvince: new Map(), // normalizedName -> { provinsi, index, level }
  hotspots: [],
  layers: {
    risk: true,
    hotspots: true
  },
  backendOnline: false
};

export function subscribe(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => listeners.get(event)?.delete(handler);
}

export function emit(event, payload) {
  listeners.get(event)?.forEach((handler) => handler(payload));
}

export function setState(patch, event = "change") {
  Object.assign(state, patch);
  emit(event, patch);
}
