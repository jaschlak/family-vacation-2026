import { json, mapActivity, mapDay } from "../_lib/http.js";

export async function onRequestGet({ env }) {
  try {
    const [days, activities] = await Promise.all([
      env.DB.prepare("SELECT * FROM trip_days ORDER BY trip_date").all(),
      env.DB.prepare(`
        SELECT activities.*,
          (SELECT COUNT(*) FROM activity_votes WHERE activity_votes.activity_id = activities.id) AS vote_count,
          (SELECT COUNT(*) FROM messages WHERE messages.activity_id = activities.id) AS discussion_count
        FROM activities
        ORDER BY is_everyday DESC, starts_at, created_at
      `).all()
    ]);
    return json({ days: days.results.map(mapDay), activities: activities.results.map(mapActivity) });
  } catch (error) {
    console.error("trip load failed", error);
    return json({ error: "The trip board is temporarily unavailable." }, 500);
  }
}
