const MIN_DATE = new Date("2011-03-05T00:00:00");
let currentRows = [];

const el = id => document.getElementById(id);

el("csvFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  const text = await file.text();
  currentRows = parseCsv(text);
  localStorage.setItem("lotteryLastCsvName", file.name);
  el("status").textContent = `Loaded ${file.name}. Press Analyze.`;
});

el("analyzeBtn").addEventListener("click", () => {
  try {
    if (!currentRows.length) throw new Error("Please load a CSV file first.");
    const data = normalizeRows(currentRows).filter(row => row.date >= MIN_DATE);
    if (!data.length) throw new Error("No current-format rows found from 05/03/2011 onward.");

    const result = analyze(data);
    render(result);
    el("status").textContent = "Analysis complete.";
  } catch (err) {
    el("status").textContent = `Error: ${err.message}`;
    alert(err.message);
  }
});

el("clearBtn").addEventListener("click", () => {
  currentRows = [];
  el("csvFile").value = "";
  localStorage.removeItem("lotteryLastCsvName");
  resetScreen();
  el("status").textContent = "Cleared. Load a CSV file to begin.";
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim().length);
  const rows = lines.map(parseCsvLine);
  const header = rows[0].map(x => x.trim());
  return rows.slice(1).map(values => {
    const obj = {};
    header.forEach((h, i) => obj[h] = (values[i] ?? "").trim());
    return obj;
  });
}

function parseCsvLine(line) {
  const result = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && insideQuotes && next === '"') {
      value += '"';
      i++;
    } else if (ch === '"') {
      insideQuotes = !insideQuotes;
    } else if (ch === "," && !insideQuotes) {
      result.push(value);
      value = "";
    } else {
      value += ch;
    }
  }

  result.push(value);
  return result;
}

function normalizeRows(rows) {
  const sample = rows[0] || {};
  const keys = Object.keys(sample).map(k => k.trim());
  const keyMap = new Map(Object.keys(sample).map(k => [k.trim(), k]));

  const findKey = aliases => {
    const found = aliases.find(a => keys.includes(a));
    return found ? keyMap.get(found) : null;
  };

  const cols = {
    drawId: findKey(["הגרלה", "מספר הגרלה", "a"]),
    date: findKey(["תאריך", "ב", "b"]),
    n1: findKey(["1", "c"]),
    n2: findKey(["2", "d"]),
    n3: findKey(["3", "e"]),
    n4: findKey(["4", "f"]),
    n5: findKey(["5", "g"]),
    n6: findKey(["6", "h"]),
    extra: findKey(["המספר החזק/נוסף", "מספר חזק", "נוסף", "extra", "i"])
  };

  const missing = Object.entries(cols).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`CSV structure not recognized. Missing: ${missing.join(", ")}`);

  return rows.map(row => ({
    drawId: Number(row[cols.drawId]),
    date: parseDate(row[cols.date]),
    n1: Number(row[cols.n1]),
    n2: Number(row[cols.n2]),
    n3: Number(row[cols.n3]),
    n4: Number(row[cols.n4]),
    n5: Number(row[cols.n5]),
    n6: Number(row[cols.n6]),
    extra: Number(row[cols.extra])
  })).filter(row =>
    row.date instanceof Date && !isNaN(row.date) &&
    [row.n1,row.n2,row.n3,row.n4,row.n5,row.n6,row.extra].every(Number.isFinite)
  ).sort((a,b) => a.date - b.date);
}

function parseDate(value) {
  const s = String(value).trim();
  const parts = s.split(/[./-]/).map(Number);
  if (parts.length === 3) {
    let [d, m, y] = parts;
    if (y < 100) y += y > 50 ? 1900 : 2000;
    return new Date(y, m - 1, d);
  }
  return new Date(s);
}

function analyze(data) {
  const latest = data[data.length - 1].date;
  const latestIndex = data.length;
  const regularEntries = [];
  const extraEntries = [];

  data.forEach((row, idx) => {
    const drawIndex = idx + 1;
    [row.n1,row.n2,row.n3,row.n4,row.n5,row.n6].forEach(n => {
      regularEntries.push({number:n, date:row.date, drawIndex});
    });
    extraEntries.push({number: row.extra, date: row.date, drawIndex});
  });

  const regularStats = makeStats(regularEntries, latest, latestIndex);
  const extraStats = makeStats(extraEntries, latest, latestIndex);

  const hot = [...regularStats].sort((a,b) => b.frequency - a.frequency || a.daysOverdue - b.daysOverdue);
  const cold = [...regularStats].sort((a,b) => b.daysOverdue - a.daysOverdue || b.frequency - a.frequency);
  const extraRank = [...extraStats].sort((a,b) => b.frequency - a.frequency || b.daysOverdue - a.daysOverdue);
  const gapRank = [...regularStats].sort((a,b) => b.gapRatio - a.gapRatio || b.currentGap - a.currentGap || b.frequency - a.frequency);
  const extraGapRank = [...extraStats].sort((a,b) => b.gapRatio - a.gapRatio || b.currentGap - a.currentGap || b.frequency - a.frequency);

  const popular = {
    regular: hot.slice(0, 6).map(x => x.number).sort((a,b) => a-b),
    extra: extraRank[0].number
  };

  const overdue = {
    regular: cold.slice(0, 6).map(x => x.number).sort((a,b) => a-b),
    extra: [...extraStats].sort((a,b) => b.daysOverdue - a.daysOverdue || b.frequency - a.frequency)[0].number
  };

  const balancedRegular = balancedRank(regularStats).slice(0, 6).map(x => x.number).sort((a,b) => a-b);
  const balancedExtra = balancedRank(extraStats)[0].number;

  return {
    count: data.length,
    latest,
    lastDraw: data[data.length - 1],
    popular,
    overdue,
    balanced: {regular: balancedRegular, extra: balancedExtra},
    gap: {
      regular: gapRank.slice(0, 6).map(x => x.number).sort((a,b) => a-b),
      extra: extraGapRank[0].number
    },
    hot: hot.slice(0, 10),
    cold: cold.slice(0, 10),
    gapStats: gapRank.slice(0, 10),
    probability: gapRank,
    extra: extraGapRank
  };
}

