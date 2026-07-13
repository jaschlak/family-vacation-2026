import { json, mapActivity, mapDay } from "../_lib/http.js";

export async function onRequestGet({ env }) {
  try {
    const [days, activities] = await Promise.all([
      env.DB.prepare("SELECT * FROM trip_days ORDER BY trip_date").all(),
      env.DB.prepare("SELECT * FROM activities ORDER BY starts_at, created_at").all()
    ]);
    return json({ days: days.results.map(mapDay), activities: activities.results.map(mapActivity) });
  } catch (error) {
    console.error("trip load failed", error);
    return json({ error: "The trip board is temporarily unavailable." }, 500);
  }
}
