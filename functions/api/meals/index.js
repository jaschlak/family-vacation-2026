import { clean, json, readJson } from "../../_lib/http.js";

const TRIP_DATES = Array.from({ length: 8 }, (_, index) => `2026-07-${String(18 + index).padStart(2, "0")}`);
const VALID_DATES = new Set(TRIP_DATES);
const VALID_SLOTS = new Set(["helper", "lunch", "dinner"]);
const EATING_OUT_DATES = new Set(["2026-07-19", "2026-07-22"]);

function mapAssignment(row) {
  return {
    date: row.trip_date,
    slot: row.slot,
    assignedTo: row.assigned_to,
    dishName: row.dish_name,
    shoppingList: row.shopping_list,
    ingredients: row.ingredients,
    instructions: row.instructions,
    updatedAt: row.updated_at
  };
}

function mealDay(date, assignments) {
  const bySlot = new Map(assignments.filter((item) => item.date === date).map((item) => [item.slot, item]));
  return {
    date,
    helper: bySlot.get("helper") || null,
    meals: [
      { meal: "breakfast", status: "fixed", assignedTo: "Mom" },
      EATING_OUT_DATES.has(date)
        ? { meal: "lunch", status: "eatingOut", assignedTo: null }
        : { meal: "lunch", status: bySlot.has("lunch") ? "claimed" : "open", ...(bySlot.get("lunch") || { assignedTo: null }) },
      { meal: "dinner", status: bySlot.has("dinner") ? "claimed" : "open", ...(bySlot.get("dinner") || { assignedTo: null }) }
    ]
  };
}

async function loadSchedule(env) {
  const result = await env.DB.prepare("SELECT * FROM meal_assignments ORDER BY trip_date, slot").all();
  const assignments = result.results.map(mapAssignment);
  return {
    peoplePerMeal: 12,
    days: TRIP_DATES.map((date) => mealDay(date, assignments))
  };
}

function validSlot(date, slot) {
  return VALID_DATES.has(date) && VALID_SLOTS.has(slot) && !(slot === "lunch" && EATING_OUT_DATES.has(date));
}

export async function onRequestGet({ env }) {
  try {
    return json(await loadSchedule(env));
  } catch (error) {
    console.error("meal schedule load failed", error);
    return json({ error: "We couldn’t load the meal schedule. Please try again." }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  const body = await readJson(request);
  if (!body) return json({ error: "Please send valid signup details." }, 400);
  if (clean(body.website, 100)) return json({ error: "Unable to save that signup." }, 400);
  const date = clean(body.date, 10);
  const slot = clean(body.slot, 10).toLowerCase();
  const assignedTo = clean(body.assignedTo, 80);
  const dishName = slot === "helper" ? "" : clean(body.dishName, 120);
  const shoppingList = slot === "helper" ? "" : clean(body.shoppingList, 3000);
  const ingredients = slot === "helper" ? "" : clean(body.ingredients, 3000);
  const instructions = slot === "helper" ? "" : clean(body.instructions, 5000);
  if (!validSlot(date, slot)) return json({ error: "Choose an open helper or chef position." }, 400);
  if (assignedTo.length < 2) return json({ error: "Add the name of the person taking this position." }, 400);

  try {
    await env.DB.prepare(`
      INSERT INTO meal_assignments (trip_date, slot, assigned_to, dish_name, shopping_list, ingredients, instructions, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT (trip_date, slot) DO UPDATE SET
        assigned_to = excluded.assigned_to,
        dish_name = excluded.dish_name,
        shopping_list = excluded.shopping_list,
        ingredients = excluded.ingredients,
        instructions = excluded.instructions,
        updated_at = datetime('now')
    `).bind(date, slot, assignedTo, dishName || null, shoppingList || null, ingredients || null, instructions || null).run();
    return json(await loadSchedule(env));
  } catch (error) {
    console.error("meal signup failed", error);
    return json({ error: "We couldn’t save that signup. Please try again." }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  const body = await readJson(request);
  if (!body) return json({ error: "Please send a valid position." }, 400);
  const date = clean(body.date, 10);
  const slot = clean(body.slot, 10).toLowerCase();
  if (!validSlot(date, slot)) return json({ error: "Choose a valid helper or chef position." }, 400);

  try {
    await env.DB.prepare("DELETE FROM meal_assignments WHERE trip_date = ? AND slot = ?").bind(date, slot).run();
    return json(await loadSchedule(env));
  } catch (error) {
    console.error("meal signup release failed", error);
    return json({ error: "We couldn’t release that position. Please try again." }, 500);
  }
}
