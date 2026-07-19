import { clean, json, mapActivity, readJson } from "../../../_lib/http.js";
import { resolveGoogleMapsLocation } from "../../../_lib/maps.js";

const AUDIENCES = new Set(["Everyone", "Adults", "Seniors", "Teens", "Kids", "Little kids"]);
const DATE_TIME_PATTERN = /^2026-07-(1[89]|2[0-5])T([01]\d|2[0-3]):[0-5]\d$/;
const TRIP_START = "2026-07-18T00:00";
const TRIP_END = "2026-07-25T23:59";

function activityId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validWebUrl(value) {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validGoogleMapsUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (
      host === "maps.app.goo.gl"
      || (host === "goo.gl" && url.pathname.startsWith("/maps"))
      || host.startsWith("maps.google.")
      || (host.includes("google.") && url.pathname.startsWith("/maps"))
    );
  } catch {
    return false;
  }
}

export async function onRequestPatch({ request, env, params }) {
  const id = activityId(params.id);
  const body = await readJson(request);
  if (!id || !body) return json({ error: "Please send valid event details." }, 400);
  if (clean(body.website, 100)) return json({ error: "Unable to update that event." }, 400);

  const title = clean(body.title, 100);
  const isEveryday = body.isEveryday === true;
  const startsAt = isEveryday ? TRIP_START : clean(body.startsAt, 16);
  const endsAt = isEveryday ? TRIP_END : clean(body.endsAt, 16);
  const infoUrl = clean(body.infoUrl, 500);
  let locationName = clean(body.locationName, 200);
  const mapsUrl = clean(body.mapsUrl, 500);
  const notes = clean(body.notes, 2000);
  const submittedBy = clean(body.submittedBy, 80);
  const audience = [...new Set(Array.isArray(body.audience) ? body.audience.filter((item) => AUDIENCES.has(item)) : [])];

  if (title.length < 2 || submittedBy.length < 2 || !audience.length) {
    return json({ error: "Add a name, audience, and contributor name." }, 400);
  }
  if (!DATE_TIME_PATTERN.test(startsAt) || !DATE_TIME_PATTERN.test(endsAt) || endsAt <= startsAt) {
    return json({ error: "Choose a valid time range during the trip." }, 400);
  }
  if (!validWebUrl(infoUrl)) return json({ error: "The information link needs to be a full web address." }, 400);
  if (!validGoogleMapsUrl(mapsUrl)) return json({ error: "The map link needs to be a Google Maps web address." }, 400);
  if (!locationName && mapsUrl) locationName = await resolveGoogleMapsLocation(mapsUrl);

  try {
    const updated = await env.DB.prepare(`
      UPDATE activities
      SET title = ?, audience = ?, is_everyday = ?, starts_at = ?, ends_at = ?, info_url = ?,
          location_name = ?, maps_url = ?, notes = ?, submitted_by = ?
      WHERE id = ?
      RETURNING id
    `).bind(
      title, JSON.stringify(audience), isEveryday ? 1 : 0, startsAt, endsAt, infoUrl || null,
      locationName || null, mapsUrl || null, notes || null, submittedBy, id
    ).first();
    if (!updated) return json({ error: "That event no longer exists." }, 404);

    const row = await env.DB.prepare(`
      SELECT activities.*,
        (SELECT COUNT(*) FROM activity_votes WHERE activity_votes.activity_id = activities.id) AS vote_count,
        (SELECT COUNT(*) FROM messages WHERE messages.activity_id = activities.id) AS discussion_count
      FROM activities
      WHERE activities.id = ?
    `).bind(id).first();
    return json({ activity: mapActivity(row) });
  } catch (error) {
    console.error("activity update failed", error);
    return json({ error: "We couldn’t update that event. Please try again." }, 500);
  }
}
