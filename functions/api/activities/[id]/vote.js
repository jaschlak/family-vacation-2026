import { clean, json, readJson } from "../../../_lib/http.js";

const VOTER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function activityId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function voteCount(env, id) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM activity_votes WHERE activity_id = ?").bind(id).first();
  return Number(row?.count || 0);
}

async function voteRequest(request, env, params, remove) {
  const id = activityId(params.id);
  const body = await readJson(request);
  const voterId = clean(body?.voterId, 36);
  if (!id || !VOTER_ID_PATTERN.test(voterId)) return json({ error: "Unable to record that vote." }, 400);

  try {
    const activity = await env.DB.prepare("SELECT id FROM activities WHERE id = ?").bind(id).first();
    if (!activity) return json({ error: "That idea no longer exists." }, 404);

    if (remove) {
      await env.DB.prepare("DELETE FROM activity_votes WHERE activity_id = ? AND voter_id = ?").bind(id, voterId).run();
    } else {
      await env.DB.prepare("INSERT OR IGNORE INTO activity_votes (activity_id, voter_id) VALUES (?, ?)").bind(id, voterId).run();
    }
    return json({ activityId: id, voteCount: await voteCount(env, id), voted: !remove });
  } catch (error) {
    console.error("activity vote failed", error);
    return json({ error: "We couldn’t update that vote. Please try again." }, 500);
  }
}

export function onRequestPut({ request, env, params }) {
  return voteRequest(request, env, params, false);
}

export function onRequestDelete({ request, env, params }) {
  return voteRequest(request, env, params, true);
}
