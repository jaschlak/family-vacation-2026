import { clean, json, readJson } from "../../../_lib/http.js";

function activityId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
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

export async function onRequestPut({ request, env, params }) {
  const id = activityId(params.id);
  const body = await readJson(request);
  if (!id || !body) return json({ error: "Please send valid location details." }, 400);
  if (clean(body.website, 100)) return json({ error: "Unable to update that location." }, 400);

  const locationName = clean(body.locationName, 200);
  const mapsUrl = clean(body.mapsUrl, 500);
  if (!validGoogleMapsUrl(mapsUrl)) return json({ error: "The map link needs to be a Google Maps web address." }, 400);

  try {
    const row = await env.DB.prepare(`
      UPDATE activities
      SET location_name = ?, maps_url = ?
      WHERE id = ?
      RETURNING id, location_name, maps_url
    `).bind(locationName || null, mapsUrl || null, id).first();
    if (!row) return json({ error: "That event no longer exists." }, 404);
    return json({ activity: { id: row.id, locationName: row.location_name, mapsUrl: row.maps_url } });
  } catch (error) {
    console.error("activity location update failed", error);
    return json({ error: "We couldn’t update that location. Please try again." }, 500);
  }
}
