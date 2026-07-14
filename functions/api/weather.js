const FORECAST_URL = "https://api.weather.gov/gridpoints/ALY/84,77/forecast";
const SOURCE_URL = "https://forecast.weather.gov/MapClick.php?lat=42.9009&lon=-73.35";
const TRIP_DATES = Array.from({ length: 8 }, (_, index) => `2026-07-${String(18 + index).padStart(2, "0")}`);

export async function onRequestGet() {
  try {
    const response = await fetch(FORECAST_URL, {
      headers: {
        Accept: "application/geo+json",
        "User-Agent": "family-vacation-2026 (https://github.com/jaschlak/family-vacation-2026)"
      }
    });
    if (!response.ok) throw new Error(`NWS returned ${response.status}`);
    const data = await response.json();
    const byDate = Object.fromEntries(TRIP_DATES.map((date) => [date, { date, available: false }]));

    for (const period of data?.properties?.periods || []) {
      const date = period.startTime?.slice(0, 10);
      if (!byDate[date]) continue;
      const day = byDate[date];
      day.available = true;
      if (period.isDaytime) {
        day.high = period.temperature;
        day.summary = period.shortForecast;
        day.icon = period.icon;
      } else {
        day.low = period.temperature;
        day.nightSummary = period.shortForecast;
      }
    }

    return Response.json({
      location: "Hoosick Falls, New York",
      sourceUrl: SOURCE_URL,
      updatedAt: data?.properties?.updateTime || null,
      days: TRIP_DATES.map((date) => byDate[date])
    }, {
      headers: {
        "Cache-Control": "public, max-age=900, s-maxage=1800",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("weather load failed", error);
    return Response.json({ error: "The Hoosick Falls forecast is temporarily unavailable." }, {
      status: 502,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
    });
  }
}
