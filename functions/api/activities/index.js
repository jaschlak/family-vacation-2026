import { clean, json, mapActivity, readJson } from "../../_lib/http.js";

const AUDIENCES = new Set(["Everyone", "Adults", "Seniors", "Teens", "Kids", "Little kids"]);
const DATE_TIME_PATTERN = /^2026-07-(1[89]|2[0-5])T([01]\d|2[0-3]):[0-5]\d$/;
const TRIP_START = "2026-07-18T00:00";
const TRIP_END = "2026-07-25T23:59";

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return json({ error: "Please send valid activity details." }, 400);
  if (clean(body.website, 100)) return json({ error: "Unable to add this idea." }, 400);

  const title = clean(body.title, 100);
  const isEveryday = body.isEveryday === true;
  const startsAt = isEveryday ? TRIP_START : clean(body.startsAt, 16);
  const endsAt = isEveryday ? TRIP_END : clean(body.endsAt, 16);
  const infoUrl = clean(body.infoUrl, 500);
  const notes = clean(body.notes, 2000);
  const submittedBy = clean(body.submittedBy, 80);
  const audience = [...new Set(Array.isArray(body.audience) ? body.audience.filter((item) => AUDIENCES.has(item)) : [])];

  if (title.length < 2 || submittedBy.length < 2 || !audience.length) return json({ error: "Add a name, audience, and your name." }, 400);
  if (!DATE_TIME_PATTERN.test(startsAt) || !DATE_TIME_PATTERN.test(endsAt) || endsAt <= startsAt) {
    return json({ error: "Choose a valid time range during the trip." }, 400);
  }
  if (infoUrl) {
    try {
      const url = new URL(infoUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      return json({ error: "The information link needs to be a full web address." }, 400);
    }
  }

  try {
    const row = await env.DB.prepare(`
      INSERT INTO activities (title, audience, is_everyday, starts_at, ends_at, info_url, notes, submitted_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(title, JSON.stringify(audience), isEveryday ? 1 : 0, startsAt, endsAt, infoUrl || null, notes || null, submittedBy).first();
    return json({ activity: mapActivity(row) }, 201);
  } catch (error) {
    console.error("activity create failed", error);
    return json({ error: "We couldn’t save that idea. Please try again." }, 500);
  }
}
