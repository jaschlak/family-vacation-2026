const TRIP_DATES = Array.from({ length: 8 }, (_, index) => `2026-07-${String(18 + index).padStart(2, "0")}`);
const weatherGrid = document.querySelector("#weather-grid");

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[char]);

function dateParts(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date),
    month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date),
    day
  };
}

function renderWeather(days = []) {
  const forecasts = new Map(days.map((day) => [day.date, day]));
  weatherGrid.innerHTML = TRIP_DATES.map((tripDate) => {
    const date = dateParts(tripDate);
    const forecast = forecasts.get(tripDate);
    const hasForecast = Boolean(forecast?.available && (forecast.summary || forecast.nightSummary));
    const temperatures = [
      Number.isFinite(forecast?.high) ? `<span>High <strong>${forecast.high}°</strong></span>` : "",
      Number.isFinite(forecast?.low) ? `<span>Low <strong>${forecast.low}°</strong></span>` : ""
    ].filter(Boolean).join("");
    return `
      <article class="weather-card ${hasForecast ? "available" : "pending"}" id="weather-${tripDate}">
        <div class="weather-date"><span>${date.weekday}</span><strong>${date.month} ${date.day}</strong></div>
        ${hasForecast ? `
          <div class="weather-temperatures">${temperatures}</div>
          <h2>${escapeHtml(forecast.summary || forecast.nightSummary)}</h2>
          ${forecast.summary && forecast.nightSummary ? `<p>Night: ${escapeHtml(forecast.nightSummary)}</p>` : ""}
        ` : `
          <h2>Not available yet</h2>
          <p>Check again as this date gets closer.</p>
        `}
      </article>`;
  }).join("");
}

async function loadWeather() {
  try {
    const response = await fetch("/api/weather", { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to load the forecast.");
    renderWeather(data.days);
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
  } catch (error) {
    renderWeather();
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
    const message = document.createElement("p");
    message.className = "weather-error";
    message.textContent = error.message;
    weatherGrid.before(message);
  }
}

loadWeather();
