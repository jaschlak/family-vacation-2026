import { clean, json, mapDay, readJson } from "../../_lib/http.js";

const DATE_PATTERN = /^2026-07-(1[89]|2[0-5])$/;

export async function onRequestPut({ request, env, params }) {
  if (!DATE_PATTERN.test(params.date)) return json({ error: "That date is outside the trip." }, 400);
  const body = await readJson(request);
  if (!body) return json({ error: "Please send valid claim details." }, 400);
  const familyName = clean(body.familyName, 80);
  const claimedBy = clean(body.claimedBy, 80);
  if (familyName.length < 2 || claimedBy.length < 2) return json({ error: "Add both your family name and your name." }, 400);

  try {
    const result = await env.DB.prepare(`
      UPDATE trip_days
      SET family_name = ?, claimed_by = ?, claimed_at = datetime('now')
      WHERE trip_date = ? AND family_name IS NULL
      RETURNING *
    `).bind(familyName, claimedBy, params.date).first();
    if (!result) return json({ error: "Someone already claimed this day. Pick another open day." }, 409);
    return json({ day: mapDay(result) });
  } catch (error) {
    console.error("day claim failed", error);
    return json({ error: "We couldn’t save that claim. Please try again." }, 500);
  }
}
