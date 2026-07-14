const TRIP_START = "2026-07-18";
const TRIP_END = "2026-07-25";
const WEATHER_URL = "https://forecast.weather.gov/MapClick.php?lat=42.9009&lon=-73.35";

const state = { days: [], activities: [], audienceFilter: "all", availabilityFilter: "all", view: "board", timelineDate: "2026-07-22" };
const dayGrid = document.querySelector("#day-grid");
const ideaList = document.querySelector("#idea-list");
const emptyState = document.querySelector("#empty-state");
const boardView = document.querySelector("#board-view");
const timelineView = document.querySelector("#timeline-view");
const timelineDays = document.querySelector("#timeline-days");
const timeline = document.querySelector("#timeline");
const timelineChoices = document.querySelector("#timeline-choices");
const timelineEveryday = document.querySelector("#timeline-everyday");
const claimDialog = document.querySelector("#claim-dialog");
const claimForm = document.querySelector("#claim-form");
const ideaForm = document.querySelector("#idea-form");

function syncEverydayFields(everyday) {
  document.querySelectorAll(".time-field").forEach((field) => { field.hidden = everyday; });
  [document.querySelector("#starts-at"), document.querySelector("#ends-at")].forEach((input) => {
    input.disabled = everyday;
    input.required = !everyday;
  });
}

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[char]);

function tripDate(value) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateParts(value) {
  const date = tripDate(value);
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date),
    shortWeekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
    month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date),
    day: date.getDate()
  };
}

