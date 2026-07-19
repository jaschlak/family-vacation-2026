const NAME_KEY = "family-vacation-display-name";
const TOTAL_OPEN_POSITIONS = 22;
const state = { schedule: null, activeDate: "", activeSlot: "" };
const mealDays = document.querySelector("#meal-days");
const mealDialog = document.querySelector("#meal-dialog");
const mealForm = document.querySelector("#meal-form");

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[character]);

function storedName() {
  try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
}

function saveName(value) {
  try { localStorage.setItem(NAME_KEY, value); } catch { /* The signup still saves without local storage. */ }
}

function tripDate(value) {
  const [year, month, day] = value.split("-").map(Number);
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

function toast(message, error = false) {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.classList.toggle("error", error);
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 3500);
}

async function request(options = {}) {
  const response = await fetch("/api/meals", {
    ...options,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...options.headers }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The meal schedule is temporarily unavailable.");
  return payload;
}

function helperSlot(day) {
  const claimed = Boolean(day.helper?.assignedTo);
  return `<div class="meal-helper ${claimed ? "claimed" : "open"}">
    <div><span>All-day role</span><strong>Helper</strong><small>${claimed ? `Signed up: ${escapeHtml(day.helper.assignedTo)}` : "Prep · errands · serving · cleanup"}</small></div>
    <button type="button" data-meal-date="${day.date}" data-meal-slot="helper">${claimed ? "Edit" : "Sign up"}</button>
  </div>`;
}

function recipeDetails(meal) {
  if (!meal.shoppingList && !meal.ingredients && !meal.instructions) return "";
  return `<details class="meal-recipe">
    <summary>Shopping, ingredients &amp; instructions</summary>
    <div>
      ${meal.shoppingList ? `<strong>Shopping list</strong><p>${escapeHtml(meal.shoppingList)}</p>` : ""}
      ${meal.ingredients ? `<strong>Ingredients</strong><p>${escapeHtml(meal.ingredients)}</p>` : ""}
      ${meal.instructions ? `<strong>Instructions</strong><p>${escapeHtml(meal.instructions)}</p>` : ""}
    </div>
  </details>`;
}

function mealSlot(day, meal) {
  const label = meal.meal[0].toUpperCase() + meal.meal.slice(1);
  if (meal.status === "fixed") {
    return `<div class="meal-slot fixed"><span>${label}</span><strong>Mom</strong><small>Breakfast chef · every morning</small></div>`;
  }
  if (meal.status === "eatingOut") {
    return `<div class="meal-slot eating-out"><span>${label}</span><strong>Eating out</strong><small>No chef needed</small></div>`;
  }
  const claimed = meal.status === "claimed";
  const headline = claimed ? meal.dishName || meal.assignedTo : "Chef needed";
  const detail = claimed && meal.dishName ? `Chef: ${meal.assignedTo}` : claimed ? "Meal chef" : "Plans · purchases · cooks";
  return `<div class="meal-slot ${claimed ? "claimed" : "open"}">
    <span>${label}</span>
    <strong>${escapeHtml(headline)}</strong>
    <small>${escapeHtml(detail)}</small>
    <button type="button" data-meal-date="${day.date}" data-meal-slot="${meal.meal}">${claimed ? "Edit chef" : "Be the chef"}</button>
    ${claimed ? recipeDetails(meal) : ""}
  </div>`;
}

function render() {
  const days = state.schedule?.days || [];
  const filled = days.reduce((count, day) => count
    + Number(Boolean(day.helper?.assignedTo))
    + day.meals.filter((meal) => meal.status === "claimed").length, 0);
  document.querySelector("#meal-progress").textContent = `${filled} of ${TOTAL_OPEN_POSITIONS} positions filled`;
  document.querySelector("#meal-progress-note").textContent = `${TOTAL_OPEN_POSITIONS - filled} positions are still available.`;
  document.querySelector("#meal-progress-bar").style.width = `${Math.round((filled / TOTAL_OPEN_POSITIONS) * 100)}%`;

  mealDays.innerHTML = days.map((day) => {
    const date = dateParts(day.date);
    return `<article class="meal-day-card" id="meals-${day.date}">
      <header><div><span>${date.shortWeekday}</span><strong>${date.day}</strong></div><h3>${date.weekday}<small>${date.month} ${date.day}</small></h3></header>
      ${helperSlot(day)}
      <div class="meal-slots">${day.meals.map((meal) => mealSlot(day, meal)).join("")}</div>
    </article>`;
  }).join("");
}

function currentPosition(date, slot) {
  const day = state.schedule.days.find((item) => item.date === date);
  if (!day) return null;
  if (slot === "helper") return day.helper;
  return day.meals.find((meal) => meal.meal === slot && meal.status === "claimed") || null;
}

function openSignup(date, slot) {
  const display = dateParts(date);
  const position = currentPosition(date, slot);
  const helper = slot === "helper";
  state.activeDate = date;
  state.activeSlot = slot;
  mealForm.reset();
  document.querySelector("#meal-date").value = date;
  document.querySelector("#meal-slot").value = slot;
  document.querySelector("#meal-dialog-eyebrow").textContent = helper ? "All-day helper" : "Meal chef";
  document.querySelector("#meal-dialog-title").textContent = `${helper ? "Helper" : `${slot[0].toUpperCase()}${slot.slice(1)} chef`} · ${display.weekday}, July ${display.day}`;
  document.querySelector("#meal-dialog-description").textContent = helper
    ? "Help all three meals with preparation, errands, serving, and cleanup."
    : "Plan this meal for 12 people, coordinate purchasing, and cook with the day’s helper.";
  document.querySelector("#meal-name").value = position?.assignedTo || storedName();
  const chefDetails = document.querySelector("#meal-chef-details");
  chefDetails.hidden = helper;
  chefDetails.querySelectorAll("input, textarea").forEach((input) => { input.disabled = helper; });
  document.querySelector("#meal-dish").value = position?.dishName || "";
  document.querySelector("#meal-shopping-list").value = position?.shoppingList || "";
  document.querySelector("#meal-ingredients").value = position?.ingredients || "";
  document.querySelector("#meal-instructions").value = position?.instructions || "";
  document.querySelector("#meal-release").hidden = !position?.assignedTo;
  mealDialog.showModal();
  document.querySelector("#meal-name").focus();
}

mealDays.addEventListener("click", (event) => {
  const button = event.target.closest("[data-meal-slot]");
  if (button) openSignup(button.dataset.mealDate, button.dataset.mealSlot);
});

document.querySelector("#meal-close").addEventListener("click", () => mealDialog.close());

mealForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(mealForm);
  const submit = document.querySelector("#meal-submit");
  submit.disabled = true;
  submit.textContent = "Saving…";
  try {
    state.schedule = await request({
      method: "PUT",
      body: JSON.stringify({
        date: form.get("date"),
        slot: form.get("slot"),
        assignedTo: form.get("assignedTo"),
        dishName: form.get("dishName"),
        shoppingList: form.get("shoppingList"),
        ingredients: form.get("ingredients"),
        instructions: form.get("instructions"),
        website: form.get("website")
      })
    });
    saveName(String(form.get("assignedTo") || "").trim());
    render();
    mealDialog.close();
    toast("Meal position saved.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    submit.disabled = false;
    submit.textContent = "Save signup";
  }
});

document.querySelector("#meal-release").addEventListener("click", async () => {
  const release = document.querySelector("#meal-release");
  release.disabled = true;
  release.textContent = "Releasing…";
  try {
    state.schedule = await request({
      method: "DELETE",
      body: JSON.stringify({ date: state.activeDate, slot: state.activeSlot })
    });
    render();
    mealDialog.close();
    toast("Meal position released.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    release.disabled = false;
    release.textContent = "Release position";
  }
});

request().then((schedule) => {
  state.schedule = schedule;
  render();
}).catch((error) => {
  mealDays.innerHTML = `<div class="locations-empty"><h2>We couldn’t load the meal schedule</h2><p>${escapeHtml(error.message)}</p></div>`;
  document.querySelector("#meal-progress").textContent = "Please refresh in a moment.";
});
