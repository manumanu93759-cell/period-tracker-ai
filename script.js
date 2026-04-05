/* Flow AI — core app: storage, UI, risks, notifications, exports */
const LS_KEY = "flow_tracker_v4";
const LS_LEGACY = "flow_tracker_v3";

const defaultData = () => ({
  periods: [],
  daily_logs: [],
  notify: {
    enabled: false,
    period: true,
    ovulation: true,
    mood: true,
    health: true,
  },
  lastNotify: {},
});

function loadData() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return {
        ...defaultData(),
        ...d,
        notify: { ...defaultData().notify, ...(d.notify || {}) },
        lastNotify: d.lastNotify || {},
      };
    }
    const leg = localStorage.getItem(LS_LEGACY);
    if (leg) {
      const d = JSON.parse(leg);
      const merged = { ...defaultData(), ...d };
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (_) {}
  return defaultData();
}

let localData = loadData();
const saveLocal = () =>
  localStorage.setItem(LS_KEY, JSON.stringify(localData));

const t = (k) => (window.FlowI18n ? FlowI18n.t(k) : k);

const PHASE_LABEL_KEYS = {
  menstrual: "phase_menstrual",
  follicular: "phase_follicular",
  ovulation: "phase_ovulation",
  luteal: "phase_luteal",
  unknown: "phase_unknown",
};

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  });
  const ph = document.getElementById("chat-input");
  if (ph && ph.getAttribute("data-i18n-placeholder")) {
    ph.placeholder = t(ph.getAttribute("data-i18n-placeholder"));
  }
  document.title = `${t("appTitle")} — ${t("appTagline")}`;
}

function getLocale() {
  const L = FlowI18n.getLang();
  if (L === "hi") return "hi-IN";
  if (L === "kn") return "kn-IN";
  return undefined;
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(getLocale() || undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getSnapshot() {
  return FlowPrediction.computePredictionSnapshot(localData.periods);
}

function getPhase() {
  return getSnapshot().phase;
}

function getAvgCycle() {
  return getSnapshot().weightedCycleDays;
}

function checkIrregularity() {
  const s = getSnapshot();
  return s.irregularityLevel === "high" || s.irregularityScore >= 0.45;
}

function computeHealthRisks() {
  const risks = [];
  const periods = localData.periods || [];
  const logs = localData.daily_logs || [];
  if (!periods.length) return risks;

  const lens = FlowPrediction.getCycleLengths(periods);
  const snap = getSnapshot();
  const lastStart = FlowPrediction.lastPeriodStart(periods);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (lens.length >= 3) {
    const last3 = lens.slice(-3);
    if (Math.max(...last3) - Math.min(...last3) > 7) {
      risks.push({ id: "irregular", severity: "warn" });
    }
  } else if (snap.irregularityLevel === "high") {
    risks.push({ id: "irregular", severity: "warn" });
  }

  if (lens.some((L) => L > 45)) {
    risks.push({ id: "long_cycle", severity: "warn" });
  }

  if (lastStart) {
    const daysSince = Math.floor((today - lastStart) / 86400000);
    const menstrualNow = snap.phase === "menstrual";
    if (!menstrualNow && daysSince > 55 && lens.length >= 1) {
      risks.push({ id: "absence", severity: "warn" });
    }
  }

  const recentLogs = [...logs]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 7);
  if (recentLogs.length >= 3) {
    const avgPain =
      recentLogs.reduce((s, l) => s + (l.pain_level || 0), 0) /
      recentLogs.length;
    if (avgPain >= 6.5) risks.push({ id: "pain", severity: "warn" });
  }

  const sorted = [...logs].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
  const last14 = sorted.slice(-14);
  if (last14.length >= 7) {
    const low = last14.filter((l) =>
      ["Sad", "Tired", "Irritated"].includes(l.mood)
    ).length;
    if (low >= 6) risks.push({ id: "mood", severity: "info" });
  }

  if (lens.length >= 4) {
    const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
    if (avg > 35 && snap.irregularityScore > 0.28) {
      risks.push({ id: "pcos_hint", severity: "info" });
    }
  }

  const seen = new Set();
  return risks.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

function riskKey(id) {
  const map = {
    irregular: "risk_irregular",
    long_cycle: "risk_long_cycle",
    absence: "risk_absence",
    pain: "risk_pain",
    mood: "risk_mood",
    pcos_hint: "risk_pcos_hint",
  };
  return map[id] || id;
}

function renderRiskPanel() {
  const risks = computeHealthRisks();
  if (!risks.length) return "";
  const items = risks
    .map(
      (r) => `
    <div class="risk-item severity-${r.severity}">
      <div class="risk-dot"></div>
      <p>${t(riskKey(r.id))}</p>
    </div>`
    )
    .join("");
  return `
  <div class="card glass-card risk-card">
    <h2 class="card-title">${t("risk_panel_title")}</h2>
    <p class="risk-disclaimer">${t("risk_disclaimer")}</p>
    <div class="risk-list">${items}</div>
  </div>`;
}

function notifyPrefsHtml() {
  const n = localData.notify;
  const chk = (k) => (n[k] ? "checked" : "");
  return `
  <div class="card glass-card notify-card">
    <h2 class="card-title">${t("notify_enable")}</h2>
    <label class="toggle-row"><input type="checkbox" id="np-enabled" ${
      n.enabled ? "checked" : ""
    }> <span>${t("notify_enable")}</span></label>
    <label class="toggle-row"><input type="checkbox" id="np-period" ${chk(
      "period"
    )}> <span>${t("notify_period")}</span></label>
    <label class="toggle-row"><input type="checkbox" id="np-ovulation" ${chk(
      "ovulation"
    )}> <span>${t("notify_ovulation")}</span></label>
    <label class="toggle-row"><input type="checkbox" id="np-mood" ${chk(
      "mood"
    )}> <span>${t("notify_mood")}</span></label>
    <label class="toggle-row"><input type="checkbox" id="np-health" ${chk(
      "health"
    )}> <span>${t("notify_health")}</span></label>
  </div>`;
}

function bindNotifyToggles() {
  const bind = (id, key, parent) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => {
      localData.notify[key] = el.checked;
      if (key === "enabled" && el.checked) initNotifications();
      saveLocal();
    });
  };
  bind("np-enabled", "enabled");
  bind("np-period", "period");
  bind("np-ovulation", "ovulation");
  bind("np-mood", "mood");
  bind("np-health", "health");
}

