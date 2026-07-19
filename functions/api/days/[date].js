import { clean, json, mapDay, readJson } from "../../_lib/http.js";

const DATE_PATTERN = /^2026-07-(1[89]|2[0-5])$/;

async function claimDetails(request) {
  const body = await readJson(request);
  if (!body) return { error: json({ error: "Please send valid claim details." }, 400) };
  const familyName = clean(body.familyName, 80);
  const claimedBy = clean(body.claimedBy, 80);
  if (familyName.length < 2 || claimedBy.length < 2) {
    return { error: json({ error: "Add both your family name and your name." }, 400) };
  }
  return { familyName, claimedBy };
}

export async function onRequestPut({ request, env, params }) {
  if (!DATE_PATTERN.test(params.date)) return json({ error: "That date is outside the trip." }, 400);
  const details = await claimDetails(request);
  if (details.error) return details.error;
  const { familyName, claimedBy } = details;

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

export async function onRequestPatch({ request, env, params }) {
  if (!DATE_PATTERN.test(params.date)) return json({ error: "That date is outside the trip." }, 400);
  const details = await claimDetails(request);
  if (details.error) return details.error;
  const { familyName, claimedBy } = details;

  try {
    const result = await env.DB.prepare(`
      UPDATE trip_days
      SET family_name = ?, claimed_by = ?, claimed_at = datetime('now')
      WHERE trip_date = ? AND family_name IS NOT NULL
      RETURNING *
    `).bind(familyName, claimedBy, params.date).first();
    if (!result) return json({ error: "That day is no longer claimed. Refresh and claim it again." }, 409);
    return json({ day: mapDay(result) });
  } catch (error) {
    console.error("day claim update failed", error);
    return json({ error: "We couldn’t update that claim. Please try again." }, 500);
  }
}
