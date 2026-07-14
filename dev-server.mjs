import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const dataDir = join(root, ".data");
const dataFile = join(dataDir, "local.json");
const port = Number(process.env.PORT || 8788);
const dates = Array.from({ length: 8 }, (_, index) => `2026-07-${String(18 + index).padStart(2, "0")}`);
const nwsForecastUrl = "https://api.weather.gov/gridpoints/ALY/84,77/forecast";
const initialData = {
  days: dates.map((date) => ({ date, familyName: null, claimedBy: null, claimedAt: null })),
  activities: [
    {
      id: 1,
      title: "Drive into City & Park",
      audience: ["Everyone"],
      isEveryday: false,
      startsAt: "2026-07-22T06:00",
      endsAt: "2026-07-22T22:00",
      infoUrl: null,
      notes: "Part of Terri's NY Sightseeing plan.",
      submittedBy: "Terri Schlak",
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      title: "9/11 Memorial",
      audience: ["Everyone"],
      isEveryday: false,
      startsAt: "2026-07-22T06:00",
      endsAt: "2026-07-22T22:00",
      infoUrl: "https://www.911memorial.org/",
      notes: "Walk to the 9/11 Memorial. Memorial admission is free.",
      submittedBy: "Terri Schlak",
      createdAt: new Date().toISOString()
    },
    {
      id: 3,
      title: "Ferry to Ellis Island and/or Liberty Island",
      audience: ["Everyone"],
      isEveryday: false,
      startsAt: "2026-07-22T06:00",
      endsAt: "2026-07-22T22:00",
      infoUrl: "https://www.statuecitycruises.com/",
      notes: "Walk to the ferry terminal. About $26/person. Visit the Ellis Island museum and/or the Liberty Island museum. Choose one, or rush through both.",
      submittedBy: "Terri Schlak",
      createdAt: new Date().toISOString()
    }
  ]
};

async function loadData() {
  if (!existsSync(dataFile)) {
    await mkdir(dataDir, { recursive: true });
    await writeFile(dataFile, JSON.stringify(initialData, null, 2));
  }
  return JSON.parse(await readFile(dataFile, "utf8"));
}

async function saveData(data) {
  await writeFile(dataFile, JSON.stringify(data, null, 2));
}

function tripPayload(data) {
  const votes = Array.isArray(data.votes) ? data.votes : [];
  const messages = Array.isArray(data.messages) ? data.messages : [];
  return {
    days: data.days,
    activities: data.activities.map((activity) => ({
      ...activity,
      voteCount: votes.filter((vote) => vote.activityId === activity.id).length,
      discussionCount: messages.filter((message) => message.activityId === activity.id).length
    }))
  };
}