function initNotifications() {
  if (
    typeof Notification !== "undefined" &&
    Notification.permission !== "granted" &&
    Notification.permission !== "denied"
  ) {
    Notification.requestPermission();
  }
}

function notifKey(type, extra) {
  return `${type}:${extra}`;
}

function shouldFire(key, minIntervalMs) {
  const last = localData.lastNotify[key] || 0;
  return Date.now() - last > minIntervalMs;
}

function markSent(key) {
  localData.lastNotify[key] = Date.now();
  saveLocal();
}

function runSmartNotifications() {
  if (!localData.notify.enabled) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted")
    return;

  const snap = getSnapshot();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = snap.nextPeriodStart;
  const ov = snap.ovulationDate;

  if (localData.notify.period && next) {
    const d = Math.ceil((next - today) / 86400000);
    if (d === 1 && shouldFire("period-1d", 36 * 3600000)) {
      new Notification(t("next_period"), {
        body: t("notify_period"),
        icon: "/favicon.ico",
      });
      markSent("period-1d");
    }
  }

  if (localData.notify.ovulation && ov) {
    const d = Math.ceil((ov - today) / 86400000);
    if (d === 0 && shouldFire("ov-0d", 36 * 3600000)) {
      new Notification(t("est_ovulation"), {
        body: t("notify_ovulation"),
      });
      markSent("ov-0d");
    }
  }

  if (localData.notify.mood) {
    const h = new Date().getHours();
    if (h === 9 && shouldFire("mood-daily", 20 * 3600000)) {
      new Notification(t("notify_mood"), { body: t("mood_today") });
      markSent("mood-daily");
    }
  }

  if (localData.notify.health) {
    if (shouldFire("health-weekly", 6 * 24 * 3600000)) {
      new Notification(t("notify_health"), { body: t("dash_sub") });
      markSent("health-weekly");
    }
  }
}

