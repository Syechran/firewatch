import { Router } from "express";

// Proxy cuaca ke Open-Meteo (gratis, tanpa API key). Dipakai untuk angin,
// kelembapan, dan kualitas udara (PM2.5) pada fitur status & simulasi.
const router = Router();

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

router.get("/", async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res
      .status(400)
      .json({ error: "Parameter 'lat' dan 'lon' wajib berupa angka." });
  }

  try {
    const forecastUrl =
      `${FORECAST_URL}?latitude=${lat}&longitude=${lon}` +
      "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation" +
      "&wind_speed_unit=kmh&timezone=UTC";
    const airUrl =
      `${AIR_URL}?latitude=${lat}&longitude=${lon}` +
      "&current=pm2_5,pm10&timezone=UTC";

    const [forecastRes, airRes] = await Promise.all([
      fetch(forecastUrl),
      fetch(airUrl),
    ]);

    if (!forecastRes.ok) {
      throw new Error(`Open-Meteo merespons ${forecastRes.status}`);
    }

    const forecast = await forecastRes.json();
    const current = forecast.current ?? {};

    let air = {};
    try {
      if (airRes.ok) air = (await airRes.json()).current ?? {};
    } catch {
      air = {};
    }

    res.json({
      latitude: lat,
      longitude: lon,
      time: current.time ?? null,
      temperatureC: current.temperature_2m ?? null,
      humidity: current.relative_humidity_2m ?? null,
      windSpeedKmh: current.wind_speed_10m ?? null,
      windDirectionDeg: current.wind_direction_10m ?? null,
      precipitationMm: current.precipitation ?? null,
      pm25: air.pm2_5 ?? null,
      pm10: air.pm10 ?? null,
      source: "open-meteo",
    });
  } catch (err) {
    res.status(502).json({ error: `Gagal mengambil data cuaca: ${err.message}` });
  }
});

export const weatherRouter = router;
