/**
 * Flow — Chart.js analytics (cycle, mood, pain, energy)
 */
(function (global) {
  const charts = [];

  function destroyAll() {
    charts.forEach((c) => {
      try {
        c.destroy();
      } catch (_) {}
    });
    charts.length = 0;
  }

  function moodToNum(m) {
    const map = { Happy: 4, Sad: 1, Irritated: 2, Tired: 2 };
    return map[m] != null ? map[m] : 2;
  }

  function sleepToNum(s) {
    const map = { Poor: 1, Okay: 2, Good: 3, Great: 4 };
    return map[s] != null ? map[s] : 2;
  }

  function render(localData, locale) {
    destroyAll();
    const loc = locale || "en";
    const periods = [...(localData.periods || [])].sort(
      (a, b) => new Date(a.start_date) - new Date(b.start_date)
    );
    const lens = global.FlowPrediction
      ? global.FlowPrediction.getCycleLengths(periods)
      : [];
    const cycleLabels =
      periods.length > 1
        ? periods.slice(1).map((x) =>
            new Date(x.start_date).toLocaleDateString(loc, { month: "short" })
          )
        : [];
    let cLen = lens.slice(-8);
    let cLab = cycleLabels.slice(-8);

    const logs = [...(localData.daily_logs || [])].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
    const recent = logs.slice(-14);
    const logLabels = recent.map((l) =>
      new Date(l.date).toLocaleDateString(loc, { weekday: "narrow" })
    );
    const painData = recent.map((l) => l.pain_level || 0);
    const moodData = recent.map((l) => moodToNum(l.mood));
    const energyData = recent.map((l) =>
      l.energy_level != null ? Number(l.energy_level) : 5
    );
    const sleepData = recent.map((l) => sleepToNum(l.sleep_quality));

    const rose = "#E8667A";
    const roseLt = "#F2A3B0";
    const mint = "#2ecc71";
    const sky = "#3498db";
    const lilac = "#9b59b6";

    const commonOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { font: { family: "'DM Sans',sans-serif" } } } },
      scales: {
        x: {
          ticks: { font: { family: "'DM Sans',sans-serif" } },
          grid: { color: "rgba(232,102,122,0.06)" },
        },
        y: {
          beginAtZero: true,
          ticks: { font: { family: "'DM Sans',sans-serif" } },
          grid: { color: "rgba(232,102,122,0.06)" },
        },
      },
    };

    const mk = (id, config) => {
      const el = document.getElementById(id);
      if (!el || typeof Chart === "undefined") return;
      const ctx = el.getContext("2d");
      charts.push(new Chart(ctx, config));
    };

    mk("chart-cycle", {
      type: "bar",
      data: {
        labels: cLab.length ? cLab : ["—"],
        datasets: [
          {
            label: global.FlowI18n ? global.FlowI18n.t("chart_cycle") : "Cycle",
            data: cLen.length ? cLen : [0],
            backgroundColor: roseLt,
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        ...commonOpts,
        plugins: { ...commonOpts.plugins, legend: { display: false } },
      },
    });

    mk("chart-mood", {
      type: "line",
      data: {
        labels: logLabels.length ? logLabels : ["—"],
        datasets: [
          {
            label: global.FlowI18n ? global.FlowI18n.t("chart_mood") : "Mood",
            data: moodData.length ? moodData : [0],
            borderColor: mint,
            backgroundColor: "rgba(46,204,113,0.08)",
            fill: true,
            tension: 0.35,
            pointRadius: 4,
          },
        ],
      },
      options: commonOpts,
    });

    mk("chart-pain", {
      type: "line",
      data: {
        labels: logLabels.length ? logLabels : ["—"],
        datasets: [
          {
            label: global.FlowI18n ? global.FlowI18n.t("chart_pain") : "Pain",
            data: painData.length ? painData : [0],
            borderColor: rose,
            backgroundColor: "rgba(232,102,122,0.08)",
            fill: true,
            tension: 0.35,
            pointRadius: 4,
          },
        ],
      },
      options: commonOpts,
    });

    mk("chart-energy", {
      type: "line",
      data: {
        labels: logLabels.length ? logLabels : ["—"],
        datasets: [
          {
            label: global.FlowI18n ? global.FlowI18n.t("chart_energy") : "Energy",
            data: energyData.length ? energyData : [0],
            borderColor: sky,
            backgroundColor: "rgba(52,152,219,0.08)",
            fill: true,
            tension: 0.35,
            pointRadius: 4,
          },
          {
            label: "Sleep (1–4)",
            data: sleepData.length ? sleepData : [0],
            borderColor: lilac,
            borderDash: [4, 4],
            tension: 0.35,
            pointRadius: 2,
            fill: false,
          },
        ],
      },
      options: commonOpts,
    });
  }

  global.FlowAnalytics = { render, destroyAll };
})(typeof window !== "undefined" ? window : globalThis);
