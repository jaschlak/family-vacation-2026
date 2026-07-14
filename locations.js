const HOME_BASE = "Hoosick Falls, New York";
const locationsGrid = document.querySelector("#locations-grid");
const routeActions = document.querySelector("#route-actions");
const routeNote = document.querySelector("#route-note");

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[character]);

function searchUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function activityMapUrl(activity) {
  return /^https:\/\//i.test(activity.mapsUrl || "")
    ? activity.mapsUrl
    : searchUrl(activity.locationName || activity.title);
}

function routeUrl(activities) {
  const stops = activities.map((activity) => activity.locationName || `${activity.title}, near Hoosick Falls, New York`);
  if (!stops.length) return "";
  const parameters = new URLSearchParams({ api: "1", origin: HOME_BASE, destination: stops.at(-1), travelmode: "driving" });
  if (stops.length > 1) parameters.set("waypoints", stops.slice(0, -1).join("|"));
  return `https://www.google.com/maps/dir/?${parameters}`;
}

function availability(activity) {
  if (activity.isEveryday) return "Available every day";
  const [year, month, day] = activity.startsAt.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(year, month - 1, day));
}

function render(activities) {
  const mapped = activities.filter((activity) => activity.locationName || activity.mapsUrl);
  document.querySelector("#locations-count").textContent = `${mapped.length} ${mapped.length === 1 ? "activity has" : "activities have"} a saved location.`;

  if (!mapped.length) {
    locationsGrid.innerHTML = `<div class="locations-empty"><span aria-hidden="true">⌖</span><h2>No locations yet</h2><p>Add a location or Google Maps link to an activity on the planner.</p><a class="button button-primary" href="/#add-idea">Add an idea</a></div>`;
    routeActions.innerHTML = "";
    return;
  }

  const routeGroups = Array.from({ length: Math.ceil(mapped.length / 10) }, (_, index) => mapped.slice(index * 10, index * 10 + 10));
  routeActions.innerHTML = routeGroups.map((group, index) => `
    <a class="button button-primary" href="${escapeHtml(routeUrl(group))}" target="_blank" rel="noopener noreferrer">
      ${routeGroups.length === 1 ? "Open all in Google Maps" : `Open route ${index + 1}`} <span aria-hidden="true">↗</span>
    </a>`).join("");
  routeNote.hidden = false;
  routeNote.textContent = routeGroups.length > 1
    ? `Google Maps limits route size, so the ${mapped.length} locations are split into ${routeGroups.length} routes from Hoosick Falls.`
    : "The route starts at Hoosick Falls. Google Maps may show fewer intermediate stops on some mobile devices.";

  locationsGrid.innerHTML = mapped.map((activity) => `
    <article class="location-card">
      <div class="location-pin" aria-hidden="true">⌖</div>
      <div>
        <p class="location-availability">${escapeHtml(availability(activity))}</p>
        <h2>${escapeHtml(activity.title)}</h2>
        <p class="location-address">${escapeHtml(activity.locationName || "Google Maps location shared by the contributor")}</p>
        <p class="location-contributor">Added by ${escapeHtml(activity.submittedBy)}</p>
        <div class="location-links">
          <a href="${escapeHtml(activityMapUrl(activity))}" target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a>
          ${activity.infoUrl && /^https?:\/\//i.test(activity.infoUrl) ? `<a href="${escapeHtml(activity.infoUrl)}" target="_blank" rel="noopener noreferrer">More information ↗</a>` : ""}
        </div>
      </div>
    </article>`).join("");
}

fetch("/api/trip", { headers: { Accept: "application/json" } })
  .then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The locations are temporarily unavailable.");
    return payload;
  })
  .then((payload) => render(payload.activities))
  .catch((error) => {
    locationsGrid.innerHTML = `<div class="locations-empty"><h2>We couldn’t load the locations</h2><p>${escapeHtml(error.message)}</p></div>`;
    document.querySelector("#locations-count").textContent = "Please refresh in a moment.";
  });