function makeStats(entries, latest, latestIndex) {
  const map = new Map();

  entries.forEach(({number, date, drawIndex}) => {
    if (!map.has(number)) map.set(number, {number, frequency: 0, lastSeen: date, appearances: []});
    const item = map.get(number);
    item.frequency++;
    item.appearances.push(drawIndex);
    if (date > item.lastSeen) item.lastSeen = date;
  });

  return [...map.values()].map(x => {
    const gaps = [];
    for (let i = 1; i < x.appearances.length; i++) gaps.push(x.appearances[i] - x.appearances[i - 1]);
    const avgGap = gaps.length ? avg(gaps) : latestIndex;
    const currentGap = latestIndex - x.appearances[x.appearances.length - 1];
    const gapRatio = avgGap > 0 ? currentGap / avgGap : 0;

    return {
      ...x,
      daysOverdue: Math.floor((latest - x.lastSeen) / (1000 * 60 * 60 * 24)),
      avgGap,
      currentGap,
      gapRatio
    };
  });
}

function balancedRank(stats) {
  const maxFreq = Math.max(...stats.map(x => x.frequency));
  const maxOverdue = Math.max(...stats.map(x => x.daysOverdue));
  return stats.map(x => ({
    ...x,
    score: ((x.frequency / maxFreq) * 0.55) + ((x.daysOverdue / maxOverdue) * 0.45)
  })).sort((a,b) => b.score - a.score || b.frequency - a.frequency || b.daysOverdue - a.daysOverdue);
}

function avg(values) {
  return values.reduce((a,b) => a+b, 0) / values.length;
}

function render(result) {
  el("drawCount").textContent = result.count;
  el("latestDate").textContent = formatDate(result.latest);
  el("lastExtra").textContent = two(result.lastDraw.extra);

  renderProposal("popularBalls", "popularExtra", result.popular);
  renderProposal("overdueBalls", "overdueExtra", result.overdue);
  renderProposal("balancedBalls", "balancedExtra", result.balanced);
  renderProposal("gapBalls", "gapExtra", result.gap);

  renderBalls("lastDrawBalls", [result.lastDraw.n1,result.lastDraw.n2,result.lastDraw.n3,result.lastDraw.n4,result.lastDraw.n5,result.lastDraw.n6]);
  el("lastDrawExtra").innerHTML = `Extra ${ball(result.lastDraw.extra)}`;
  el("lastDrawText").textContent = `Draw #${result.lastDraw.drawId} on ${formatDate(result.lastDraw.date)}`;

  fillSimpleTable("hotTable", result.hot);
  fillSimpleTable("coldTable", result.cold);
  fillGapTable("gapTable", result.gapStats);
  fillGapTable("probabilityTable", result.probability);
  fillGapTable("extraTable", result.extra);
}

function renderProposal(ballId, extraId, proposal) {
  renderBalls(ballId, proposal.regular);
  el(extraId).innerHTML = `Extra ${ball(proposal.extra)}`;
}

function renderBalls(id, numbers) {
  el(id).innerHTML = numbers.map(ball).join("");
}

function ball(n) {
  return `<span class="ball">${two(n)}</span>`;
}

function fillSimpleTable(id, rows) {
  el(id).innerHTML = rows.map(row => `
    <tr>
      <td>${two(row.number)}</td>
      <td>${row.frequency}</td>
      <td>${formatDate(row.lastSeen)}</td>
      <td>${row.daysOverdue}</td>
    </tr>
  `).join("");
}

function fillGapTable(id, rows) {
  el(id).innerHTML = rows.map(row => `
    <tr>
      <td>${two(row.number)}</td>
      <td>${row.frequency}</td>
      <td>${formatDate(row.lastSeen)}</td>
      <td>${row.daysOverdue}</td>
      <td>${row.avgGap.toFixed(2)}</td>
      <td>${row.currentGap}</td>
      <td>${row.gapRatio.toFixed(2)}</td>
    </tr>
  `).join("");
}

function resetScreen() {
  ["drawCount", "latestDate", "lastExtra"].forEach(id => el(id).textContent = "-");
  ["popularBalls", "popularExtra", "overdueBalls", "overdueExtra", "balancedBalls", "balancedExtra", "gapBalls", "gapExtra", "lastDrawBalls", "lastDrawExtra", "hotTable", "coldTable", "gapTable", "probabilityTable", "extraTable"].forEach(id => el(id).innerHTML = "");
  el("lastDrawText").textContent = "";
}

function two(n) {
  return String(Number(n)).padStart(2, "0");
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB").format(date);
}
