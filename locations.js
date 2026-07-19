const HOME_BASE = "202 Rogers Avenue, Hoosick Falls, NY 12090";
const HOME_BASE_CENTER = { lat: 42.9001, lng: -73.3515 };
const TRIP_DATES = Array.from({ length: 8 }, (_, index) => `2026-07-${String(18 + index).padStart(2, "0")}`);
const state = {
  activities: [],
  day: "all",
  mostVoted: false,
  apiKey: "",
  map: null,
  geocoder: null,
  infoWindow: null,
  markers: new Map(),
  geocodeCache: new Map(),
  mapRenderId: 0
};

const locationsGrid = document.querySelector("#locations-grid");
const routeActions = document.querySelector("#route-actions");
const routeNote = document.querySelector("#route-note");
const mapCanvas = document.querySelector("#google-map");
const mapMessage = document.querySelector("#google-map-message");
const mapWrap = document.querySelector("#google-map-wrap");

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

function mapQuery(activity) {
  return activity.locationName || `${activity.title}, near Hoosick Falls, New York`;
}

function searchUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function activityMapUrl(activity) {
  return /^https:\/\//i.test(activity.mapsUrl || "")
    ? activity.mapsUrl
    : searchUrl(mapQuery(activity));
}

function directionsUrl(activity) {
  const parameters = new URLSearchParams({
    api: "1",
    origin: HOME_BASE,
    destination: mapQuery(activity),
    travelmode: "driving"
  });
  return `https://www.google.com/maps/dir/?${parameters}`;
}

