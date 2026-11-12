"use strict";
const SHOW = 50, CSV_MAX = 5000, TIERS = ["", "A", "B", "C", "D", "X"];
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
let R, M, N, S, BV, BR, OFFS, BITS, PAT, OPEN, IK = new Map(), CAN = new Map(), NAME_LC, DOI_LC, PMC_LC, csvUrl = null;
let fpReady = null, exploreReady = null, EX = null;

async function gunzipFetch(url) {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) return buf.buffer;  // already decoded by the server
  const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(ds).arrayBuffer();
}

async function boot() {
  const [rd, metaBuf, bandBuf] = await Promise.all([
    initRDKitModule({locateFile: () => "RDKit_minimal.wasm"}),
    gunzipFetch("data/meta.json.gz"), gunzipFetch("data/bands.bin.gz")]);
  R = rd;
  M = JSON.parse(new TextDecoder().decode(metaBuf));
  N = M.id.length; S = M.sidx.length;
  const n = new Uint32Array(bandBuf, 0, 1)[0];
  BV = new Float32Array(bandBuf, 4, n); BR = new Int32Array(bandBuf, 4 + 4 * n, n);
  OPEN = M.lic.map((l) => M.lics[l] === "CC-BY" || M.lics[l] === "CC0");
  M.sidx.forEach((i, k) => {
    const ik = M.inchikey[i]; if (ik) (IK.get(ik) || IK.set(ik, []).get(ik)).push(i);
    const c = M.can[k]; if (c) (CAN.get(c) || CAN.set(c, []).get(c)).push(i);
  });
  $("lede").textContent = `${N.toLocaleString("en")} experimental infrared band lists from open literature`;
  $("summary").textContent = "";
  fpReady = Promise.all([gunzipFetch("data/morgan.bin.gz"), gunzipFetch("data/pattern.bin.gz")]).then(([mb, pb]) => {
    OFFS = new Uint32Array(mb, 0, S + 1); BITS = new Uint16Array(mb, 4 * (S + 1), OFFS[S]); PAT = new Uint8Array(pb);
  });
}