function sendJson(response, body, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function bodyJson(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  try { return JSON.parse(raw); } catch { return null; }
}

const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (url.pathname === "/api/trip" && request.method === "GET") return sendJson(response, tripPayload(await loadData()));

    if (url.pathname === "/api/messages" && request.method === "GET") {
      const rawActivityId = url.searchParams.get("activityId");
      const activityId = rawActivityId === null || rawActivityId === "" ? null : Number(rawActivityId);
      if (activityId !== null && (!Number.isSafeInteger(activityId) || activityId < 1)) {
        return sendJson(response, { error: "Choose a valid event discussion." }, 400);
      }
      const data = await loadData();
      if (activityId !== null && !data.activities.some((activity) => activity.id === activityId)) {
        return sendJson(response, { error: "That event no longer exists." }, 404);
      }
      const messages = (Array.isArray(data.messages) ? data.messages : [])
        .filter((message) => (message.activityId ?? null) === activityId)
        .slice(-100);
      return sendJson(response, { messages });
    }

    if (url.pathname === "/api/messages" && request.method === "POST") {
      const input = await bodyJson(request);
      const activityId = input?.activityId === null || input?.activityId === undefined || input?.activityId === "" ? null : Number(input.activityId);
      const author = typeof input?.author === "string" ? input.author.trim().slice(0, 80) : "";
      const messageText = typeof input?.message === "string" ? input.message.trim().slice(0, 1000) : "";
      if (input?.website || (activityId !== null && (!Number.isSafeInteger(activityId) || activityId < 1))) {
        return sendJson(response, { error: "Unable to post that message." }, 400);
      }
      if (author.length < 2 || !messageText) return sendJson(response, { error: "Add your name and a message." }, 400);
      const data = await loadData();
      if (activityId !== null && !data.activities.some((activity) => activity.id === activityId)) {
        return sendJson(response, { error: "That event no longer exists." }, 404);
      }
      if (!Array.isArray(data.messages)) data.messages = [];
      const message = {
        id: Math.max(0, ...data.messages.map((item) => Number(item.id) || 0)) + 1,
        activityId, author, message: messageText, createdAt: new Date().toISOString()
      };
      data.messages.push(message);
      await saveData(data);
      return sendJson(response, { message }, 201);
    }

    if (url.pathname === "/api/weather" && request.method === "GET") {
      const forecastResponse = await fetch(nwsForecastUrl, {
        headers: { Accept: "application/geo+json", "User-Agent": "family-vacation-2026 local preview" }
      });
      if (!forecastResponse.ok) return sendJson(response, { error: "The Hoosick Falls forecast is temporarily unavailable." }, 502);
      const forecast = await forecastResponse.json();
      const byDate = Object.fromEntries(dates.map((date) => [date, { date, available: false }]));
      for (const period of forecast?.properties?.periods || []) {
        const date = period.startTime?.slice(0, 10);
        if (!byDate[date]) continue;
        byDate[date].available = true;
        if (period.isDaytime) {
          byDate[date].high = period.temperature;
          byDate[date].summary = period.shortForecast;
        } else {
          byDate[date].low = period.temperature;
          byDate[date].nightSummary = period.shortForecast;
        }
      }
      return sendJson(response, { location: "Hoosick Falls, New York", days: dates.map((date) => byDate[date]) });
    }

    if (url.pathname.startsWith("/api/days/") && request.method === "PUT") {
      const date = decodeURIComponent(url.pathname.split("/").pop());
      const input = await bodyJson(request);
      const data = await loadData();
      const day = data.days.find((item) => item.date === date);
      if (!day || !input?.familyName?.trim() || !input?.claimedBy?.trim()) return sendJson(response, { error: "Add valid claim details." }, 400);
      if (day.familyName) return sendJson(response, { error: "Someone already claimed this day. Pick another open day." }, 409);
      day.familyName = input.familyName.trim().slice(0, 80);
      day.claimedBy = input.claimedBy.trim().slice(0, 80);
      day.claimedAt = new Date().toISOString();
      await saveData(data);
      return sendJson(response, { day });
    }

    const voteRoute = url.pathname.match(/^\/api\/activities\/(\d+)\/vote$/);
    if (voteRoute && ["PUT", "DELETE"].includes(request.method)) {
      const input = await bodyJson(request);
      const voterId = typeof input?.voterId === "string" ? input.voterId.trim() : "";
      const voterPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!voterPattern.test(voterId)) return sendJson(response, { error: "Unable to record that vote." }, 400);

      const data = await loadData();
      const id = Number(voteRoute[1]);
      if (!data.activities.some((activity) => activity.id === id)) return sendJson(response, { error: "That idea no longer exists." }, 404);
      if (!Array.isArray(data.votes)) data.votes = [];
      const existing = data.votes.findIndex((vote) => vote.activityId === id && vote.voterId === voterId);
      if (request.method === "PUT" && existing === -1) data.votes.push({ activityId: id, voterId });
      if (request.method === "DELETE" && existing !== -1) data.votes.splice(existing, 1);
      await saveData(data);
      const voteCount = data.votes.filter((vote) => vote.activityId === id).length;
      return sendJson(response, { activityId: id, voteCount, voted: request.method === "PUT" });
    }

    if (url.pathname === "/api/activities" && request.method === "POST") {
      const input = await bodyJson(request);
      const allowed = ["Everyone", "Adults", "Seniors", "Teens", "Kids", "Little kids"];
      const audience = Array.isArray(input?.audience) ? [...new Set(input.audience.filter((item) => allowed.includes(item)))] : [];
      const isEveryday = input?.isEveryday === true;
      if (!input?.title?.trim() || !input?.submittedBy?.trim() || !audience.length || (!isEveryday && input.endsAt <= input.startsAt)) {
        return sendJson(response, { error: "Add a name, audience, valid time range, and your name." }, 400);
      }
      const data = await loadData();
      const activity = {
        id: Math.max(0, ...data.activities.map((item) => item.id)) + 1,
        title: input.title.trim().slice(0, 100), audience, isEveryday, voteCount: 0,
        startsAt: isEveryday ? "2026-07-18T00:00" : input.startsAt,
        endsAt: isEveryday ? "2026-07-25T23:59" : input.endsAt,
        infoUrl: input.infoUrl?.trim().slice(0, 500) || null,
        notes: input.notes?.trim().slice(0, 2000) || null,
        submittedBy: input.submittedBy.trim().slice(0, 80), createdAt: new Date().toISOString()
      };
      data.activities.push(activity);
      await saveData(data);
      return sendJson(response, { activity }, 201);
    }

    const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
    if (safePath.startsWith("functions") || safePath.startsWith("migrations") || safePath.startsWith(".data")) {
      response.writeHead(404); return response.end("Not found");
    }
    const content = await readFile(join(root, safePath));
    response.writeHead(200, { "Content-Type": types[extname(safePath)] || "application/octet-stream" });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") { response.writeHead(404); response.end("Not found"); }
    else { console.error(error); sendJson(response, { error: "Local server error" }, 500); }
  }
}).listen(port, () => console.log(`Family vacation site running at http://localhost:${port}`));
