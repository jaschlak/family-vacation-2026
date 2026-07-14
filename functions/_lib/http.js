export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export function clean(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function mapDay(row) {
  return { date: row.trip_date, familyName: row.family_name, claimedBy: row.claimed_by, claimedAt: row.claimed_at };
}

export function mapActivity(row) {
  return {
    id: row.id,
    title: row.title,
    audience: JSON.parse(row.audience),
    isEveryday: Boolean(row.is_everyday),
    voteCount: Number(row.vote_count || 0),
    discussionCount: Number(row.discussion_count || 0),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    infoUrl: row.info_url,
    locationName: row.location_name,
    mapsUrl: row.maps_url,
    notes: row.notes,
    submittedBy: row.submitted_by,
    createdAt: row.created_at
  };
}
