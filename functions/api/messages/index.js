import { clean, json, readJson } from "../../_lib/http.js";

function parseActivityId(value) {
  if (value === null || value === undefined || value === "") return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function mapMessage(row) {
  return {
    id: row.id,
    activityId: row.activity_id,
    author: row.author,
    message: row.message,
    createdAt: row.created_at
  };
}

async function activityExists(env, activityId) {
  if (activityId === null) return true;
  return Boolean(await env.DB.prepare("SELECT id FROM activities WHERE id = ?").bind(activityId).first());
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const activityId = parseActivityId(url.searchParams.get("activityId"));
  if (activityId === undefined) return json({ error: "Choose a valid event discussion." }, 400);

  try {
    if (!await activityExists(env, activityId)) return json({ error: "That event no longer exists." }, 404);
    const query = activityId === null
      ? env.DB.prepare("SELECT * FROM messages WHERE activity_id IS NULL ORDER BY created_at DESC, id DESC LIMIT 100")
      : env.DB.prepare("SELECT * FROM messages WHERE activity_id = ? ORDER BY created_at DESC, id DESC LIMIT 100").bind(activityId);
    const result = await query.all();
    return json({ messages: result.results.reverse().map(mapMessage) });
  } catch (error) {
    console.error("message load failed", error);
    return json({ error: "We couldn’t load the conversation. Please try again." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return json({ error: "Please send a valid message." }, 400);
  if (clean(body.website, 100)) return json({ error: "Unable to post that message." }, 400);

  const activityId = parseActivityId(body.activityId);
  const author = clean(body.author, 80);
  const message = clean(body.message, 1000);
  if (activityId === undefined) return json({ error: "Choose a valid event discussion." }, 400);
  if (author.length < 2 || message.length < 1) return json({ error: "Add your name and a message." }, 400);

  try {
    if (!await activityExists(env, activityId)) return json({ error: "That event no longer exists." }, 404);
    const row = await env.DB.prepare(`
      INSERT INTO messages (activity_id, author, message)
      VALUES (?, ?, ?)
      RETURNING *
    `).bind(activityId, author, message).first();
    return json({ message: mapMessage(row) }, 201);
  } catch (error) {
    console.error("message create failed", error);
    return json({ error: "We couldn’t post that message. Please try again." }, 500);
  }
}
