import { json, mapActivity, mapDay } from "../_lib/http.js";

export async function onRequestGet({ env }) {
  try {
    const [days, activities] = await Promise.all([
      env.DB.prepare("SELECT * FROM trip_days ORDER BY trip_date").all(),
      env.DB.prepare(`
        SELECT activities.*, COUNT(activity_votes.voter_id) AS vote_count
        FROM activities
        LEFT JOIN activity_votes ON activity_votes.activity_id = activities.id
        GROUP BY activities.id
        ORDER BY is_everyday DESC, starts_at, created_at
      `).all()
    ]);
    return json({ days: days.results.map(mapDay), activities: activities.results.map(mapActivity) });
  } catch (error) {
    console.error("trip load failed", error);
    return json({ error: "The trip board is temporarily unavailable." }, 500);
  }
}
