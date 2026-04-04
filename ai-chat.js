/**
 * Flow — AI coach chat (Groq via Netlify function), persistent history
 */
(function (global) {
  const HISTORY_KEY = "flow_chat_history_v1";
  const MAX_MESSAGES = 40;

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(-MAX_MESSAGES) : [];
    } catch (_) {
      return [];
    }
  }

  function saveHistory(messages) {
    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(messages.slice(-MAX_MESSAGES))
      );
    } catch (_) {}
  }

  function clearHistoryUI() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (_) {}
    const box = document.getElementById("chat-messages");
    if (box) {
      const welcome =
        global.FlowI18n && global.FlowI18n.t
          ? global.FlowI18n.t("chat_welcome")
          : "Hi! I'm Flow.";
      box.innerHTML = `<div class="chat-msg msg-ai"><div class="ai-response-card">${escapeHtml(
        welcome
      )}</div></div>`;
    }
  }

  function getMessagesEl() {
    return document.getElementById("chat-messages");
  }

  function scrollToBottom() {
    const el = getMessagesEl();
    if (el) el.scrollTop = el.scrollHeight;
  }

  function appendUser(text) {
    const el = getMessagesEl();
    if (!el) return;
    el.insertAdjacentHTML(
      "beforeend",
      `<div class="chat-msg msg-user"><div class="chat-bubble-user">${escapeHtml(
        text
      )}</div></div>`
    );
    scrollToBottom();
  }

  function appendTyping(id) {
    const el = getMessagesEl();
    if (!el) return;
    const typing =
      global.FlowI18n && global.FlowI18n.t
        ? global.FlowI18n.t("typing")
        : "Thinking…";
    el.insertAdjacentHTML(
      "beforeend",
      `<div id="${id}" class="chat-msg msg-ai"><div class="ai-response-card typing-card"><span class="typing-dots"><span></span><span></span><span></span></span> ${escapeHtml(
        typing
      )}</div></div>`
    );
    scrollToBottom();
  }

  function removeTyping(id) {
    const n = document.getElementById(id);
    if (n) n.remove();
  }

  function appendAssistant(htmlBody) {
    const el = getMessagesEl();
    if (!el) return;
    el.insertAdjacentHTML(
      "beforeend",
      `<div class="chat-msg msg-ai"><div class="ai-response-card">${htmlBody}</div></div>`
    );
    scrollToBottom();
  }

  function formatReply(text) {
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  /** buildUserContext: async () => object */
  async function send(buildUserContext) {
    const input = document.getElementById("chat-input");
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;

    let history = loadHistory();
    appendUser(msg);
    input.value = "";

    const typingId = "typing-" + Date.now();
    appendTyping(typingId);

    history.push({ role: "user", content: msg });

    let userContext = {};
    try {
      userContext = (await buildUserContext()) || {};
    } catch (_) {}

    try {
      const res = await fetch("/.netlify/functions/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          userContext,
        }),
      });

      removeTyping(typingId);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Network error");
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const reply = data.reply || "";
      history.push({ role: "assistant", content: reply });
      saveHistory(history);
      appendAssistant(formatReply(reply));
    } catch (e) {
      removeTyping(typingId);
      history.pop();
      saveHistory(history);
      appendAssistant(
        `<p class="chat-error">⚠️ ${escapeHtml(e.message || "Failed to connect")}</p>`
      );
    }
  }

  function handleKey(e, buildUserContext) {
    if (e.key === "Enter") send(buildUserContext);
  }

  function hydrateFromStorage() {
    const el = getMessagesEl();
    if (!el) return;
    const history = loadHistory();
    if (!history.length) return;
    el.innerHTML = "";
    history.forEach((m) => {
      if (m.role === "user")
        el.insertAdjacentHTML(
          "beforeend",
          `<div class="chat-msg msg-user"><div class="chat-bubble-user">${escapeHtml(
            m.content
          )}</div></div>`
        );
      else if (m.role === "assistant")
        el.insertAdjacentHTML(
          "beforeend",
          `<div class="chat-msg msg-ai"><div class="ai-response-card">${formatReply(
            m.content
          )}</div></div>`
        );
    });
    scrollToBottom();
  }

  global.FlowChat = {
    loadHistory,
    saveHistory,
    clearHistoryUI,
    send,
    handleKey,
    hydrateFromStorage,
  };
})(typeof window !== "undefined" ? window : globalThis);