function routeUrl(activities) {
  const stops = activities.map(mapQuery);
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

function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve();
  if (window.googleMapsReady) return window.googleMapsReady;

  window.googleMapsReady = new Promise((resolve, reject) => {
    const callbackName = "familyVacationGoogleMapsReady";
    window[callbackName] = () => {
      delete window[callbackName];
      resolve();
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}&v=weekly`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps could not load."));
    document.head.append(script);
  });
  return window.googleMapsReady;
}

async function ensureMap() {
  if (state.map) return;
  await loadGoogleMaps(state.apiKey);
  state.map = new google.maps.Map(mapCanvas, {
    center: HOME_BASE_CENTER,
    zoom: 8,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  });
  state.geocoder = new google.maps.Geocoder();
  state.infoWindow = new google.maps.InfoWindow();
}

async function geocodeActivity(activity) {
  const query = mapQuery(activity);
  if (state.geocodeCache.has(query)) return state.geocodeCache.get(query);
  try {
    const response = await state.geocoder.geocode({ address: query });
    const position = response.results[0]?.geometry?.location || null;
    state.geocodeCache.set(query, position);
    return position;
  } catch (error) {
    console.warn(`Could not place ${query} on the map.`, error);
    state.geocodeCache.set(query, null);
    return null;
  }
}

function clearMarkers() {
  state.infoWindow?.close();
  state.markers.forEach(({ marker }) => marker.setMap(null));
  state.markers.clear();
  document.querySelectorAll(".location-card.selected").forEach((card) => card.classList.remove("selected"));
}

function markerContent(activity) {
  return `<div class="map-info-window">
    <strong>${escapeHtml(activity.title)}</strong>
    <span>${escapeHtml(activity.locationName || mapQuery(activity))}</span>
    <div>
      <a href="${escapeHtml(activityMapUrl(activity))}" target="_blank" rel="noopener noreferrer">View in Google Maps</a>
      <a href="${escapeHtml(directionsUrl(activity))}" target="_blank" rel="noopener noreferrer">Directions from home base</a>
    </div>
  </div>`;
}

function openMarker(activityId, { scroll = false } = {}) {
  const entry = state.markers.get(String(activityId));
  if (!entry) return;
  state.map.panTo(entry.marker.getPosition());
  if ((state.map.getZoom() || 0) < 13) state.map.setZoom(13);
  state.infoWindow.setContent(markerContent(entry.activity));
  state.infoWindow.open({ map: state.map, anchor: entry.marker });
  document.querySelectorAll(".location-card.selected").forEach((card) => card.classList.remove("selected"));
  document.querySelector(`[data-location-id="${CSS.escape(String(activityId))}"]`)?.classList.add("selected");
  if (scroll) mapWrap.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function renderMap(activities) {
  const renderId = ++state.mapRenderId;
  document.querySelector("#map-count").textContent = `${activities.length} ${activities.length === 1 ? "location" : "locations"} shown`;
  clearMarkers();

  if (!activities.length) {
    mapCanvas.hidden = true;
    mapMessage.hidden = false;
    mapMessage.innerHTML = `<strong>No locations match these filters.</strong><span>Choose another day or turn off “Most voted only.”</span>`;
    return;
  }
  if (!state.apiKey) {
    mapCanvas.hidden = true;
    mapMessage.hidden = false;
    mapMessage.innerHTML = `<strong>Google Maps needs its API key.</strong><span>The location links below will still work while the key is being configured.</span>`;
    return;
  }

  mapCanvas.hidden = false;
  mapMessage.hidden = false;
  mapMessage.innerHTML = `<strong>Placing the pins…</strong>`;
  try {
    await ensureMap();
    const placed = await Promise.all(activities.map(async (activity, index) => ({
      activity,
      index,
      position: await geocodeActivity(activity)
    })));
    if (renderId !== state.mapRenderId) return;

    const bounds = new google.maps.LatLngBounds();
    placed.filter(({ position }) => position).forEach(({ activity, index, position }) => {
      const marker = new google.maps.Marker({
        map: state.map,
        position,
        title: activity.title,
        label: String(index + 1)
      });
      marker.addListener("click", () => openMarker(activity.id));
      state.markers.set(String(activity.id), { marker, activity });
      bounds.extend(position);
    });

    mapMessage.hidden = state.markers.size > 0;
    if (!state.markers.size) {
      mapMessage.innerHTML = `<strong>Google couldn’t locate these places.</strong><span>Try adding a complete street address to each activity.</span>`;
    } else if (state.markers.size === 1) {
      state.map.setCenter(bounds.getCenter());
      state.map.setZoom(13);
    } else {
      state.map.fitBounds(bounds, 45);
    }
    document.querySelector("#map-count").textContent = `${state.markers.size} of ${activities.length} ${activities.length === 1 ? "location" : "locations"} pinned`;
  } catch (error) {
    console.error("Google Maps setup failed", error);
    mapCanvas.hidden = true;
    mapMessage.hidden = false;
    mapMessage.innerHTML = `<strong>The interactive map couldn’t load.</strong><span>Enable the Maps JavaScript API and Geocoding API for this key, then refresh the page.</span>`;
  }
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
  routeNote.textContent = "Select any location below to find its pin. Marker numbers match the cards.";

  locationsGrid.innerHTML = mapped.map((activity, index) => `
    <article class="location-card" data-location-id="${escapeHtml(activity.id)}" tabindex="0" role="button" aria-label="Show ${escapeHtml(activity.title)} on the map">
      <div class="location-pin" aria-hidden="true">${index + 1}</div>
      <div>
        <p class="location-availability">${escapeHtml(availability(activity))}</p>
        <h2>${escapeHtml(activity.title)}</h2>
        <p class="location-address">${escapeHtml(activity.locationName || "Google Maps location shared by the contributor")}</p>
        <p class="location-contributor">Added by ${escapeHtml(activity.submittedBy)} · ${Number(activity.voteCount || 0)} ${Number(activity.voteCount || 0) === 1 ? "vote" : "votes"}</p>
        <div class="location-links">
          <a href="${escapeHtml(activityMapUrl(activity))}" target="_blank" rel="noopener noreferrer">View in Google Maps ↗</a>
          <a href="${escapeHtml(directionsUrl(activity))}" target="_blank" rel="noopener noreferrer">Directions from home base ↗</a>
          ${activity.infoUrl && /^https?:\/\//i.test(activity.infoUrl) ? `<a href="${escapeHtml(activity.infoUrl)}" target="_blank" rel="noopener noreferrer">More information ↗</a>` : ""}
        </div>
      </div>
    </article>`).join("");
}

function render() {
  const mapped = mappedActivities();
  renderFilters();
  renderList(mapped);
  renderMap(mapped);
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

locationsGrid.addEventListener("click", (event) => {
  if (event.target.closest("a")) return;
  const card = event.target.closest("[data-location-id]");
  if (card) openMarker(card.dataset.locationId, { scroll: true });
});

locationsGrid.addEventListener("keydown", (event) => {
  if (!['Enter', ' '].includes(event.key) || event.target.closest("a")) return;
  const card = event.target.closest("[data-location-id]");
  if (!card) return;
  event.preventDefault();
  openMarker(card.dataset.locationId, { scroll: true });
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
