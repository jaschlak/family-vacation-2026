import { json } from "../_lib/http.js";

export function onRequestGet({ env }) {
  const apiKey = typeof env.GOOGLE_MAPS_EMBED_KEY === "string" ? env.GOOGLE_MAPS_EMBED_KEY.trim() : "";
  return json({ configured: Boolean(apiKey), apiKey: apiKey || null });
}
