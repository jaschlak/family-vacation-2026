const NAME_KEY = "family-vacation-display-name";
const messageList = document.querySelector("#message-list");
const messageForm = document.querySelector("#message-form");
const status = document.querySelector("#chat-status");

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[character]);

function storedName() {
  try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
}

function saveName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* The chat still works without saved preferences. */ }
}

function messageTime(value) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? "" : new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  }).format(date);
}

function renderMessages(messages) {
  messageList.innerHTML = messages.length ? messages.map((item) => `
    <article class="chat-message">
      <div class="message-meta"><strong>${escapeHtml(item.author)}</strong><time>${escapeHtml(messageTime(item.createdAt))}</time></div>
      <p>${escapeHtml(item.message)}</p>
    </article>
  `).join("") : `<div class="chat-empty"><strong>No messages yet.</strong><span>Start the family conversation below.</span></div>`;
  messageList.scrollTop = messageList.scrollHeight;
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Something went wrong. Please try again.");
  return payload;
}

async function loadMessages(quiet = false) {
  const refresh = document.querySelector("#refresh-chat");
  refresh.disabled = true;
  try {
    const result = await api("/api/messages");
    renderMessages(result.messages);
    status.classList.remove("error");
    status.textContent = quiet ? "" : "Conversation refreshed.";
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("error");
  } finally {
    refresh.disabled = false;
  }
}

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(messageForm);
  const submit = messageForm.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.textContent = "Sending…";
  status.classList.remove("error");
  try {
    const author = String(form.get("author")).trim();
    await api("/api/messages", {
      method: "POST",
      body: JSON.stringify({ author, message: form.get("message"), website: form.get("website") })
    });
    saveName(author);
    messageForm.querySelector("textarea").value = "";
    status.textContent = "Message sent.";
    await loadMessages(true);
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("error");
  } finally {
    submit.disabled = false;
    submit.textContent = "Send message →";
  }
});

document.querySelector("#refresh-chat").addEventListener("click", () => loadMessages());
document.querySelector("#chat-author").value = storedName();
loadMessages(true);
setInterval(() => { if (!document.hidden) loadMessages(true); }, 15000);