function navigate(page) {
  if (page !== "analytics" && window.FlowAnalytics)
    FlowAnalytics.destroyAll();

  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  const target = document.getElementById("page-" + page);
  if (target) target.classList.add("active");
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-page") === page);
  });

  if (page === "dashboard") renderDashboard();
  if (page === "predictions") renderPredictions();
  if (page === "analytics") renderAnalytics();
  if (page === "history") renderHistory();
  if (page === "ai") prefillAIForm();
}

function renderDashboard() {
  initNotifications();
  const snap = getSnapshot();
  const phase = snap.phase;
  const phaseKey = PHASE_LABEL_KEYS[phase] || PHASE_LABEL_KEYS.unknown;
  const next = snap.nextPeriodStart;
  const ovulation = snap.ovulationDate;
  const fert = snap.fertilityWindow;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let daysUntil = null;
  let nextStr = "—";
  let heroSub = t("log_to_predict");
  if (next) {
    daysUntil = Math.ceil((next - today) / 86400000);
    nextStr = formatDate(next);
    heroSub =
      daysUntil > 0
        ? `${daysUntil} ${t("days_away")}`
        : daysUntil === 0
          ? t("expected_today")
          : `${Math.abs(daysUntil)} ${t("overdue")}`;
  }

  let ovStr = "—";
  let fertStr = "—";
  if (ovulation) ovStr = formatDate(ovulation);
  if (fert && fert.start && fert.end) {
    fertStr = `${formatDate(fert.start)} – ${formatDate(fert.end)}`;
  }

  const irregularLabel =
    snap.irregularityLevel === "stable"
      ? t("stable")
      : snap.irregularityLevel === "moderate"
        ? t("moderate")
        : t("high");

  document.getElementById("dashboard-content").innerHTML = `
    ${renderRiskPanel()}
    <div class="hero-card glass-hero">
      <div class="label">${t("next_period")}</div>
      <div class="big-date">${nextStr}</div>
      <div class="sub">${heroSub}</div>
      <div class="phase-badge">✨ ${t(phaseKey)}</div>
    </div>
    <div class="stats-row stats-row-3">
      <div class="stat-pill glass-stat"><div class="s-num sm">${ovStr}</div><div class="s-label">${t("est_ovulation")}</div></div>
      <div class="stat-pill glass-stat"><div class="s-num">${snap.weightedCycleDays}</div><div class="s-label">${t("weighted_cycle")}</div></div>
      <div class="stat-pill glass-stat"><div class="s-num sm">${irregularLabel}</div><div class="s-label">${t("metric_irregularity")}</div></div>
    </div>
    <p class="hint-inline">${t("metric_irregularity_hint")}</p>
    <div class="card glass-card">
      <h2 class="card-title">${t("fertility_window")}</h2>
      <p class="big-soft">${fertStr}</p>
      <p class="card-hint">${t("ovulation_window")}: ${ovStr}</p>
    </div>
    <div class="card glass-card">
      <h2 class="card-title">${t("ai_coach_cta")}</h2>
      <p class="card-hint">${t("ai_page_sub")}</p>
      <button type="button" class="btn btn-secondary" id="btn-goto-ai">${t("open_coach")}</button>
    </div>
    <div class="card glass-card privacy-card">
      <h2 class="card-title">${t("privacy_title")}</h2>
      <p class="card-hint">${t("privacy_body")}</p>
      <div class="export-row">
        <button type="button" class="btn btn-secondary" id="btn-export-csv">${t("export_csv")}</button>
        <button type="button" class="btn btn-secondary" id="btn-export-pdf">${t("export_pdf")}</button>
      </div>
    </div>
    ${notifyPrefsHtml()}
  `;

  document.getElementById("btn-goto-ai")?.addEventListener("click", () => {
    document.querySelector('.nav-btn[data-page="ai"]')?.click();
  });
  document.getElementById("btn-export-csv")?.addEventListener("click", exportCsv);
  document.getElementById("btn-export-pdf")?.addEventListener("click", exportPdf);
  bindNotifyToggles();
  runSmartNotifications();
}