// ---------- rendering ----------
function molSvg(smi, hl) {
  if (!smi) return '<div class="nostruct">no structure</div>';
  const m = R.get_mol(smi); if (!m) return '<div class="nostruct">no structure</div>';
  let svg;
  try { svg = hl ? m.get_svg_with_highlights(JSON.stringify({...hl, width: 168, height: 120, clearBackground: false, bondLineWidth: 1}))
                 : m.get_svg_with_highlights(JSON.stringify({width: 168, height: 120, clearBackground: false, bondLineWidth: 1})); }
  finally { m.delete(); }
  return svg.replace(/<\?xml[^>]*\?>/, "");
}
function stickSvg(bands, hits) {
  const W = 420, H = 64, x = (b) => 10 + (4000 - b) / 3600 * (W - 20);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="stick"><line x1="10" y1="${H - 16}" x2="${W - 10}" y2="${H - 16}" class="axis"/>`;
  for (const t of [4000, 3000, 2000, 1000, 400]) s += `<text x="${x(t).toFixed(1)}" y="${H - 3}">${t}</text>`;
  for (const b of bands) if (b >= 400 && b <= 4000) {
    const hit = hits && hits.some((h) => Math.abs(h[0] - b) <= h[1]);
    s += `<line x1="${x(b).toFixed(1)}" y1="${H - 16}" x2="${x(b).toFixed(1)}" y2="6" class="${hit ? "hit" : "band"}"/>`;
  }
  return s + "</svg>";
}
function srcLink(i) {
  const d = M.doi[i], p = M.pmcid[i];
  if (d) return `<a href="https://doi.org/${esc(d)}" target="_blank" rel="noopener">doi:${esc(d)}</a>`;
  if (p) return `<a href="https://europepmc.org/article/PMC/${esc(p.slice(3))}" target="_blank" rel="noopener">${esc(p)}</a>`;
  return "";
}
function card(i, score, opt) {
  const bands = M.bands[i] ? M.bands[i].split(" ").map(Number) : [];
  const meta = [];
  if (M.formula[i]) meta.push(esc(M.formula[i]));
  meta.push(M.tier[i] ? `tier ${TIERS[M.tier[i]]}` : "no structure tier");
  meta.push(esc(M.lics[M.lic[i]]) + (M.nd[i] ? " · ND source" : ""));
  if (score) meta.push(esc(score));
  const name = M.name[i] ? esc(M.name[i]) : '<span class="dim">unnamed record</span>';
  return `<div class="card"><div class="mol">${molSvg(M.smiles[i], opt.hl && opt.hl(i))}</div><div class="info">
    <div class="name">${name}</div><div class="meta">${meta.join(" · ")}</div>
    <div class="src">${srcLink(i)}<span class="dim"> · ${esc(M.id[i])}</span></div>
    ${stickSvg(bands, opt.hits)}<div class="bandlist">${esc(M.bands[i])} cm⁻¹</div></div></div>`;
}
function show(idx, scores, note, opt = {}) {
  if ($("lic").dataset.v === "open") {
    const keep = idx.map((i, k) => OPEN[i] ? k : -1).filter((k) => k >= 0);
    idx = keep.map((k) => idx[k]); if (scores) scores = keep.map((k) => scores[k]);
  }
  $("summary").textContent = typeof note === "function" ? note(idx.length) : note;
  $("results").innerHTML = idx.slice(0, SHOW).map((i, k) => card(i, scores && scores[k], opt)).join("");
  if (csvUrl) URL.revokeObjectURL(csvUrl);
  $("csvline").hidden = idx.length === 0;
  if (!idx.length) return;
  const q = (v) => /[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v;
  const rows = [["id", "score", "name", "formula", "smiles", "inchikey", "ir_bands_cm-1", "structure_tier", "license", "nd_source_licence", "doi", "pmcid"].join(",")];
  idx.slice(0, CSV_MAX).forEach((i, k) => rows.push([M.id[i], scores ? scores[k] : "", M.name[i], M.formula[i], M.smiles[i], M.inchikey[i], M.bands[i],
    TIERS[M.tier[i]], M.lics[M.lic[i]], M.nd[i] ? "true" : "false", M.doi[i], M.pmcid[i]].map(q).join(",")));
  csvUrl = URL.createObjectURL(new Blob([rows.join("\n")], {type: "text/csv"}));
  $("csv").href = csvUrl; $("csv").download = "irexp_results.csv";
  $("csv").textContent = `Download ${Math.min(idx.length, CSV_MAX).toLocaleString("en")} results as CSV`;
}
const secs = (t) => `${((performance.now() - t) / 1000).toFixed(2)} s`;

// ---------- searches ----------
async function searchStructure() {
  const q = $("smiles").value.trim(), mode = $("mode").dataset.v, t = performance.now();
  if (!q) return show([], null, "Enter a SMILES string.");
  if (mode === "exact") {
    let hits = [];
    if (/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/.test(q)) hits = IK.get(q) || [];
    else {
      const m = R.get_mol(q); if (!m) return show([], null, "Could not parse SMILES.");
      let ik = ""; try { ik = R.get_inchikey_for_inchi(m.get_inchi()); } catch (e) {}
      hits = [...new Set([...(IK.get(ik) || []), ...(CAN.get(m.get_smiles()) || [])])]; m.delete();
    }
    return show(hits, null, (n) => `${n} exact matches · ${secs(t)}`);
  }
  $("summary").textContent = "Loading fingerprints…"; await fpReady;
  if (mode === "similarity") {
    const m = R.get_mol(q); if (!m) return show([], null, "Could not parse SMILES.");
    const fp = m.get_morgan_fp_as_uint8array(JSON.stringify({radius: 2, nBits: 2048})); m.delete();
    const qb = new Uint8Array(2048); let qc = 0;
    for (let b = 0; b < 2048; b++) if (fp[b >> 3] & (1 << (b & 7))) { qb[b] = 1; qc++; }
    const sim = new Float32Array(S);
    for (let k = 0; k < S; k++) {
      let inter = 0; const a = OFFS[k], e = OFFS[k + 1];
      for (let j = a; j < e; j++) inter += qb[BITS[j]];
      sim[k] = inter / (e - a + qc - inter || 1);
    }
    let ord = Array.from(sim.keys());
    if ($("lic").dataset.v === "open") ord = ord.filter((k) => OPEN[M.sidx[k]]);
    ord.sort((a, b) => sim[b] - sim[a]); ord = ord.slice(0, SHOW);
    return show(ord.map((k) => M.sidx[k]), ord.map((k) => `Tanimoto ${sim[k].toFixed(2)}`),
      (n) => `Top ${n} by Morgan (r = 2, 2048 bits) Tanimoto among ${S.toLocaleString("en")} structures · ${secs(t)}`);
  }
  let qm = R.get_mol(q); if (!qm) qm = R.get_qmol(q);
  if (!qm) return show([], null, "Could not parse SMILES or SMARTS.");
  const qp = qm.get_pattern_fp_as_uint8array(JSON.stringify({nBits: 2048}));
  const nz = []; for (let j = 0; j < 256; j++) if (qp[j]) nz.push(j);
  const cand = [];
  for (let k = 0; k < S; k++) { let ok = true, o = k * 256; for (const j of nz) if ((PAT[o + j] & qp[j]) !== qp[j]) { ok = false; break; } if (ok) cand.push(k); }
  const hits = [], match = new Map(), openOnly = $("lic").dataset.v === "open";
  let stopped = false;
  for (let c = 0; c < cand.length; c++) {
    const i = M.sidx[cand[c]]; if (openOnly && !OPEN[i]) continue;
    const m = R.get_mol(M.smiles[i]);
    if (m) { const r = m.get_substruct_match(qm); m.delete(); if (r !== "{}") { hits.push(i); if (hits.length <= SHOW) match.set(i, JSON.parse(r)); } }
    if (hits.length >= CSV_MAX || performance.now() - t > 20000) { stopped = c < cand.length - 1; break; }
    if (c % 400 === 399) { $("summary").textContent = `Matching… ${c + 1} of ${cand.length.toLocaleString("en")} screened`; await new Promise((r) => setTimeout(r)); }
  }
  qm.delete();
  show(hits, null, (n) => `${stopped ? "First " : ""}${n.toLocaleString("en")} substructure matches (${cand.length.toLocaleString("en")} candidates after screening) · ${secs(t)}`,
       {hl: (i) => match.get(i)});
}

function searchBands() {
  const t = performance.now(), tol = +$("tol").value;
  const vals = $("bands").value.split(/[\s,;]+/).filter(Boolean).map(Number);
  if (!vals.length || vals.some(isNaN)) return show([], null, "Enter wavenumbers as numbers, e.g. 1715, 1600.");
  const lb = (x) => { let lo = 0, hi = BV.length; while (lo < hi) { const m = (lo + hi) >> 1; if (BV[m] < x) lo = m + 1; else hi = m; } return lo; };
  let acc = null;
  for (const v of vals) {
    const cur = new Map();
    for (let j = lb(v - tol), e = lb(v + tol + 1e-4); j < e; j++) {
      const r = BR[j], d = Math.abs(BV[j] - v); if (!cur.has(r) || d < cur.get(r)) cur.set(r, d);
    }
    if (acc === null) acc = cur;
    else { const nxt = new Map(); for (const [r, d] of cur) if (acc.has(r)) nxt.set(r, acc.get(r) + d); acc = nxt; }
  }
  const idx = [...acc.keys()].sort((a, b) => acc.get(a) - acc.get(b) || a - b);
  show(idx, idx.map((i) => `mean Δ ${(acc.get(i) / vals.length).toFixed(1)} cm⁻¹`),
    (n) => `${n.toLocaleString("en")} records contain all ${vals.length} bands within ±${tol} cm⁻¹ · sorted by mean deviation · ${secs(t)}`,
    {hits: vals.map((v) => [v, tol])});
}

function searchText() {
  const t = performance.now(), raw = $("text").value.trim();
  if (!raw) return show([], null, "Enter a DOI, PMCID, or name.");
  let idx = [];
  if ($("field").dataset.v === "source") {
    DOI_LC ||= M.doi.map((s) => s.toLowerCase()); PMC_LC ||= M.pmcid.map((s) => s.toLowerCase());
    let q = raw.toLowerCase().replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, "").replace(/^doi:/, "");
    if (/^(pmc)?\d+$/.test(q)) { if (!q.startsWith("pmc")) q = "pmc" + q; for (let i = 0; i < N; i++) if (PMC_LC[i] === q) idx.push(i); }
    else { for (let i = 0; i < N; i++) if (DOI_LC[i] === q) idx.push(i);
           if (!idx.length && q.length >= 4) for (let i = 0; i < N; i++) if (DOI_LC[i].includes(q)) idx.push(i); }
  } else {
    NAME_LC ||= M.name.map((s) => s.toLowerCase()); const q = raw.toLowerCase();
    for (let i = 0; i < N; i++) if (NAME_LC[i].includes(q)) idx.push(i);
  }
  show(idx, null, (n) => `${n.toLocaleString("en")} records · ${secs(t)}`);
}


// ---------- explore ----------
function fmt(n) { return n.toLocaleString("en"); }
function loadExplore() {
  if (exploreReady) return exploreReady;
  exploreReady = fetch("data/explore.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((d) => { EX = d; });
  return exploreReady;
}
function niceMax(n) {
  const p = 10 ** Math.floor(Math.log10(n || 1));
  return Math.ceil((n || 1) / p) * p;
}
function barChart(vals, xticks, {rtl = false, w = 420, h = 130, left = 28, bottom = 18} = {}) {
  const top = 6, right = 6, iw = w - left - right, ih = h - top - bottom;
  const ymax = niceMax(Math.max(...vals, 1)), bw = iw / vals.length;
  const x = (i) => rtl ? left + iw - (i + 1) * bw : left + i * bw;
  const y = (v) => top + ih - (v / ymax) * ih;
  const yticks = [0, ymax / 2, ymax];
  const ylab = (v) => v >= 1000 ? `${v / 1000}k` : String(v);
  let s = `<svg viewBox="0 0 ${w} ${h}">`;
  s += `<line x1="${left}" y1="${top + ih}" x2="${w - right}" y2="${top + ih}" class="axis"/>`;
  for (const v of yticks) {
    const yy = y(v).toFixed(1);
    s += `<text x="${left - 4}" y="${yy}" text-anchor="end" dominant-baseline="middle">${ylab(v)}</text>`;
  }
  for (let i = 0; i < vals.length; i++) {
    const bh = (vals[i] / ymax) * ih;
    if (bh <= 0) continue;
    s += `<rect class="bar" x="${x(i).toFixed(2)}" y="${(top + ih - bh).toFixed(2)}" width="${Math.max(bw - 0.4, 0.4).toFixed(2)}" height="${bh.toFixed(2)}"/>`;
  }
  for (const [pos, label] of xticks) {
    const xx = (rtl ? left + iw - pos * bw : left + pos * bw).toFixed(1);
    s += `<text x="${xx}" y="${h - 3}" text-anchor="middle">${label}</text>`;
  }
  return s + "</svg>";
}
function renderExplore() {
  if (!EX) return;
  $("overview").textContent = `${fmt(EX.records)} records · ${fmt(EX.articles)} articles · ${fmt(EX.structures)} with a resolved structure`;
  const bc = EX.band_count, wn = EX.wavenumber;
  const counts = bc.counts.concat([bc.tail]);
  const bcTicks = [[2.5, "5"], [7.5, "10"], [17.5, "20"], [27.5, "30"], [37.5, "40"], [counts.length - 0.5, "41+"]];
  const nbin = wn.counts.length;
  const wnCounts = wn.counts.slice().reverse();
  const wnTicks = [4000, 3000, 2000, 1000, 400].map((nu) => [(wn.hi - nu) / (wn.hi - wn.lo) * nbin, String(nu)]);
  $("charts").innerHTML = `
    <div class="chart"><h2>Bands per record</h2>${barChart(counts, bcTicks)}</div>
    <div class="chart"><h2>Band positions (cm⁻¹)</h2>${barChart(wnCounts, wnTicks)}</div>`;
}
function randomRecord() {
  let pool = M.sidx;
  if ($("lic").dataset.v === "open") pool = pool.filter((i) => OPEN[i]);
  if (!pool.length) return show([], null, "No structure-linked records in this licence filter.");
  const i = pool[Math.floor(Math.random() * pool.length)];
  show([i], null, "Random record");
  $("results").querySelector(".card")?.scrollIntoView({block: "nearest", behavior: "smooth"});
}

// ---------- wiring ----------
function toggle(id) { const el = $(id); el.dataset.v = el.querySelector("a.on").dataset.v;
  el.addEventListener("click", (e) => { const a = e.target.closest("a"); if (!a) return;
    el.querySelectorAll("a").forEach((x) => x.classList.toggle("on", x === a)); el.dataset.v = a.dataset.v; }); }
["mode", "field", "lic"].forEach(toggle);
document.querySelectorAll(".tabs a").forEach((a) => a.addEventListener("click", () => {
  document.querySelectorAll(".tabs a").forEach((x) => x.classList.toggle("on", x === a));
  document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("on", p.id === "tab-" + a.dataset.tab));
  if (a.dataset.tab === "explore") loadExplore().then(renderExplore).catch((e) => { $("overview").textContent = "Could not load overview: " + e.message; });
}));
document.querySelectorAll("[data-smi]").forEach((a) => a.addEventListener("click", () => { $("smiles").value = a.dataset.smi; }));
$("tol").addEventListener("input", () => { $("tolv").textContent = $("tol").value; });
const guard = (f) => async () => { if (!M) return; try { await f(); } catch (e) { $("summary").textContent = "Search failed: " + e.message; } };
$("go-structure").onclick = guard(searchStructure); $("go-bands").onclick = guard(searchBands); $("go-text").onclick = guard(searchText);
[["smiles", searchStructure], ["bands", searchBands], ["text", searchText]].forEach(([id, f]) =>
  $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") guard(f)(); }));
window.jsmeOnLoad = function () {
  window.jsme = new JSApplet.JSME("jsme", "100%", "240px", {options: "oldlook,nocanonize,zoom"});
  jsme.setAfterStructureModifiedCallback(() => { const s = jsme.smiles(); if (s) $("smiles").value = s; });
};
$("clear-drawing").onclick = () => { if (window.jsme) jsme.reset(); };
$("random").onclick = guard(randomRecord);
boot().catch((e) => { $("summary").textContent = "Could not load data: " + e.message; });
