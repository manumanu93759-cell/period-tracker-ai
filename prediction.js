/**
 * Flow — cycle prediction engine (client-side, localStorage-fed data)
 * Weighted averages favor recent cycles; windows are educational estimates only.
 */
(function (global) {
  const DAY_MS = 86400000;

  function sortPeriodsAsc(periods) {
    return [...(periods || [])].sort(
      (a, b) => new Date(a.start_date) - new Date(b.start_date)
    );
  }

  function getCycleLengths(periods) {
    const s = sortPeriodsAsc(periods);
    if (s.length < 2) return [];
    const lens = [];
    for (let i = 1; i < s.length; i++) {
      const d = Math.round(
        (new Date(s[i].start_date) - new Date(s[i - 1].start_date)) / DAY_MS
      );
      if (d > 0 && d < 120) lens.push(d);
    }
    return lens;
  }

  /** Linear weights: oldest=1 … newest=n in the window (default last 6). */
  function weightedAverageCycleDays(lens, windowSize) {
    if (!lens.length) return { value: 28, used: [] };
    const take = lens.slice(-(windowSize || 6));
    let sumW = 0;
    let sum = 0;
    take.forEach((L, i) => {
      const w = i + 1;
      sum += L * w;
      sumW += w;
    });
    return { value: Math.round(sum / sumW), used: take };
  }

  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function stdevSample(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const v =
      arr.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (arr.length - 1);
    return Math.sqrt(v);
  }

  /** 0–1 scale: higher = more irregular (last up to 6 cycles). */
  function irregularityScore(lens) {
    if (lens.length < 2) return 0;
    const recent = lens.slice(-6);
    const m = mean(recent);
    if (m <= 0) return 0;
    const cv = stdevSample(recent) / m;
    return Math.min(1, cv / 0.25);
  }

  function irregularityLabel(score) {
    if (score < 0.25) return "stable";
    if (score < 0.45) return "moderate";
    return "high";
  }

  function avgPeriodDurationDays(periods) {
    const s = sortPeriodsAsc(periods);
    const durs = s
      .filter((p) => p.end_date)
      .map((p) => {
        const a = new Date(p.start_date);
        const b = new Date(p.end_date);
        return Math.floor((b - a) / DAY_MS) + 1;
      })
      .filter((d) => d > 0 && d <= 21);
    if (!durs.length) return { value: 5, count: 0 };
    return {
      value: Math.round(mean(durs)),
      count: durs.length,
    };
  }

  function lastPeriodStart(periods) {
    const s = sortPeriodsAsc(periods);
    if (!s.length) return null;
    const d = new Date(s[s.length - 1].start_date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, n) {
    const x = new Date(date.getTime());
    x.setDate(x.getDate() + n);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function predictNextPeriodStart(periods) {
    const last = lastPeriodStart(periods);
    if (!last) return null;
    const lens = getCycleLengths(periods);
    const { value: cycleDays } = weightedAverageCycleDays(lens, 6);
    return addDays(last, cycleDays);
  }

  /** Ovulation ~14 days before next expected period (approximation). */
  function predictOvulationDate(nextPeriodStart) {
    if (!nextPeriodStart) return null;
    return addDays(nextPeriodStart, -14);
  }

  function predictFertilityWindow(ovulationDate) {
    if (!ovulationDate) return null;
    return {
      start: addDays(ovulationDate, -5),
      peak: ovulationDate,
      end: addDays(ovulationDate, 1),
    };
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / DAY_MS);
  }

  function getPhaseFromData(periods) {
    if (!periods || !periods.length) return "unknown";
    const s = sortPeriodsAsc(periods);
    const last = s[s.length - 1];
    const start = new Date(last.start_date);
    start.setHours(0, 0, 0, 0);
    const end = last.end_date
      ? new Date(last.end_date)
      : addDays(start, avgPeriodDurationDays(periods).value - 1);
    end.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lens = getCycleLengths(periods);
    const { value: avgCycle } = weightedAverageCycleDays(lens, 6);
    const daysSinceStart = Math.floor((today - start) / DAY_MS);

    if (today >= start && today <= end) return "menstrual";
    if (daysSinceStart < 7) return "follicular";
    const ov = predictOvulationDate(predictNextPeriodStart(periods));
    if (ov) {
      const d = daysBetween(today, ov);
      if (d >= -2 && d <= 2) return "ovulation";
    }
    if (daysSinceStart >= avgCycle - 7) return "luteal";
    return "follicular";
  }

  /** Snapshot for UI / AI context */
  function computePredictionSnapshot(periods) {
    const lens = getCycleLengths(periods);
    const weighted = weightedAverageCycleDays(lens, 6);
    const avgLen = lens.length ? Math.round(mean(lens)) : null;
    const irScore = irregularityScore(lens);
    const periodDur = avgPeriodDurationDays(periods);
    const nextPeriod = predictNextPeriodStart(periods);
    const ovulation = predictOvulationDate(nextPeriod);
    const fertility = predictFertilityWindow(ovulation);

    return {
      cycleLengths: lens,
      averageCycleDays: avgLen,
      weightedCycleDays: weighted.value,
      irregularityScore: irScore,
      irregularityLevel: irregularityLabel(irScore),
      avgPeriodDurationDays: periodDur.value,
      periodSamples: periodDur.count,
      nextPeriodStart: nextPeriod,
      ovulationDate: ovulation,
      fertilityWindow: fertility,
      phase: getPhaseFromData(periods),
    };
  }

  global.FlowPrediction = {
    sortPeriodsAsc,
    getCycleLengths,
    weightedAverageCycleDays,
    irregularityScore,
    irregularityLabel,
    avgPeriodDurationDays,
    predictNextPeriodStart,
    predictOvulationDate,
    predictFertilityWindow,
    getPhaseFromData,
    computePredictionSnapshot,
    addDays,
    lastPeriodStart,
  };
})(typeof window !== "undefined" ? window : globalThis);