function renderPredictions() {
  const snap = getSnapshot();
  const lens = snap.cycleLengths;
  const avgSimple =
    lens.length > 0
      ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)
      : "—";
  const dur = snap.avgPeriodDurationDays;
  const pctIrreg = Math.round(snap.irregularityScore * 100);
  const next = snap.nextPeriodStart;
  const ov = snap.ovulationDate;
  const fw = snap.fertilityWindow;

  document.getElementById("predictions-content").innerHTML = `
    <div class="card glass-card">
      <h2 class="card-title">${t("predictions_title")}</h2>
      <p class="card-hint">${t("predictions_sub")}</p>
      <ul class="pred-list">
        <li><strong>${t("avg_cycle")}:</strong> ${avgSimple} ${t("days_label")}</li>
        <li><strong>${t("weighted_cycle")}:</strong> ${snap.weightedCycleDays} ${t("days_label")}</li>
        <li><strong>${t("period_length")}:</strong> ${dur} ${t("days_label")} <span class="muted">(n=${snap.periodSamples})</span></li>
        <li><strong>${t("metric_irregularity")}:</strong> ${pctIrreg}% · ${t(snap.irregularityLevel === "stable" ? "stable" : snap.irregularityLevel === "moderate" ? "moderate" : "high")}</li>
        <li><strong>${t("next_period")}:</strong> ${next ? formatDate(next) : "—"}</li>
        <li><strong>${t("ovulation_window")}:</strong> ${ov ? formatDate(ov) : "—"}</li>
        <li><strong>${t("fertility_window")}:</strong> ${fw && fw.start ? `${formatDate(fw.start)} → ${formatDate(fw.end)}` : "—"}</li>
      </ul>
    </div>
  `;
}

function renderAnalytics() {
  document.getElementById("analytics-content").innerHTML = `
    <div class="card glass-card"><h2 class="card-title">${t("chart_cycle")}</h2><div class="chart-container"><canvas id="chart-cycle" aria-label="${t("chart_cycle")}"></canvas></div></div>
    <div class="card glass-card"><h2 class="card-title">${t("chart_mood")}</h2><div class="chart-container"><canvas id="chart-mood"></canvas></div></div>
    <div class="card glass-card"><h2 class="card-title">${t("chart_pain")}</h2><div class="chart-container"><canvas id="chart-pain"></canvas></div></div>
    <div class="card glass-card"><h2 class="card-title">${t("chart_energy")}</h2><div class="chart-container"><canvas id="chart-energy"></canvas></div></div>
  `;
  setTimeout(() => FlowAnalytics.render(localData, getLocale()), 50);
}

function renderHistory() {
  const periods = [...(localData.periods || [])].sort(
    (a, b) => new Date(b.start_date) - new Date(a.start_date)
  );
  const logs = [...(localData.daily_logs || [])].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  if (!periods.length) {
    document.getElementById("history-content").innerHTML = `
      <div class="empty-state glass-card">
        <div class="empty-ico" aria-hidden="true">🗓️</div>
        <div class="empty-title">${t("empty_history")}</div>
        <div class="empty-sub">${t("empty_history_hint")}</div>
      </div>`;
    return;
  }

  const lens = FlowPrediction.getCycleLengths(
    [...periods].sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
  ).reverse();

  const periodBlock = `
    <div class="card glass-card">
      <h2 class="card-title">${t("period_dates")} (${periods.length})</h2>
      ${periods
        .map((p, i) => {
          const s = new Date(p.start_date);
          const e = p.end_date ? new Date(p.end_date) : null;
          const dur = e ? Math.floor((e - s) / 86400000) + 1 : "?";
          const cl = lens[i] ?? null;
          return `<div class="history-item">
            <div><div class="h-date">${formatDate(s)}</div>
            <div class="h-days">${dur} ${t("days_label")}${cl ? ` · ${cl} ${t("avg_cycle").toLowerCase()}` : ""}</div></div>
            <div class="h-len">${dur}</div>
          </div>`;
        })
        .join("")}
    </div>`;

  const logPreview = logs
    .slice(0, 12)
    .map(
      (l) => `<div class="history-item">
      <div><div class="h-date">${l.date}</div>
      <div class="h-days">${l.mood || "—"} · pain ${l.pain_level ?? "—"} · E ${l.energy_level ?? "—"}</div></div>
    </div>`
    )
    .join("");

  document.getElementById("history-content").innerHTML = `
    ${periodBlock}
    <div class="card glass-card">
      <h2 class="card-title">${t("daily_checkin")}</h2>
      ${logPreview || `<p class="muted">${t("empty_history_hint")}</p>`}
    </div>
    <button type="button" class="btn btn-secondary" id="btn-clear-all">${t("clear_all")}</button>
  `;
  document.getElementById("btn-clear-all")?.addEventListener("click", confirmClear);
}

