function placeNameFromUrl(value) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/maps\/place\/([^/]+)/i);
    return match ? decodeURIComponent(match[1].replace(/\+/g, " ")).trim().slice(0, 200) : "";
  } catch {
    return "";
  }
}

export async function resolveGoogleMapsLocation(mapsUrl) {
  if (!mapsUrl) return "";
  const directName = placeNameFromUrl(mapsUrl);
  if (directName) return directName;
  try {
    const response = await fetch(mapsUrl, { redirect: "follow" });
    return placeNameFromUrl(response.url);
  } catch (error) {
    console.error("Google Maps link resolution failed", error);
    return "";
  }
}
