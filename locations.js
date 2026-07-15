const HOME_BASE = "Hoosick Falls, New York";
const TRIP_DATES = Array.from({ length: 8 }, (_, index) => `2026-07-${String(18 + index).padStart(2, "0")}`);
const state = { activities: [], day: "all", mostVoted: false, apiKey: "" };
const locationsGrid = document.querySelector("#locations-grid");
const routeActions = document.querySelector("#route-actions");
const routeNote = document.querySelector("#route-note");
const mapFrame = document.querySelector("#google-map");
const mapMessage = document.querySelector("#google-map-message");

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[character]);

function tripDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateLabel(value) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric" }).format(tripDate(value));
}

function nextDate(value) {
  const date = tripDate(value);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function activityOnDay(activity, day) {
  if (activity.isEveryday) return true;
  return activity.startsAt < `${nextDate(day)}T00:00` && activity.endsAt > `${day}T00:00`;
}

function mappedActivities() {
  let activities = state.activities.filter((activity) => activity.locationName || activity.mapsUrl);
  if (state.day !== "all") activities = activities.filter((activity) => activityOnDay(activity, state.day));
  if (state.mostVoted && activities.length) {
    const highestVote = Math.max(...activities.map((activity) => Number(activity.voteCount || 0)));
    activities = activities.filter((activity) => Number(activity.voteCount || 0) === highestVote);
  }
  return activities;
}

function searchUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function activityMapUrl(activity) {
  return /^https:\/\//i.test(activity.mapsUrl || "")
    ? activity.mapsUrl
    : searchUrl(activity.locationName || activity.title);
}

function mapQuery(activity) {
  return activity.locationName || `${activity.title}, near Hoosick Falls, New York`;
}

function routeUrl(activities) {
  const stops = activities.map(mapQuery);
  if (!stops.length) return "";
  const parameters = new URLSearchParams({ api: "1", origin: HOME_BASE, destination: stops.at(-1), travelmode: "driving" });
  if (stops.length > 1) parameters.set("waypoints", stops.slice(0, -1).join("|"));
  return `https://www.google.com/maps/dir/?${parameters}`;
}

function embedUrl(activities) {
  if (!state.apiKey || !activities.length) return "";
  if (activities.length === 1) {
    const parameters = new URLSearchParams({ key: state.apiKey, q: mapQuery(activities[0]) });
    return `https://www.google.com/maps/embed/v1/place?${parameters}`;
  }
  const visible = activities.slice(0, 21);
  const stops = visible.map(mapQuery);
  const parameters = new URLSearchParams({
    key: state.apiKey,
    origin: HOME_BASE,
    destination: stops.at(-1),
    mode: "driving",
    units: "imperial"
  });
  if (stops.length > 1) parameters.set("waypoints", stops.slice(0, -1).join("|"));
  return `https://www.google.com/maps/embed/v1/directions?${parameters}`;
}

function availability(activity) {
  if (activity.isEveryday) return "Available every day";
  const [year, month, day] = activity.startsAt.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(year, month - 1, day));
}

function renderFilters() {
  const filters = document.querySelector("#location-day-filters");
  filters.innerHTML = `
    <button class="location-filter ${state.day === "all" ? "active" : ""}" data-location-day="all" type="button" aria-pressed="${state.day === "all"}">All days</button>
    ${TRIP_DATES.map((day) => `<button class="location-filter ${state.day === day ? "active" : ""}" data-location-day="${day}" type="button" aria-pressed="${state.day === day}">${dateLabel(day)}</button>`).join("")}`;
  const votes = document.querySelector("#most-voted-filter");
  votes.classList.toggle("active", state.mostVoted);
  votes.setAttribute("aria-pressed", String(state.mostVoted));
}

function renderMap(activities) {
  document.querySelector("#map-count").textContent = `${activities.length} ${activities.length === 1 ? "location" : "locations"} shown`;
  const url = embedUrl(activities);
  if (url) {
    mapMessage.hidden = true;
    mapFrame.hidden = false;
    if (mapFrame.src !== url) mapFrame.src = url;
    return;
  }
  mapFrame.hidden = true;
  mapFrame.removeAttribute("src");
  mapMessage.hidden = false;
  if (!activities.length) {
    mapMessage.innerHTML = `<strong>No locations match these filters.</strong><span>Choose another day or turn off “Most voted only.”</span>`;
  } else if (!state.apiKey) {
    mapMessage.innerHTML = `<strong>Google Maps needs its API key.</strong><span>The location list and “Open in Google Maps” buttons still work while the key is being configured.</span>`;
  }
}