async function buildChatUserContext() {
  const snap = getSnapshot();
  const risks = computeHealthRisks();
  const riskSummary = risks.length
    ? risks.map((r) => r.id).join(", ")
    : "none";
  const logs = [...(localData.daily_logs || [])].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
  const recent = logs.slice(0, 3);
  const symptomSummary = recent
    .map(
      (l) =>
        `${l.date}: mood ${l.mood || "?"}, pain ${l.pain_level ?? "?"}, energy ${l.energy_level ?? "?"}`
    )
    .join("; ");

  return {
    locale: FlowI18n.getLang(),
    phase: snap.phase,
    avgCycle: snap.averageCycleDays,
    weightedCycle: snap.weightedCycleDays,
    nextPeriod: snap.nextPeriodStart
      ? formatDate(snap.nextPeriodStart)
      : "unknown",
    ovulation: snap.ovulationDate ? formatDate(snap.ovulationDate) : "unknown",
    irregular: checkIrregularity(),
    riskSummary,
    symptomSummary: symptomSummary || "not enough logs",
  };
}

function initChatShell() {
  const box = document.getElementById("chat-messages");
  if (!box) return;
  const hist = FlowChat.loadHistory();
  if (!hist.length) {
    box.innerHTML = `<div class="chat-msg msg-ai"><div class="ai-response-card">${escapeHtml(
      t("chat_welcome")
    )}</div></div>`;
  } else {
    FlowChat.hydrateFromStorage();
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function savePeriod() {
  const start = document.getElementById("start-date").value;
  const end = document.getElementById("end-date").value;
  if (!start) {
    showToast(t("first_day") + "…");
    return;
  }
  const ex = localData.periods.find((p) => p.start_date === start);
  if (ex) ex.end_date = end || ex.end_date;
  else
    localData.periods.push({
      start_date: start,
      end_date: end || null,
      id: Date.now(),
    });
  saveLocal();
  document.getElementById("start-date").value = "";
  document.getElementById("end-date").value = "";
  showToast(t("toast_saved_period"));
  if (document.getElementById("page-dashboard")?.classList.contains("active"))
    renderDashboard();
}

function saveDailyLog() {
  const today = new Date().toISOString().split("T")[0];
  const mood = document.querySelector("#log-mood-grid .mood-btn.selected")
    ?.dataset.mood;
  const pain = parseInt(document.getElementById("pain-slider").value, 10);
  const energy = parseInt(document.getElementById("energy-slider").value, 10);
  const flow = document.querySelector("#flow-chips .chip.selected")?.dataset
    .val;
  const sleep = document.querySelector("#sleep-chips .chip.selected")?.dataset
    .val;

  const log = {
    date: today,
    mood: mood || null,
    pain_level: pain,
    energy_level: energy,
    flow_level: flow || null,
    sleep_quality: sleep || null,
  };
  const ex = localData.daily_logs.find((l) => l.date === today);
  if (ex) Object.assign(ex, log);
  else localData.daily_logs.push(log);
  saveLocal();

  document
    .querySelectorAll("#log-mood-grid .mood-btn, #flow-chips .chip, #sleep-chips .chip")
    .forEach((el) => el.classList.remove("selected"));
  document.getElementById("pain-slider").value = 5;
  document.getElementById("energy-slider").value = 5;
  updateSlider(document.getElementById("pain-slider"));
  updateEnergySlider(document.getElementById("energy-slider"));
  showToast(t("toast_saved_checkin"));
}

let selectedAIMood = null;

function prefillAIForm() {
  const ph = getPhase();
  if (ph !== "unknown") document.getElementById("ai-phase").value = ph;
  const today = new Date().toISOString().split("T")[0];
  const log = localData.daily_logs.find((l) => l.date === today);
  if (log?.pain_level != null) {
    document.getElementById("ai-pain-slider").value = log.pain_level;
    updateAISlider(document.getElementById("ai-pain-slider"));
  }
  if (log?.energy_level != null) {
    document.getElementById("ai-energy-slider").value = log.energy_level;
    updateAIEnergySlider(document.getElementById("ai-energy-slider"));
  }
  initChatShell();
}

function selectAIMood(btn) {
  document.querySelectorAll("#ai-mood-grid .mood-btn").forEach((b) => {
    b.classList.remove("selected");
  });
  btn.classList.add("selected");
  selectedAIMood = btn.dataset.mood;
}

async function getStaticAISuggestions() {
  const phase = document.getElementById("ai-phase").value;
  const pain = parseInt(document.getElementById("ai-pain-slider").value, 10);
  const energy = parseInt(
    document.getElementById("ai-energy-slider").value,
    10
  );
  if (!selectedAIMood) {
    showToast(t("toast_select_mood"));
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const log = localData.daily_logs.find((l) => l.date === today);
  const sleep = log?.sleep_quality || "Okay";

  const btn = document.getElementById("ai-submit-btn");
  btn.disabled = true;
  const prevText = btn.textContent;
  btn.textContent = "…";

  document.getElementById("ai-result").innerHTML = `<div class="ai-loading glass-card"><div class="spinner-circle"></div><p>${t("generate_report")}</p></div>`;

  try {
    const res = await fetch(`/.netlify/functions/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_phase: phase,
        mood: selectedAIMood,
        pain_level: pain,
        energy_level: energy,
        sleep_quality: sleep,
      }),
    });
    const text = await res.text();
    if (!text) throw new Error("Empty response");
    const json = JSON.parse(text);
    if (!res.ok) throw new Error(json.error || "Server error");
    renderStaticAIResult(json.data);
  } catch (err) {
    document.getElementById(
      "ai-result"
    ).innerHTML = `<div class="card glass-card" style="color:#c0392b;text-align:center;padding:24px;">⚠️ ${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = prevText;
  }
}

function renderStaticAIResult(data) {
  const mk = (arr, c) =>
    (arr || [])
      .map(
        (x, i) =>
          `<div class="ai-item"><div class="ai-bullet" style="background:${c}22;color:${c};">${i + 1}</div><div class="ai-item-text">${x}</div></div>`
      )
      .join("");
  document.getElementById("ai-result").innerHTML = `
    <div class="card glass-card ai-result-card">
      <h2 class="card-title">🌸 ${t(PHASE_LABEL_KEYS[data.phase] || "phase_unknown")}</h2>
      <div class="mood-analysis-box"><p>${data.mood_analysis || ""}</p></div>
      <div class="ai-section-label">🥗</div>
      ${mk(data.food_suggestions, "#E8667A")}
      <div class="ai-section-label">🏃</div>
      ${mk(data.exercise_suggestions, "#27ae60")}
      <div class="ai-section-label">💡</div>
      ${mk(data.health_tips, "#8e44ad")}
      <div class="ai-section-label">😴</div>
      ${mk(data.sleep_advice, "#3498db")}
      <div class="ai-section-label">🧘</div>
      ${mk(data.stress_advice, "#9b59b6")}
    </div>`;
}

function selectMoodLog(btn) {
  document.querySelectorAll("#log-mood-grid .mood-btn").forEach((b) => {
    b.classList.remove("selected");
  });
  btn.classList.add("selected");
}

function selectChip(chip, groupId) {
  document.querySelectorAll("#" + groupId + " .chip").forEach((c) => {
    c.classList.remove("selected");
  });
  chip.classList.add("selected");
}

function updateSlider(el) {
  if (!el) return;
  el.style.setProperty("--val", (el.value / 10) * 100 + "%");
  const l = document.getElementById("pain-val-label");
  const d = document.getElementById("pain-display");
  if (l) l.textContent = el.value;
  if (d) d.textContent = el.value;
}

function updateEnergySlider(el) {
  if (!el) return;
  el.style.setProperty("--val", (el.value / 10) * 100 + "%");
  const l = document.getElementById("energy-val-label");
  const d = document.getElementById("energy-display");
  if (l) l.textContent = el.value;
  if (d) d.textContent = el.value;
}

function updateAISlider(el) {
  if (!el) return;
  el.style.setProperty("--val", (el.value / 10) * 100 + "%");
  const l = document.getElementById("ai-pain-label");
  const d = document.getElementById("ai-pain-display");
  if (l) l.textContent = el.value;
  if (d) d.textContent = el.value;
}

function updateAIEnergySlider(el) {
  if (!el) return;
  el.style.setProperty("--val", (el.value / 10) * 100 + "%");
  const l = document.getElementById("ai-energy-label");
  const d = document.getElementById("ai-energy-display");
  if (l) l.textContent = el.value;
  if (d) d.textContent = el.value;
}

function showToast(msg) {
  const tEl = document.getElementById("toast");
  if (!tEl) return;
  tEl.textContent = msg;
  tEl.classList.add("show");
  setTimeout(() => tEl.classList.remove("show"), 2800);
}

function confirmClear() {
  if (confirm(t("confirm_clear"))) {
    localData = defaultData();
    saveLocal();
    renderHistory();
    showToast(t("toast_cleared"));
  }
}

function exportCsv() {
  const lines = [];
  lines.push("type,start_date,end_date,date,mood,pain,energy,flow,sleep");
  (localData.periods || []).forEach((p) => {
    lines.push(
      `period,${p.start_date},${p.end_date || ""},,,,,,`
    );
  });
  (localData.daily_logs || []).forEach((l) => {
    lines.push(
      `daily,,,${l.date},${l.mood || ""},${l.pain_level ?? ""},${l.energy_level ?? ""},${l.flow_level || ""},${l.sleep_quality || ""}`
    );
  });
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "flow-ai-export.csv";
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(t("toast_exported"));
}

function exportPdf() {
  const mod = window.jspdf;
  const JsPDF = mod?.jsPDF || mod?.default;
  if (typeof JsPDF !== "function") {
    showToast("jsPDF missing");
    return;
  }
  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  let y = margin;
  doc.setFontSize(16);
  doc.text("Flow AI — data export", margin, y);
  y += 28;
  doc.setFontSize(10);
  doc.text(`${t("privacy_title")}: ${t("privacy_body")}`, margin, y, {
    maxWidth: 520,
  });
  y += 36;
  doc.setFontSize(12);
  doc.text("Periods", margin, y);
  y += 18;
  doc.setFontSize(10);
  (localData.periods || []).forEach((p) => {
    doc.text(`${p.start_date} → ${p.end_date || "open"}`, margin, y);
    y += 14;
    if (y > 760) {
      doc.addPage();
      y = margin;
    }
  });
  y += 10;
  doc.setFontSize(12);
  doc.text("Daily logs", margin, y);
  y += 18;
  doc.setFontSize(10);
  (localData.daily_logs || []).forEach((l) => {
    doc.text(
      `${l.date} | mood ${l.mood || "-"} | pain ${l.pain_level ?? "-"} | E ${l.energy_level ?? "-"}`,
      margin,
      y
    );
    y += 14;
    if (y > 760) {
      doc.addPage();
      y = margin;
    }
  });
  doc.save("flow-ai-export.pdf");
  showToast(t("toast_exported"));
}

function wireEvents() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      navigate(btn.getAttribute("data-page"))
    );
  });

  document.getElementById("btn-save-period")?.addEventListener("click", savePeriod);
  document.getElementById("btn-save-checkin")?.addEventListener("click", saveDailyLog);

  document.getElementById("log-mood-grid")?.addEventListener("click", (e) => {
    const b = e.target.closest(".mood-btn");
    if (b) selectMoodLog(b);
  });
  document.getElementById("flow-chips")?.addEventListener("click", (e) => {
    const c = e.target.closest(".chip");
    if (c) selectChip(c, "flow-chips");
  });
  document.getElementById("sleep-chips")?.addEventListener("click", (e) => {
    const c = e.target.closest(".chip");
    if (c) selectChip(c, "sleep-chips");
  });

  document.getElementById("pain-slider")?.addEventListener("input", (e) => {
    updateSlider(e.target);
  });
  document.getElementById("energy-slider")?.addEventListener("input", (e) => {
    updateEnergySlider(e.target);
  });
  document.getElementById("ai-pain-slider")?.addEventListener("input", (e) => {
    updateAISlider(e.target);
  });
  document.getElementById("ai-energy-slider")?.addEventListener("input", (e) => {
    updateAIEnergySlider(e.target);
  });

  document.getElementById("ai-mood-grid")?.addEventListener("click", (e) => {
    const b = e.target.closest(".mood-btn");
    if (b) selectAIMood(b);
  });
  document.getElementById("ai-submit-btn")?.addEventListener("click", getStaticAISuggestions);

  document.getElementById("btn-send-chat")?.addEventListener("click", () => {
    FlowChat.send(buildChatUserContext);
  });
  document.getElementById("chat-input")?.addEventListener("keydown", (e) => {
    FlowChat.handleKey(e, buildChatUserContext);
  });
  document.getElementById("btn-clear-chat")?.addEventListener("click", () => {
    FlowChat.clearHistoryUI();
  });

  document.getElementById("lang-select")?.addEventListener("change", (e) => {
    FlowI18n.setLang(e.target.value);
    applyTranslations();
    const page = document.querySelector(".page.active")?.id?.replace("page-", "");
    if (page) navigate(page);
    else renderDashboard();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("lang-select");
  if (sel) sel.value = FlowI18n.getLang();
  FlowI18n.setLang(FlowI18n.getLang());
  applyTranslations();

  const sd = document.getElementById("start-date");
  if (sd) {
    try {
      sd.valueAsDate = new Date();
    } catch (_) {}
  }

  updateSlider(document.getElementById("pain-slider"));
  updateEnergySlider(document.getElementById("energy-slider"));
  updateAISlider(document.getElementById("ai-pain-slider"));
  updateAIEnergySlider(document.getElementById("ai-energy-slider"));

  wireEvents();
  initChatShell();

  setInterval(runSmartNotifications, 60 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") runSmartNotifications();
  });

  renderDashboard();
});

async function initApp() {
  const sel = document.getElementById("lang-select");
  if (sel) sel.value = FlowI18n.getLang();
  FlowI18n.setLang(FlowI18n.getLang());
  applyTranslations();

  const sd = document.getElementById("start-date");
  if (sd) {
    try {
      sd.valueAsDate = new Date();
    } catch (_) {}
  }

  updateSlider(document.getElementById("pain-slider"));
  updateEnergySlider(document.getElementById("energy-slider"));
  updateAISlider(document.getElementById("ai-pain-slider"));
  updateAIEnergySlider(document.getElementById("ai-energy-slider"));

  wireEvents();
  initChatShell();

  setInterval(runSmartNotifications, 60 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") runSmartNotifications();
  });

  renderDashboard();
}