function timeLabel(value) {
  const [hourText, minute] = value.slice(11, 16).split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}${minute === "00" ? "" : `:${minute}`} ${suffix}`;
}

function rangeLabel(start, end) {
  const sameDay = start.slice(0, 10) === end.slice(0, 10);
  if (sameDay) return `${timeLabel(start)}–${timeLabel(end)}`;
  const endDate = dateParts(end);
  return `${timeLabel(start)}–${endDate.shortWeekday} ${endDate.day}, ${timeLabel(end)}`;
}

function renderDays() {
  dayGrid.innerHTML = state.days.map((day) => {
    const date = dateParts(day.date);
    const claimed = Boolean(day.familyName);
    return `
      <article class="day-card ${claimed ? "claimed" : "open"}">
        <div class="day-top">
          <div><p class="day-name">${date.weekday}</p><div class="day-number">${date.day}</div></div>
          <span class="day-status">${claimed ? "Claimed" : "Open"}</span>
        </div>
        ${claimed ? `
          <div class="day-owner"><span>Led by</span><strong>${escapeHtml(day.familyName)}</strong></div>
        ` : `
          <button class="claim-button" type="button" data-claim-date="${day.date}">Claim this day →</button>
        `}
        <a class="weather-link" href="${WEATHER_URL}" target="_blank" rel="noopener noreferrer"
          aria-label="Weather forecast for ${date.weekday}, July ${date.day} in Hoosick Falls">Weather forecast ↗</a>
      </article>`;
  }).join("");
}

function renderIdeas() {
  const visible = state.activities.filter((idea) => {
    const matchesAudience = state.audienceFilter === "all" || idea.audience.includes(state.audienceFilter);
    const matchesAvailability = state.availabilityFilter === "all"
      || (state.availabilityFilter === "everyday" && idea.isEveryday)
      || (state.availabilityFilter === "scheduled" && !idea.isEveryday);
    return matchesAudience && matchesAvailability;
  });
  ideaList.innerHTML = visible.map((idea) => {
    const date = idea.isEveryday ? null : dateParts(idea.startsAt);
    const safeUrl = idea.infoUrl && /^https?:\/\//i.test(idea.infoUrl) ? escapeHtml(idea.infoUrl) : "";
    const availability = idea.isEveryday ? `
      <span>Available</span>
      <strong class="everyday-mark">Every day</strong>
      <small>Any time</small>
    ` : `
      <span>${date.month} · ${date.shortWeekday}</span>
      <strong>${date.day}</strong>
      <small>${rangeLabel(idea.startsAt, idea.endsAt)}</small>
    `;
    return `
      <article class="idea-card">
        <div class="idea-date">
          ${availability}
        </div>
        <div class="idea-main">
          <h3>${escapeHtml(idea.title)}</h3>
          ${idea.notes ? `<p>${escapeHtml(idea.notes)}</p>` : ""}
          <div class="idea-meta">
            ${idea.audience.map((group) => `<span class="tag">${escapeHtml(group)}</span>`).join("")}
            <span class="tag submitted">Added by ${escapeHtml(idea.submittedBy)}</span>
          </div>
        </div>
        ${safeUrl ? `<a class="idea-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">More info ↗</a>` : ""}
      </article>`;
  }).join("");
  emptyState.hidden = visible.length > 0;
}

function ideasForDay(date) {
  const next = tripDate(date);
  next.setDate(next.getDate() + 1);
  const nextDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  return state.activities.filter((idea) => !idea.isEveryday && idea.startsAt < `${nextDate}T00:00` && idea.endsAt > `${date}T00:00`);
}

function minutesOnDay(value, date, isEnd = false) {
  const valueDate = value.slice(0, 10);
  if (valueDate < date) return 0;
  if (valueDate > date) return 24 * 60;
  const [hour, minute] = value.slice(11, 16).split(":").map(Number);
  const total = hour * 60 + minute;
  return isEnd && total === 0 ? 24 * 60 : total;
}

function hourLabel(hour) {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  return `${hour > 12 ? hour - 12 : hour} ${hour > 12 ? "PM" : "AM"}`;
}

function assignOverlapLanes(items) {
  const sorted = [...items].sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
  const clusters = [];
  let cluster = [];
  let clusterEnd = -1;

  for (const item of sorted) {
    if (cluster.length && item.startMinute >= clusterEnd) {
      clusters.push(cluster);
      cluster = [];
      clusterEnd = -1;
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMinute);
  }
  if (cluster.length) clusters.push(cluster);

  for (const group of clusters) {
    const laneEnds = [];
    for (const item of group) {
      let lane = laneEnds.findIndex((end) => end <= item.startMinute);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = item.endMinute;
      item.lane = lane;
    }
    group.forEach((item) => { item.lanes = laneEnds.length; });
  }
  return sorted;
}

function renderTimelineDays() {
  timelineDays.innerHTML = state.days.map((day) => {
    const date = dateParts(day.date);
    const count = ideasForDay(day.date).length;
    const active = day.date === state.timelineDate;
    return `
      <button class="timeline-day ${count ? "has-events" : ""} ${active ? "active" : ""}" type="button"
        data-timeline-date="${day.date}" aria-pressed="${active}">
        <span>${date.shortWeekday}</span><strong>${date.day}</strong><small>${count ? `${count} ${count === 1 ? "idea" : "ideas"}` : "Open"}</small>
      </button>`;
  }).join("");
}

function renderTimeline() {
  if (!state.days.length) return;
  renderTimelineDays();
  const selectedDate = dateParts(state.timelineDate);
  const dayIdeas = ideasForDay(state.timelineDate);
  const everydayIdeas = state.activities.filter((idea) => idea.isEveryday);
  document.querySelector("#timeline-title").textContent = `${selectedDate.weekday}, July ${selectedDate.day}`;
  const scheduledLabel = `${dayIdeas.length} scheduled`;
  const everydayLabel = `${everydayIdeas.length} everyday`;
  document.querySelector("#timeline-count").textContent = everydayIdeas.length ? `${scheduledLabel} · ${everydayLabel}` : scheduledLabel;

  timelineEveryday.hidden = everydayIdeas.length === 0;
  timelineEveryday.innerHTML = everydayIdeas.length === 0 ? "" : `
    <div class="timeline-everyday-heading">
      <strong>Available every day</strong>
      <span>These ideas can fit wherever there is room.</span>
    </div>
    <div class="timeline-everyday-list">
      ${everydayIdeas.map((idea) => {
        const safeUrl = idea.infoUrl && /^https?:\/\//i.test(idea.infoUrl) ? escapeHtml(idea.infoUrl) : "";
        return `<span class="timeline-everyday-item">${escapeHtml(idea.title)}${safeUrl ? ` · <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">info</a>` : ""}</span>`;
      }).join("")}
    </div>`;

  const positioned = dayIdeas.map((idea) => ({
    ...idea,
    startMinute: minutesOnDay(idea.startsAt, state.timelineDate),
    endMinute: minutesOnDay(idea.endsAt, state.timelineDate, true)
  }));
  const startHour = positioned.length ? Math.floor(Math.min(...positioned.map((idea) => idea.startMinute)) / 60) : 8;
  const naturalEnd = positioned.length ? Math.ceil(Math.max(...positioned.map((idea) => idea.endMinute)) / 60) : 20;
  const endHour = Math.min(24, Math.max(startHour + 4, naturalEnd));
  const pixelsPerMinute = 1;
  const height = (endHour - startHour) * 60 * pixelsPerMinute;
  const laidOut = assignOverlapLanes(positioned);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);

  const overlapping = laidOut.filter((idea) => idea.lanes > 1);
  timelineChoices.hidden = overlapping.length < 2;
  timelineChoices.innerHTML = overlapping.length < 2 ? "" : `
    <div class="timeline-choices-heading">
      <strong>${overlapping.length} overlapping choices</strong>
      <span>These options share part or all of the same time range.</span>
    </div>
    <div class="timeline-choice-grid">
      ${overlapping.map((idea) => {
        const safeUrl = idea.infoUrl && /^https?:\/\//i.test(idea.infoUrl) ? escapeHtml(idea.infoUrl) : "";
        return `<article class="timeline-choice">
          <h4>${escapeHtml(idea.title)}</h4>
          <p>${rangeLabel(idea.startsAt, idea.endsAt)}</p>
          ${safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">More info ↗</a>` : ""}
        </article>`;
      }).join("")}
    </div>`;

  timeline.style.height = `${height}px`;
  timeline.innerHTML = `
    <div class="timeline-hours" aria-hidden="true">
      ${hours.map((hour) => `<div class="timeline-hour" style="top:${(hour - startHour) * 60 * pixelsPerMinute}px"><span>${hourLabel(hour)}</span></div>`).join("")}
    </div>
    <div class="timeline-events">
      ${laidOut.map((idea, index) => {
        const top = (idea.startMinute - startHour * 60) * pixelsPerMinute + 3;
        const heightPx = Math.max(42, (idea.endMinute - idea.startMinute) * pixelsPerMinute - 6);
        const safeUrl = idea.infoUrl && /^https?:\/\//i.test(idea.infoUrl) ? escapeHtml(idea.infoUrl) : "";
        const laneCount = Math.min(8, Math.max(1, idea.lanes));
        return `<div class="timeline-event-position lanes-${laneCount}" style="top:${top}px;height:${heightPx}px">
          <article class="timeline-event tone-${index % 3 + 1}" style="grid-column:${idea.lane + 1}">
            <h4>${escapeHtml(idea.title)}</h4>
            <p class="timeline-event-time">${rangeLabel(idea.startsAt, idea.endsAt)}</p>
            ${idea.notes ? `<p class="timeline-event-notes">${escapeHtml(idea.notes)}</p>` : ""}
            ${safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">More info ↗</a>` : ""}
          </article>
        </div>`;
      }).join("")}
    </div>
    ${dayIdeas.length ? "" : `<div class="timeline-empty"><span>☀</span><h4>Nothing scheduled yet</h4><p>Add an idea for this day below.</p></div>`}
  `;
}

function toast(message, isError = false) {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.classList.toggle("error", isError);
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 3500);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Something went wrong. Please try again.");
  return payload;
}

async function loadTrip() {
  try {
    const data = await request("/api/trip");
    state.days = data.days;
    state.activities = data.activities;
    renderDays();
    renderIdeas();
    renderTimeline();
  } catch (error) {
    dayGrid.innerHTML = `<div class="loading-card">We couldn’t load the calendar. Please refresh in a moment.</div>`;
    ideaList.innerHTML = "";
    emptyState.hidden = false;
    toast(error.message, true);
  }
}

dayGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-claim-date]");
  if (!button) return;
  const selected = state.days.find((day) => day.date === button.dataset.claimDate);
  const display = dateParts(selected.date);
  claimForm.reset();
  document.querySelector("#claim-date").value = selected.date;
  document.querySelector("#claim-title").textContent = `Claim ${display.weekday}, July ${display.day}`;
  claimDialog.showModal();
});

claimForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = claimForm.querySelector('[type="submit"]');
  const form = new FormData(claimForm);
  submit.disabled = true;
  submit.textContent = "Claiming…";
  try {
    const result = await request(`/api/days/${form.get("date")}`, {
      method: "PUT",
      body: JSON.stringify({ familyName: form.get("familyName"), claimedBy: form.get("claimedBy") })
    });
    const index = state.days.findIndex((day) => day.date === result.day.date);
    state.days[index] = result.day;
    renderDays();
    claimDialog.close();
    toast(`${result.day.familyName} has the lead!`);
  } catch (error) {
    toast(error.message, true);
    if (error.message.toLowerCase().includes("claimed")) await loadTrip();
  } finally {
    submit.disabled = false;
    submit.textContent = "Claim this day";
  }
});

ideaForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = ideaForm.querySelector('[type="submit"]');
  const form = new FormData(ideaForm);
  const audience = form.getAll("audience");
  const isEveryday = form.get("everyday") === "on";
  if (!audience.length) return toast("Choose who should consider this idea.", true);
  if (!isEveryday && (form.get("startsAt") < `${TRIP_START}T00:00` || form.get("endsAt") > `${TRIP_END}T23:59`)) {
    return toast("Choose dates during the July 18–25 trip.", true);
  }
  if (!isEveryday && form.get("endsAt") <= form.get("startsAt")) return toast("The end time needs to be after the start time.", true);

  submit.disabled = true;
  submit.textContent = "Adding…";
  try {
    const result = await request("/api/activities", {
      method: "POST",
      body: JSON.stringify({
        title: form.get("title"), audience, isEveryday, startsAt: form.get("startsAt"), endsAt: form.get("endsAt"),
        infoUrl: form.get("infoUrl"), notes: form.get("notes"), submittedBy: form.get("submittedBy"), website: form.get("website")
      })
    });
    state.activities.push(result.activity);
    state.activities.sort((a, b) => Number(Boolean(b.isEveryday)) - Number(Boolean(a.isEveryday)) || a.startsAt.localeCompare(b.startsAt));
    state.audienceFilter = "all";
    state.availabilityFilter = "all";
    document.querySelectorAll("[data-audience-filter]").forEach((button) => button.classList.toggle("active", button.dataset.audienceFilter === "all"));
    document.querySelectorAll("[data-availability-filter]").forEach((button) => button.classList.toggle("active", button.dataset.availabilityFilter === "all"));
    renderIdeas();
    renderTimeline();
    ideaForm.reset();
    syncEverydayFields(false);
    toast("Your idea is on the board!");
    document.querySelector("#ideas").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    toast(error.message, true);
  } finally {
    submit.disabled = false;
    submit.innerHTML = `Add this idea <span aria-hidden="true">→</span>`;
  }
});

document.querySelector(".filter-bar").addEventListener("click", (event) => {
  const button = event.target.closest("[data-audience-filter]");
  if (!button) return;
  state.audienceFilter = button.dataset.audienceFilter;
  document.querySelectorAll("[data-audience-filter]").forEach((item) => item.classList.toggle("active", item === button));
  renderIdeas();
});

document.querySelector(".availability-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-availability-filter]");
  if (!button) return;
  state.availabilityFilter = button.dataset.availabilityFilter;
  document.querySelectorAll("[data-availability-filter]").forEach((item) => item.classList.toggle("active", item === button));
  renderIdeas();
});

document.querySelector("#is-everyday").addEventListener("change", (event) => {
  syncEverydayFields(event.currentTarget.checked);
});

document.querySelector(".view-switch").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  state.view = button.dataset.view;
  boardView.hidden = state.view !== "board";
  timelineView.hidden = state.view !== "timeline";
  document.querySelectorAll(".view-button").forEach((item) => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  if (state.view === "timeline") renderTimeline();
});

timelineDays.addEventListener("click", (event) => {
  const button = event.target.closest("[data-timeline-date]");
  if (!button) return;
  state.timelineDate = button.dataset.timelineDate;
  renderTimeline();
});

loadTrip();