function renderList(mapped) {
  document.querySelector("#locations-count").textContent = `${mapped.length} ${mapped.length === 1 ? "activity has" : "activities have"} a saved location.`;

  if (!mapped.length) {
    locationsGrid.innerHTML = `<div class="locations-empty"><span aria-hidden="true">⌖</span><h2>No matching locations</h2><p>Choose another filter or add a location to an activity on the planner.</p><a class="button button-primary" href="/#add-idea">Add an idea</a></div>`;
    routeActions.innerHTML = "";
    routeNote.hidden = true;
    return;
  }

  const routeGroups = Array.from({ length: Math.ceil(mapped.length / 10) }, (_, index) => mapped.slice(index * 10, index * 10 + 10));
  routeActions.innerHTML = routeGroups.map((group, index) => `
    <a class="button button-primary" href="${escapeHtml(routeUrl(group))}" target="_blank" rel="noopener noreferrer">
      ${routeGroups.length === 1 ? "Open shown in Google Maps" : `Open route ${index + 1}`} <span aria-hidden="true">↗</span>
    </a>`).join("");
  routeNote.hidden = false;
  routeNote.textContent = routeGroups.length > 1
    ? `Google Maps limits route size, so these ${mapped.length} locations are split into ${routeGroups.length} routes from Hoosick Falls.`
    : "The route starts at Hoosick Falls. Google Maps may show fewer intermediate stops on some mobile devices.";

  locationsGrid.innerHTML = mapped.map((activity) => `
    <article class="location-card">
      <div class="location-pin" aria-hidden="true">⌖</div>
      <div>
        <p class="location-availability">${escapeHtml(availability(activity))}</p>
        <h2>${escapeHtml(activity.title)}</h2>
        <p class="location-address">${escapeHtml(activity.locationName || "Google Maps location shared by the contributor")}</p>
        <p class="location-contributor">Added by ${escapeHtml(activity.submittedBy)} · ${Number(activity.voteCount || 0)} ${Number(activity.voteCount || 0) === 1 ? "vote" : "votes"}</p>
        <div class="location-links">
          <a href="${escapeHtml(activityMapUrl(activity))}" target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a>
          ${activity.infoUrl && /^https?:\/\//i.test(activity.infoUrl) ? `<a href="${escapeHtml(activity.infoUrl)}" target="_blank" rel="noopener noreferrer">More information ↗</a>` : ""}
        </div>
      </div>
    </article>`).join("");
}

function render() {
  const mapped = mappedActivities();
  renderFilters();
  renderMap(mapped);
  renderList(mapped);
}

document.querySelector("#location-day-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-location-day]");
  if (!button) return;
  state.day = button.dataset.locationDay;
  render();
});

document.querySelector("#most-voted-filter").addEventListener("click", () => {
  state.mostVoted = !state.mostVoted;
  render();
});

Promise.all([
  fetch("/api/trip", { headers: { Accept: "application/json" } }),
  fetch("/api/map-config", { headers: { Accept: "application/json" } })
]).then(async ([tripResponse, configResponse]) => {
  const trip = await tripResponse.json().catch(() => ({}));
  const config = await configResponse.json().catch(() => ({}));
  if (!tripResponse.ok) throw new Error(trip.error || "The locations are temporarily unavailable.");
  state.activities = trip.activities;
  state.apiKey = configResponse.ok && config.configured ? config.apiKey : "";
  render();
}).catch((error) => {
  locationsGrid.innerHTML = `<div class="locations-empty"><h2>We couldn’t load the locations</h2><p>${escapeHtml(error.message)}</p></div>`;
  document.querySelector("#locations-count").textContent = "Please refresh in a moment.";
  mapMessage.textContent = "The map is temporarily unavailable.";
});