function wireAuthEvents() {
  const { login, register, googleLogin, logout } = window.FlowAuth;
  
  // Toggle login/register
  document.getElementById('login-btn')?.addEventListener('click', () => {
    document.getElementById('auth-form').dataset.mode = 'login';
    document.getElementById('auth-submit').textContent = 'Sign in';
    document.querySelectorAll('.auth-toggle').forEach(btn => btn.classList.remove('active'));
    document.getElementById('login-btn').classList.add('active');
  });

  document.getElementById('register-btn')?.addEventListener('click', () => {
    document.getElementById('auth-form').dataset.mode = 'register';
    document.getElementById('auth-submit').textContent = 'Create account';
    document.querySelectorAll('.auth-toggle').forEach(btn => btn.classList.remove('active'));
    document.getElementById('register-btn').classList.add('active');
  });

  // Form submit
  document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const mode = document.getElementById('auth-form').dataset.mode || 'login';
    const submitBtn = document.getElementById('auth-submit');
    const loadingEl = document.getElementById('auth-loading');
    const errorEl = document.getElementById('auth-error');

    try {
      loadingEl.classList.remove('visually-hidden');
      errorEl.textContent = '';

      let result;
      if (mode === 'login') {
        result = await login(email, password);
      } else {
        result = await register(email, password);
      }
      
      showToast(mode === 'login' ? 'Welcome back!' : 'Account created!');
    } catch (error) {
      errorEl.textContent = error.message.includes('auth/user-not-found') ? 'No account found' :
                           error.message.includes('auth/wrong-password') ? 'Wrong password' :
                           error.message.includes('auth/email-already') ? 'Email already in use' :
                           error.message || 'Authentication failed';
    } finally {
      loadingEl.classList.add('visually-hidden');
    }
  });

  // Google login
  document.getElementById('google-login')?.addEventListener('click', async () => {
    try {
      await googleLogin();
    } catch (error) {
      document.getElementById('auth-error').textContent = 'Google login failed';
    }
  });

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    try {
      await logout();
      showToast('Logged out');
    } catch (error) {
      showToast('Logout failed');
    }
  });
}
