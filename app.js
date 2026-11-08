/* Domy i mieszkańcy: strona statyczna czytająca dane z katalogu data/.
   Dane: data/wsie.json, data/okresy.json, data/zrodla.json, data/wydarzenia.json,
   data/stan-rocznikow.csv oraz akty.csv i osoby.csv w katalogu każdego źródła. */
"use strict";

/* ===================== STAŁE ===================== */
const RITE = { rz: "rzymskokatolicki", gk: "greckokatolicki" };
const RITE_SHORT = { rz: "rz.-kat.", gk: "gr.-kat." };
const KIND = { U: "Urodzenie / chrzest", M: "Małżeństwo", Z: "Zgon" };
const KIND_SHORT = { U: "Urodzenia", M: "Małżeństwa", Z: "Zgony" };
const ROLE = { dziecko: "dziecko", ojciec: "ojciec", matka: "matka", chrzestny: "chrzestny", chrzestna: "chrzestna", swiadek: "świadek", zmarly: "zmarły", zmarla: "zmarła", pan_mlody: "pan młody", panna_mloda: "panna młoda", dziadek_matki: "ojciec matki", maz_chrzestnej: "mąż chrzestnej", akuszerka: "akuszerka", kaplan: "kapłan", inna: "inna", rodzic_pana_mlodego: "rodzic pana młodego", rodzic_panny_mlodej: "rodzic panny młodej" };
const STATE = {
  opracowany: "Opracowany", w_opracowaniu: "W opracowaniu", skany_calosc: "Skany do opracowania",
  skany_czesc: "Skany częściowe", katalog: "Znany z katalogu", brak_ustalen: "Źródła nie ustalono",
};
const STATE_ORDER = ["opracowany", "w_opracowaniu", "skany_calosc", "skany_czesc", "katalog", "brak_ustalen"];
const MAIN_ROLES = ["dziecko", "zmarly", "zmarla", "pan_mlody", "panna_mloda"];
/* rola osoby -> rola rodzica, od którego można wyprowadzić brakujące nazwisko */
const PARENT = { dziecko: "ojciec", zmarly: "ojciec", zmarla: "ojciec", pan_mlody: "rodzic_pana_mlodego", panna_mloda: "rodzic_panny_mlodej" };

let VILLAGES = [], PARTS = [], PERIODS = [], SOURCES = {}, EVENTS = [], YEAR_RULES = [], ACTS = [], VARIANTS = {};
const WARN = [];

/* ===================== NARZĘDZIA ===================== */
const DATA = "data/";
const CYR = { а:"a",б:"b",в:"w",г:"h",ґ:"g",д:"d",е:"e",є:"je",ж:"z",з:"z",и:"y",і:"i",ї:"ji",й:"j",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"ch",ц:"c",ч:"cz",ш:"sz",щ:"szcz",ь:"",ю:"ju",я:"ja" };
function norm(s) {
  return (s || "").toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[а-яіїєґ]/g, c => CYR[c] ?? c).replace(/[\s'’\-…]/g, "");
}
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const unescapeHtml = s => { const t = document.createElement("textarea"); t.innerHTML = s || ""; return t.value; };
const year = a => +a.date.slice(0, 4);
/* wpisy z księgi 1724–1766 podają samo „Płaucza” (bez rozróżnienia Małej i Wielkiej) albo „Nowa Płaucza”; pokazywane są w Małej i Wielkiej z oznaczeniem */
const SHARED = { "pl-nieustalona": "Płaucza (bez rozróżnienia Małej i Wielkiej)", "pl-nowa": "Nowa Płaucza (do ustalenia)" };
const inV = (a, v) => a.v === v || (!!SHARED[a.v] && (v === "pm" || v === "pw"));
const vName = id => VILLAGES.find(v => v.id === id)?.name || SHARED[id] || id;
const MONTHS = ["", "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const fmtDate = d => {
  const [y, mo, da] = d.split("-");
  if (da) return `${+da} ${MONTHS[+mo]} ${y}`;
  if (mo) return `${MONTHS[+mo]} ${y}`;
  return `${y} (bez dokładnej daty)`;
};
const exactDate = e => /^\d{4}-\d{2}-\d{2}$/.test(e.date);
const pkey = p => p.from + "-" + p.to;
/* „Wszystkie lata”: domyślny widok domów, zbiera wszystkie opracowane roczniki naraz */
const ALL_KEY = "wszystkie";
const ALL_PERIOD = { from: 1700, to: 1945, title: "Wszystkie opracowane lata", desc: {}, all: true };
const findPeriod = k => k === ALL_KEY ? ALL_PERIOD : PERIODS.find(p => pkey(p) === k);
const keyOf = p => p.all ? ALL_KEY : pkey(p);
const periodDesc = (p, v) => p.desc[v] || p.desc["*"] || "";
const listYears = ys => [...new Set(ys)].sort((a, b) => a - b).join(", ");
const hasHouse = p => p.miesz && p.dom != null;
const dayDiff = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;

/* CSV zgodny z RFC 4180: cudzysłowy, przecinki i nowe linie w polach */
function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f); f = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = [];
    } else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift() || [];
  return rows.map((r, n) => {
    if (r.length !== head.length) WARN.push(`wiersz ${n + 2}: ${r.length} kolumn zamiast ${head.length}`);
    return Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()]));
  });
}
async function getText(path) {
  const r = await fetch(DATA + path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.text();
}
const getJSON = async path => JSON.parse(await getText(path));
const getCSV = async path => parseCSV(await getText(path));

/* ===================== WCZYTANIE DANYCH ===================== */
function roleOf(r) {
  if (r.rola !== "inna") return r.rola;
  const u = r.uwagi.toLowerCase();
  if (u.includes("ojciec matki")) return "dziadek_matki";
  if (u.includes("mąż chrzestnej") || /mąż [^,.]+, chrzestnej/.test(u)) return "maz_chrzestnej";
  return "inna";
}

function buildActs(src, akty, osoby) {
  const ourVillages = new Set(VILLAGES.map(v => v.id));
  const by = new Map();
  for (const r of osoby) { if (!by.has(r.akt)) by.set(r.akt, []); by.get(r.akt).push(r); }
  const out = [];
  for (const a of akty) {
    let v = a.wies, note = unescapeHtml(a.uwagi_odczytu);
    if (!v) {
      v = src.wies_domyslna || "";
      note = `Uwaga: wieś aktu nie jest określona w odczycie; przypisano do sekcji księgi (${vName(v)}). ` + note;
    }
    const m = (a.uwagi_odczytu || "").match(/\d{4}-\d{2}-\d{2}/);
    if (m && m[0] !== a.data) {
      const diff = dayDiff(a.data, m[0]);
      if (!(diff > 0 && diff <= 3)) note = `Niezgodność dat w odczycie: w danych ${a.data}, w uwagach ${m[0]}. Do sprawdzenia na skanie. ` + note;
    }
    const rows = (by.get(a.id) || []).sort((x, y) => +x.lp - +y.lp);
    const people = rows.map(r => {
      const role = roleOf(r);
      const p = {
        imie: r.imie, nazw: r.nazwisko, rola: role,
        dom: /^\d+$/.test(r.dom) ? +r.dom : null, domSrc: r.dom_zrodlowy,
        miesz: r.mieszkaniec === "tak", pn: r.pewnosc_nazwiska || "pewny", pd: r.pewnosc_domu || "pewny",
        pan: r.nazwisko_panienskie, note: unescapeHtml(r.uwagi), wies: r.wies_zamieszkania,
      };
      if (p.miesz && p.wies && !ourVillages.has(p.wies)) {
        p.miesz = false; /* numer domu dotyczy innej miejscowości */
        p.note = (p.note ? p.note + " " : "") + `Zamieszkała w miejscowości „${p.wies}”, numer domu dotyczy tej miejscowości.`;
      }
      /* rola już mówi „ojciec matki” / „mąż chrzestnej”; reszta uwagi (np. forma łacińska imienia) zostaje */
      if (role === "dziadek_matki" || role === "maz_chrzestnej") p.note = p.note.replace(/(ojciec matki|mąż chrzestnej)\.?\s*/i, "").trim();
      return p;
    });
    /* nazwiska wyprowadzone z nazwiska rodzica (oznaczone, nie są odczytem) */
    for (const p of people) {
      const pr = PARENT[p.rola];
      if (pr && !p.nazw) {
        const rod = people.find(x => x.rola === pr && x.nazw);
        if (rod) { p.nazw = rod.nazw; p.der = true; if (rod.pn !== "pewny") p.pn = rod.pn; }
      }
      if (p.rola === "matka" && !p.pan) {
        const dz = people.find(x => x.rola === "dziadek_matki" && x.nazw);
        if (dz) { p.pan = dz.nazw; p.panDer = true; }
      }
    }
    out.push({
      id: a.id, v, date: a.data, rite: src.obrzadek, kind: a.rodzaj, src: src.id, nr: a.nr_aktu,
      page: a.strona, scan: a.link_skan, event: a.zdarzenie, note, unverified: src.odczyt_ai !== false, people,
    });
  }
  return out;
}

async function loadAll() {
  const [wsie, okresy, zrodla, wyd, stan] = await Promise.all([
    getJSON("wsie.json"), getJSON("okresy.json"), getJSON("zrodla.json"), getJSON("wydarzenia.json"), getCSV("stan-rocznikow.csv"),
  ]);
  VILLAGES = wsie.map(w => ({ id: w.id, name: w.nazwa, variants: w.warianty || [], desc: w.opis || "", history: w.historia || [] }));
  PARTS = okresy.map(c => ({ label: c.etykieta, periods: c.okresy.map(o => ({ from: o.od, to: o.do, title: o.tytul, desc: o.opis || {} })) }));
  PERIODS = PARTS.flatMap(p => p.periods);
  for (const z of zrodla) SOURCES[z.id] = z;
  EVENTS = wyd.map(e => ({ id: e.id, v: e.wies, title: e.tytul, date: e.data, dateNote: e.uwaga_daty || "", desc: e.opis || "", quotes: e.cytaty || [], sources: e.zrodla || [], houses: e.domy || [], before: e.przed, after: e.po }));
  YEAR_RULES = stan.map(r => [r.wies, r.obrzadek, +r.od, +r.do, r.stan]);
  try { VARIANTS = await getJSON("warianty-nazwisk.json"); } catch { VARIANTS = {}; }
  const sets = await Promise.all(zrodla.filter(z => z.katalog_danych).map(async z => {
    const [akty, osoby] = await Promise.all([getCSV(z.katalog_danych + "/akty.csv"), getCSV(z.katalog_danych + "/osoby.csv")]);
    return buildActs(z, akty, osoby);
  }));
  ACTS = sets.flat();
  if (WARN.length) console.warn("Ostrzeżenia danych:", WARN);
}

/* ===================== STAN ROCZNIKÓW ===================== */
function yearState(v, rite, y) {
  let s = "brak_ustalen";
  for (const [rv, rr, a, b, st] of YEAR_RULES) if (rv === v && rr === rite && y >= a && y <= b) s = st;
  return s;
}
function stateSummary(v, from, to, rite) {
  const c = {};
  for (const r of rite ? [rite] : ["rz", "gk"]) for (let y = from; y <= to; y++) (c[yearState(v, r, y)] ||= []).push([y, r]);
  return c;
}
function compressYears(items) {
  const by = {};
  for (const [y, r] of items) (by[r] ||= []).push(y);
  return Object.entries(by).map(([r, ys]) => {
    const out = []; let s = ys[0], prev = ys[0];
    for (const y of ys.slice(1).concat(Infinity)) { if (y !== prev + 1) { out.push(s === prev ? `${s}` : `${s}–${prev}`); s = y; } prev = y; }
    return `${out.join(", ")} (${RITE_SHORT[r]})`;
  }).join("; ");
}

/* ===================== STAN / ADRES STRONY ===================== */
/* Stan widoku jest zapisany w adresie (#w=pm&o=1809-1835...), więc działa przycisk „wstecz” i można wysłać link. */
let S = {};
let navCount = 0;
let pendingScroll = null;
function readHash() {
  const p = new URLSearchParams(location.hash.replace(/^#\/?/, ""));
  const s = Object.fromEntries(p.entries());
  if (!VILLAGES.some(v => v.id === s.w)) s.w = VILLAGES[0]?.id;
  s.v ||= "wies"; s.t ||= "domy";
  if (!s.o || !findPeriod(s.o)) s.o = defaultPeriod(s.w);
  return s;
}
function hashOf(s) {
  const c = {};
  for (const [k, v] of Object.entries(s)) if (v !== "" && v != null) c[k] = v;
  return "#" + new URLSearchParams(c).toString();
}
function go(patch, replace = false) {
  const n = { ...S, ...patch };
  const h = hashOf(n);
  if (replace || h === location.hash) { history.replaceState(null, "", h); route(); }
  else { navCount++; location.hash = h; }
}
function goBack() { if (navCount > 0) { navCount--; history.back(); } else go({ v: "wies", d: "", a: "", e: "", q: "" }); }
function defaultPeriod() {
  /* domyślnie wszystkie lata naraz; okresy na osi czasu działają jak opcjonalny filtr */
  return ALL_KEY;
}
const dataYears = v => [...new Set(ACTS.filter(a => inV(a, v)).map(year))].sort((a, b) => a - b);
const periodLabel = p => p.all ? "wszystkie lata" : `${p.from}–${p.to}`;

/* ===================== FILTRY I INDEKSY ===================== */
function actsIn(v, from, to, f = {}) {
  return ACTS.filter(a => inV(a, v) && year(a) >= from && year(a) <= to
    && (!f.r || year(a) === +f.r) && (!f.ob || a.rite === f.ob) && (!f.rd || a.kind === f.rd))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function housesFrom(acts) {
  const map = new Map(), noHouse = [];
  for (const a of acts) {
    let any = false;
    for (const p of a.people) if (hasHouse(p)) {
      any = true;
      if (!map.has(p.dom)) map.set(p.dom, []);
      map.get(p.dom).push({ a, p });
    }
    if (!any) noHouse.push(a);
  }
  return { houses: [...map.entries()].sort((x, y) => x[0] - y[0]), noHouse };
}
const variantOf = () => {
  const m = {};
  for (const [g, list] of Object.entries(VARIANTS)) for (const n of list) m[norm(n)] = g;
  return m;
};
let VAR = {};
const stem = n => n.replace(/(owna|owa)$/, "").replace(/ska$/, "ski");
function namesForHouse(rows, collapse) {
  if (collapse) {
    const g = new Map();
    const named = rows.filter(r => r.p.nazw);
    if (!named.length) return [{ name: "Nazwisko nie podane w akcie", years: listYears(rows.map(r => year(r.a))), flag: false }];
    for (const { a, p } of named) {
      const key = VAR[norm(p.nazw)] || stem(norm(p.nazw));
      if (!g.has(key)) g.set(key, { names: new Set(), years: [], flag: false });
      const e = g.get(key); e.names.add(p.nazw); e.years.push(year(a)); if (p.pn !== "pewny" || p.pd !== "pewny") e.flag = true;
    }
    return [...g.values()].map(e => ({ name: [...e.names].join(" / "), years: listYears(e.years), flag: e.flag }));
  }
  return rows.map(({ a, p }) => ({ name: `${p.imie} ${p.nazw}`.trim(), role: ROLE[p.rola], years: String(year(a)), flag: p.pn !== "pewny" || p.pd !== "pewny" }));
}

/* ===================== WIDOKI ===================== */
const app = document.getElementById("app");
const stateChip = s => `<span class="chip s-${s}">${STATE[s]}</span>`;
const periodHasData = (v, p) => ACTS.some(a => inV(a, v) && year(a) >= p.from && year(a) <= p.to);
const aiNote = `<div class="note small"><b>Odczyt AI, do sprawdzenia.</b> Wpisy pochodzą z odczytu skanów wykonanego przez AI i nie zostały jeszcze porównane ze skanem. Oznaczenia „niepewny” i „nieczytelny” pochodzą z odczytu.</div>`;

function villageStats(v) {
  const acts = ACTS.filter(a => inV(a, v));
  const houses = new Set(acts.flatMap(a => a.people.filter(hasHouse).map(p => p.dom)));
  const names = new Set(acts.flatMap(a => a.people.map(p => norm(p.nazw))).filter(Boolean));
  return { houses: houses.size, names: names.size, acts: acts.length };
}
function descBlock(d) {
  const i = d.indexOf(". ");
  if (i < 0) return `<p class="lead">${esc(d)}</p>`;
  return `<p class="lead">${esc(d.slice(0, i + 1))}</p><details class="more"><summary>Więcej o wsi</summary><p class="small muted">${esc(d.slice(i + 2))}</p></details>`;
}
function viewVillage() {
  const v = VILLAGES.find(x => x.id === S.w);
  const tab = S.t, st = villageStats(v.id);
  let h = `<section class="hero"><p class="eyebrow">Wieś</p><h2>${esc(v.name)}</h2>${descBlock(v.desc)}
    <p class="stats-line"><b>${st.houses}</b> domów · <b>${st.names}</b> nazwisk · <b>${st.acts}</b> wpisów</p></section>
  <div class="tabs" role="tablist">
    ${[["domy", "Domy"], ["historia", "Historia wsi"], ["zrodla", "Źródła"]].map(([k, l]) =>
      `<button role="tab" aria-selected="${tab === k}" data-tab="${k}">${l}</button>`).join("")}
  </div>`;
  if (tab === "zrodla") return h + viewSources(v.id);
  h += timeline(v.id);
  if (tab === "historia") return h + viewHistory(v.id);
  return h + periodPanel(v.id, findPeriod(S.o));
}

function timeline(v) {
  const cur = findPeriod(S.o);
  const openPart = PARTS.findIndex(pt => pt.periods.some(p => pkey(p) === S.o));
  let h = `<details class="tl"><summary><span class="tl-ico" aria-hidden="true">◷</span>
    <span class="tl-main"><small>Okres</small><strong>${cur.all ? "Wszystkie lata" : `${cur.from}–${cur.to}`}</strong><span>${esc(cur.all ? yearsText(v) : cur.title)}</span></span><span class="tl-change">${cur.all ? "Wybierz okres" : "Zmień okres"}</span></summary>
    <div class="tl-body"><button class="period all-years" aria-pressed="${!!cur.all}" data-period="${ALL_KEY}"><span class="row"><strong>Wszystkie lata</strong><span class="small">● ${esc(yearsText(v))}</span></span><span>Wszystkie domy i wpisy ze wszystkich opracowanych źródeł naraz</span></button>
    <p class="small muted" style="margin:10px 2px 4px">Albo zawęź do jednego okresu:</p><div class="timeline" aria-label="Oś czasu">`;
  PARTS.forEach((pt, i) => {
    const cnt = pt.periods.filter(p => periodHasData(v, p)).length;
    h += `<details ${i === openPart ? "open" : ""}><summary><span><span class="yrs">${pt.label}</span><br>
      <span class="muted small">${cnt ? cnt + " z " + pt.periods.length + " okresów ma wpisy" : "brak opracowanych wpisów"}</span></span></summary><ol>`;
    for (const p of pt.periods) {
      const evLi = e => `<li class="event"><button class="evt" data-event="${e.id}"><span class="lbl">◆ Wydarzenie</span><br><strong>${esc(e.title)}</strong><br><span class="muted small">${esc(exactDate(e) ? fmtDate(e.date) : e.dateNote || e.date)}</span></button></li>`;
      const evIn = EVENTS.filter(e => e.v === v && +e.date.slice(0, 4) >= p.from && +e.date.slice(0, 4) <= p.to).sort((a, b) => a.date.localeCompare(b.date));
      /* wydarzenie z pierwszego roku okresu stoi przed okresem (otwiera go), pozostałe po nim */
      for (const e of evIn.filter(e => +e.date.slice(0, 4) === p.from)) h += evLi(e);
      const has = periodHasData(v, p);
      h += `<li class="${has ? "has" : ""}"><button class="period" aria-pressed="${S.o === pkey(p)}" data-period="${pkey(p)}">
        <span class="row"><strong>${p.from}–${p.to}</strong><span class="small ${has ? "" : "muted"}">${has ? "● opracowane wpisy" : "○ brak opracowanych"}</span></span>
        <span>${esc(p.title)}</span>${periodDesc(p, v) ? `<span class="desc">${esc(periodDesc(p, v))}</span>` : ""}</button></li>`;
      for (const e of evIn.filter(e => +e.date.slice(0, 4) !== p.from)) h += evLi(e);
    }
    h += `</ol></details>`;
  });
  return h + `</div><div class="legend"><span class="l-has">okres z opracowanymi wpisami</span><span>okres bez wpisów</span><span class="l-evt">wydarzenie</span></div></div></details>`;
}

function yearsText(v) {
  const ys = dataYears(v);
  if (!ys.length) return "brak opracowanych wpisów";
  const out = []; let a = ys[0], prev = ys[0];
  for (const y of ys.slice(1).concat(Infinity)) { if (y !== prev + 1) { out.push(a === prev ? `${a}` : `${a}–${prev}`); a = y; } prev = y; }
  return "opracowane: " + out.join(", ");
}
function wykazTable(v, p) {
  let rows = "";
  for (let y = p.from; y <= p.to; y++) rows += `<tr><td>${y}</td><td>${stateChip(yearState(v, "rz", y))}</td><td>${stateChip(yearState(v, "gk", y))}</td></tr>`;
  return `<table><thead><tr><th>Rok</th><th>rz.-kat.</th><th>gr.-kat.</th></tr></thead><tbody>${rows}</tbody></table>`;
}
const wykaz = (v, p) => `<details class="wykaz card"><summary>Szczegółowy wykaz roczników</summary>${wykazTable(v, p)}</details>`;

function emptyState(v, from, to, rite, title) {
  const c = stateSummary(v, from, to, rite);
  const expl = {
    opracowany: "opracowane, ale bez wpisów spełniających filtry",
    w_opracowaniu: "opracowanie trwa",
    skany_calosc: "skany dostępne, czekają na opracowanie",
    skany_czesc: "skany dostępne częściowo",
    katalog: "znane z katalogu, bez potwierdzonego dostępu do skanów",
    brak_ustalen: "źródła jeszcze nie ustalono",
  };
  const li = ["w_opracowaniu", "skany_calosc", "skany_czesc", "katalog", "brak_ustalen", "opracowany"]
    .filter(s => c[s]).map(s => `<li>${stateChip(s)} <span class="small">${expl[s]}: ${compressYears(c[s])}</span></li>`).join("");
  return `<div class="empty" role="status"><h3>${esc(title)}</h3>
    <p class="small muted">Brak opracowanych wpisów dla tych ustawień. Stan materiału:</p><ul>${li}</ul>
    <button class="btn ghost small" data-tab="zrodla">Zobacz źródła</button></div>`;
}

function periodPanel(v, p) {
  const f = { r: S.r, ob: S.ob, rd: S.rd };
  const acts = actsIn(v, p.from, p.to, f);
  const { houses, noHouse } = housesFrom(acts);
  const collapse = S.zw !== "0";
  const yrs = []; if (p.all) yrs.push(...dataYears(v)); else for (let y = p.from; y <= p.to; y++) yrs.push(y);
  let h = `<div class="filters" id="okres" aria-label="Filtry: ${periodLabel(p)}">
    <label>Rocznik<select data-f="r"><option value="">wszystkie</option>${yrs.map(y => `<option ${S.r == y ? "selected" : ""}>${y}</option>`).join("")}</select></label>
    <label>Obrządek<select data-f="ob"><option value="">oba</option><option value="rz" ${S.ob === "rz" ? "selected" : ""}>rz.-kat.</option><option value="gk" ${S.ob === "gk" ? "selected" : ""}>gr.-kat.</option></select></label>
    <label>Rodzaj aktu<select data-f="rd"><option value="">wszystkie</option>${Object.keys(KIND).map(k => `<option value="${k}" ${S.rd === k ? "selected" : ""}>${KIND_SHORT[k]}</option>`).join("")}</select></label>
  </div>`;
  const ev = p.all ? null : EVENTS.find(e => e.v === v && e.after === pkey(p));
  if (ev) h += `<div class="note event">Okres zaczyna się w roku wydarzenia „${esc(ev.title)}”. ${exactDate(ev)
    ? `Wydarzenie miało miejsce ${fmtDate(ev.date)}; wpisy z ${ev.date.slice(0, 4)} r. sprzed tej daty powstały przed nim, mimo że są pokazywane w tym okresie.`
    : `${esc(ev.dateNote)}, dlatego wpisy z ${esc(ev.date)} r. nie są dzielone na sprzed i po wydarzeniu.`} <a href="#" data-event="${ev.id}">Karta wydarzenia</a></div>`;
  if (!houses.length && !noHouse.length) {
    return h + emptyState(v, S.r ? +S.r : p.from, S.r ? +S.r : p.to, S.ob, S.r || S.ob || S.rd ? "Brak wpisów dla wybranych filtrów" : p.all ? "Ta wieś nie ma jeszcze opracowanych wpisów" : "Ten okres nie ma jeszcze opracowanych wpisów") + (p.all ? "" : wykaz(v, p));
  }
  h += `<div class="list-head"><h3 class="section-title" style="margin:0">Domy <span class="count">${houses.length}</span></h3>
    <label class="toggle" style="margin:0"><input type="checkbox" data-collapse ${collapse ? "checked" : ""}> Zwiń powtórzenia</label></div>`;
  h += houses.length ? `<ul class="houses">` : `<p class="muted small">Wpisy w tym zakresie nie podają numerów domów.</p>`;
  for (const [no, rows] of houses) {
    const names = namesForHouse(rows, collapse);
    const ys = rows.map(r => year(r.a));
    const n = new Set(rows.map(r => r.a.id)).size;
    h += `<li><button class="house" data-house="${no}" aria-label="Dom numer ${no}"><span class="no"><small>nr</small>${no}</span><span><ul class="names">
      ${names.map(x => `<li><b>${esc(x.name)}</b>${x.role ? ` <span class="yrs">(${esc(x.role)})</span>` : ""} ${x.flag ? '<span class="flag">niepewny odczyt</span>' : ""}<br><span class="yrs">${x.years}</span></li>`).join("")}</ul>
      <span class="hmeta">${n} ${n === 1 ? "wpis" : n < 5 ? "wpisy" : "wpisów"} · ${Math.min(...ys)}${Math.max(...ys) !== Math.min(...ys) ? "–" + Math.max(...ys) : ""}</span></span><span class="chev" aria-hidden="true">›</span></button></li>`;
  }
  if (houses.length) h += `</ul>`;
  h += `<h3 class="section-title">Bez numeru domu <span class="count">${noHouse.length}</span></h3>`;
  h += noHouse.length ? families(noHouse) : `<p class="muted small">Wszystkie wpisy w tym zakresie mają numer domu.</p>`;
  return h + (p.all ? "" : wykaz(v, p));
}

/* wpisy bez numeru domu zebrane w rodziny według nazwiska ojca (lub głównej osoby aktu); odmiany pisowni łączy warianty-nazwisk.json */
const famKey = n => { const k = norm((n || "").replace(/\[\?\]/g, "")); return VAR[k] || stem(k); };
function families(acts) {
  const groups = new Map(), loose = [];
  for (const a of acts) {
    const p = ["ojciec", "pan_mlody", "zmarly", "zmarla", "dziecko"].map(r => a.people.find(x => x.rola === r && x.nazw)).find(Boolean);
    if (!p) { loose.push(a); continue; }
    const k = famKey(p.nazw);
    if (!groups.has(k)) groups.set(k, { names: new Set(), acts: [] });
    const g = groups.get(k); g.names.add(p.nazw.replace(/\[\?\]/g, "").trim()); g.acts.push(a);
  }
  const list = [...groups.values()].sort((x, y) => y.acts.length - x.acts.length || [...x.names][0].localeCompare([...y.names][0], "pl"));
  const multi = list.filter(g => g.acts.length > 1), single = list.filter(g => g.acts.length === 1).flatMap(g => g.acts);
  let h = multi.length ? `<p class="small muted">Wpisy bez numeru domu zebrano w rodziny według nazwiska ojca (odmiany pisowni połączone). Zbieżność nazwisk nie dowodzi pokrewieństwa.</p>` : "";
  for (const g of multi) {
    const ys = g.acts.map(year), vs = [...new Set(g.acts.map(a => a.v))].map(vName);
    h += `<details class="entry family"><summary><span class="when">${esc([...g.names].sort().join(" / "))}</span>
      <span>${g.acts.length} ${g.acts.length < 5 ? "wpisy" : "wpisów"} · ${listYears(ys).split(", ")[0]}–${Math.max(...ys)}</span><span class="muted small">${esc(vs.join(", "))}</span></summary>
      <div class="body">${g.acts.sort((x, y) => x.date.localeCompare(y.date)).map(entryCard).join("")}</div></details>`;
  }
  return h + [...single, ...loose].sort((x, y) => x.date.localeCompare(y.date)).map(entryCard).join("");
}

function personLine(p) {
  const flags = [];
  if (p.pn !== "pewny") flags.push(`nazwisko: ${p.pn}`);
  if (p.der) flags.push("nazwisko wyprowadzone z nazwiska rodzica");
  if (p.panDer) flags.push("nazwisko panieńskie z wpisu o ojcu matki");
  if (p.dom != null && p.pd !== "pewny") flags.push(`numer domu: ${p.pd}`);
  let dom;
  if (p.dom != null || p.domSrc) {
    dom = `dom nr ${esc(p.dom ?? p.domSrc)}`;
    if (p.domSrc && p.domSrc !== String(p.dom)) dom += ` <span class="src-read">(w źródle: „${esc(p.domSrc)}”)</span>`;
    if (p.wies && p.wies !== S.w && VILLAGES.some(v => v.id === p.wies)) dom += ` <span class="src-read">(${esc(vName(p.wies))})</span>`;
    if (!p.miesz) dom += ' <span class="src-read">(nie przypisany do listy mieszkańców)</span>';
  } else dom = '<span class="src-read">bez adresu w akcie</span>';
  return `<li><span class="role">${ROLE[p.rola] || esc(p.rola)}</span><br><b>${esc(p.imie)} ${esc(p.nazw)}</b>${p.note ? ` <span class="src-read">(${esc(p.note)})</span>` : ""}${p.pan ? ` <span class="muted">z d. ${esc(p.pan)}</span>` : ""}
    ${flags.length ? `<span class="flag">${flags.join(", ")}</span>` : ""}<br><span class="small">${dom}</span></li>`;
}
function actMeta(a) {
  const s = SOURCES[a.src] || {};
  return `<dl class="meta">
    <dt>Data</dt><dd>${fmtDate(a.date)}</dd>
    <dt>Rodzaj</dt><dd>${KIND[a.kind] || esc(a.kind)}</dd>
    <dt>Obrządek</dt><dd>${RITE[a.rite] || "—"}${s.obrzadek_uwaga ? ` <span class="flag">do potwierdzenia</span>` : ""}</dd>
    <dt>Parafia</dt><dd>${esc(s.parafia || "—")}</dd>${SHARED[a.v] ? `
    <dt>Miejscowość</dt><dd>${esc(SHARED[a.v])}</dd>` : ""}
    <dt>Sygnatura</dt><dd>${esc(s.archiwum)}${s.zespol ? `, zesp. ${esc(s.zespol)}` : ""}, ${esc(s.sygnatura)}</dd>
    <dt>Akt / strona</dt><dd>${a.nr ? `nr ${esc(a.nr)}, ` : "bez numeru aktu, "}${esc(a.page)}</dd>
    <dt>Skan</dt><dd>${a.scan ? `<a href="${esc(a.scan)}" target="_blank" rel="noopener">${/photos\./.test(a.scan) ? 'otwórz skan ↗' : 'otwórz księgę w archiwum ↗ (skan wg numeru obok)'}</a>` : '<span class="muted">brak odsyłacza</span>'}</dd>
  </dl>`;
}
const actTitle = a => a.people.filter(p => MAIN_ROLES.includes(p.rola)).map(p => `${p.imie} ${p.nazw}`.trim()).join(" i ") || "osoba bez imienia w odczycie";
function entryCard(a) {
  const copies = a.event ? ACTS.filter(x => x.event === a.event && x.id !== a.id) : [];
  return `<details class="entry"><summary><span class="when">${fmtDate(a.date)}</span>
    <span>${KIND[a.kind] || esc(a.kind)}: ${esc(actTitle(a))}</span><span class="muted small">${RITE[a.rite] || ""} · ${esc(SOURCES[a.src]?.parafia || "")} · ${a.nr ? `nr ${esc(a.nr)}` : esc(a.page)}${SHARED[a.v] ? ` · ${esc(SHARED[a.v])}` : ""}</span>${a.unverified ? '<span><span class="flag">odczyt AI, do sprawdzenia</span></span>' : ""}</summary>
    <div class="body">${actMeta(a)}
      ${a.note ? `<div class="note">Uwagi do odczytu: ${esc(a.note)}</div>` : ""}
      <ul class="people">${a.people.map(personLine).join("")}</ul>
      ${copies.length ? `<p class="small">Ten sam akt w innym źródle: ${copies.map(c => `<a href="#" data-act="${c.id}">${RITE[c.rite]}, ${esc(c.nr || c.page)}</a>`).join(", ")}</p>` : ""}
      <a href="#" class="small" data-act="${a.id}">Strona wzmianki</a>
    </div></details>`;
}

function viewHouse() {
  const v = S.w, no = +S.d, p = findPeriod(S.o);
  const all = S.z === "all" || !!p.all;
  const from = all ? 1700 : p.from, to = all ? 1945 : p.to;
  const inHouse = a => a.people.some(x => hasHouse(x) && x.dom === no);
  const acts = actsIn(v, from, to).filter(inHouse);
  const allActs = actsIn(v, 1700, 1945).filter(inHouse);
  let h = `<a href="#" class="back" data-back>← ${esc(vName(v))}, ${periodLabel(p)}</a>
    <h2>Dom nr ${no}</h2><p class="lead">${esc(vName(v))}. Wpisy, w których źródło wiąże osobę z tym numerem domu.</p>
    ${p.all ? "" : `<div class="seg"><button aria-pressed="${!all}" data-scope="okres">Okres ${p.from}–${p.to}</button><button aria-pressed="${all}" data-scope="all">Wszystkie lata</button></div>`}`;
  if (acts.some(a => a.unverified)) h += aiNote;
  const rows = acts.flatMap(a => a.people.filter(x => hasHouse(x) && x.dom === no).map(x => ({ a, p: x })));
  const names = namesForHouse(rows, true);
  if (rows.length) h += `<div class="card"><h3>Nazwiska</h3><ul class="names" style="margin-top:6px">${names.map(n => `<li><b>${esc(n.name)}</b> ${n.flag ? '<span class="flag">niepewny odczyt</span>' : ""} <span class="yrs">${n.years}</span></li>`).join("")}</ul></div>`;
  h += `<div class="note small">Rok potwierdza wzmiankę. Ciągłość zamieszkania między wzmiankami i tożsamość budynku po pożarze 1910 r. wymagają osobnego potwierdzenia.</div>`;
  h += `<h3 class="section-title">Wpisy chronologicznie (${acts.length})</h3>`;
  h += acts.length ? acts.map(entryCard).join("") : emptyState(v, from, to, "", `Brak wpisów dla domu nr ${no} w tym okresie`) + (allActs.length ? `<p class="small">Ten dom ma wpisy w innych latach (${allActs.length}). <a href="#" data-scope="all">Pokaż wszystkie lata</a></p>` : "");
  const other = VILLAGES.filter(x => x.id !== v && ACTS.some(a => a.v === x.id && a.people.some(pp => hasHouse(pp) && pp.dom === no)));
  if (other.length) h += `<p class="small muted">Dom o tym samym numerze w innej wsi to osobna karta: ${other.map(x => `<a href="#" data-goto-house="${x.id}:${no}">${esc(x.name)}, nr ${no}</a>`).join(", ")}.</p>`;
  return h;
}

function viewAct() {
  const a = ACTS.find(x => x.id === S.a);
  if (!a) return `<a href="#" class="back" data-back>← wróć</a><div class="empty"><h3>Nie znaleziono wpisu</h3><p class="small muted">Wpis mógł zmienić identyfikator po poprawkach w danych.</p></div>`;
  const copies = a.event ? ACTS.filter(x => x.event === a.event && x.id !== a.id) : [];
  const homes = [...new Set(a.people.filter(hasHouse).map(p => p.dom))];
  return `<a href="#" class="back" data-back>← wróć</a>
    <h2>${KIND[a.kind] || esc(a.kind)}, ${fmtDate(a.date)}</h2><p class="lead">${esc(vName(a.v))} · wzmianka źródłowa</p>
    ${a.unverified ? aiNote : ""}
    <div class="card">${actMeta(a)}${a.note ? `<div class="note">Uwagi do odczytu: ${esc(a.note)}</div>` : ""}</div>
    <h3 class="section-title">Osoby we wpisie</h3><ul class="people">${a.people.map(personLine).join("")}</ul>
    ${homes.length ? `<p class="small">Karta domu: ${homes.map(n => `<a href="#" data-goto-house="${a.v}:${n}">${esc(vName(a.v))}, nr ${n}</a>`).join(", ")}</p>` : ""}
    ${copies.length ? `<div class="card small">Ten sam akt zachował się także w: ${copies.map(c => `<a href="#" data-act="${c.id}">${esc(SOURCES[c.src]?.archiwum)}, ${RITE[c.rite]}, ${esc(c.nr || c.page)}</a>`).join(", ")}.</div>` : ""}
    <h3 class="section-title">Źródło</h3>${sourceCard(a.src)}`;
}

function sourceCard(id) {
  const s = SOURCES[id];
  if (!s) return `<div class="card small muted">Źródło „${esc(id)}” nie jest opisane w wykazie.</div>`;
  const n = ACTS.filter(a => a.src === id).length;
  return `<div class="card"><b>${esc(s.archiwum)}${s.zespol ? `, zespół ${esc(s.zespol)}` : ""}</b><br><span class="small">${esc(s.sygnatura)}</span>
    <dl class="meta"><dt>Parafia</dt><dd>${esc(s.parafia || "—")}</dd><dt>Obrządek</dt><dd>${s.obrzadek ? RITE[s.obrzadek] : "—"}${s.obrzadek_uwaga ? `<br><span class="src-read">${esc(s.obrzadek_uwaga)}</span>` : ""}</dd>
    <dt>Rodzaj akt</dt><dd>${esc(s.rodzaje)}</dd><dt>Roczniki</dt><dd>${esc(s.roczniki)}</dd>
    <dt>Miejscowości</dt><dd>${(s.wsie || []).map(vName).join(", ")}</dd><dt>Skany</dt><dd>${esc(s.skany)}</dd><dt>Stan</dt><dd>${esc(s.stan)}</dd>
    ${n ? `<dt>Wpisy na stronie</dt><dd>${n}${s.odczyt_ai ? ' <span class="flag">odczyt AI, do sprawdzenia</span>' : ""}</dd>` : ""}</dl>
    ${s.link ? `<a class="small" href="${esc(s.link)}" target="_blank" rel="noopener">${esc(new URL(s.link).hostname)} ↗</a>` : '<span class="small muted">Link do ustalenia</span>'}
    ${s.katalog_danych ? `<br><a class="small" href="https://github.com/Machmi-pro/plaucza-i-okolice/blob/main/data/${esc(s.katalog_danych)}/uwagi.md" target="_blank" rel="noopener">Uwagi do odczytu tej księgi ↗</a>` : ""}</div>`;
}

function viewSources(v) {
  const ids = Object.keys(SOURCES).filter(id => (SOURCES[id].wsie || []).includes(v));
  let h = `<p class="small muted">Wykaz źródeł dla tej wsi i stan opracowania roczników. Okresy są wspólne dla wszystkich wsi; dostępność źródeł różni się między miejscowościami.</p>`;
  h += `<div class="legend" style="margin-bottom:8px">${Object.keys(STATE).map(stateChip).join(" ")}</div>`;
  h += `<h3 class="section-title">Roczniki według okresów</h3>`;
  for (const p of PERIODS) {
    const c = stateSummary(v, p.from, p.to);
    const best = STATE_ORDER.filter(s => c[s]);
    h += `<details class="wykaz card"><summary>${p.from}–${p.to} <span style="font-weight:400">${best.slice(0, 2).map(stateChip).join(" ")}</span></summary>${wykazTable(v, p)}</details>`;
  }
  return h + `<h3 class="section-title">Źródła (${ids.length})</h3>` + ids.map(sourceCard).join("");
}

function viewHistory(v) {
  const evs = EVENTS.filter(e => e.v === v).sort((a, b) => a.date.localeCompare(b.date));
  const hist = VILLAGES.find(x => x.id === v)?.history || [];
  const top = hist.length ? `<div class="card history"><h3>Dzieje wsi do 1939 r.</h3>${hist.map(x => `<p>${esc(x.tekst)}${x.zrodlo ? ` <span class="src-read">(${esc(x.zrodlo)})</span>` : ""}</p>`).join("")}</div>` : "";
  if (!evs.length) return top + `<div class="empty"><h3>Brak opisanych wydarzeń</h3><p class="small muted">Dla tej wsi nie dodano jeszcze wydarzeń. Wydarzenia pojawią się na osi czasu jako znaczniki ◆.</p></div>`;
  return top + `<h3 class="section-title">Wydarzenia</h3>` + evs.map(e => `<button class="evt" style="margin:6px 0" data-event="${e.id}"><span class="lbl">◆ Wydarzenie · ${esc(exactDate(e) ? fmtDate(e.date) : e.date)}</span><br><strong>${esc(e.title)}</strong><br><span class="small muted">${esc(e.desc.length > 90 ? e.desc.slice(0, 90) + "…" : e.desc)}</span></button>`).join("");
}

function viewEvent() {
  const e = EVENTS.find(x => x.id === S.e);
  if (!e) return `<a href="#" class="back" data-back>← wróć</a><p>Nie znaleziono wydarzenia.</p>`;
  const after = findPeriod(e.after), before = findPeriod(e.before);
  const y = +e.date.slice(0, 4);
  const yearActs = ACTS.filter(a => a.v === e.v && year(a) === y);
  const laterActs = after ? actsIn(e.v, y + 1, after.to) : [];
  let h = `<a href="#" class="back" data-back>← ${esc(vName(e.v))}</a>
    <div class="event-head"><span class="lbl">◆ Wydarzenie</span><h2>${esc(e.title)}</h2><p class="muted small" style="margin:2px 0 0">${esc(exactDate(e) ? fmtDate(e.date) : e.date)}${e.dateNote ? " · " + esc(e.dateNote) : ""}</p></div>
    <p>${esc(e.desc)}</p>
    ${e.quotes.map(q => `<blockquote class="quote"><p>${esc(q.tekst)}</p><footer>${esc(q.zrodlo)}</footer></blockquote>`).join("")}`;
  if (before && after) h += `<div class="two">
      <button class="btn ghost" data-goto-period="${e.before}">Domy przed pożarem<br><span class="small">${before.from}–${before.to}</span></button>
      <button class="btn" data-goto-period="${e.after}">Domy od roku pożaru<br><span class="small">${after.from}–${after.to}</span></button>
    </div>
    <div class="note event small">${exactDate(e)
      ? `Wpisy z ${y} r. (${yearActs.length}) są w widoku „Od roku pożaru”. Te sprzed ${fmtDate(e.date)} powstały jeszcze przed pożarem.`
      : `Dopóki dokładna data nie jest potwierdzona, wpisy z ${y} r. (${yearActs.length}) pozostają w widoku „Od roku pożaru”, bez przypisania do części przed pożarem lub po nim.`}</div>`;
  if (after && !laterActs.length && y < after.to) {
    const c = stateSummary(e.v, y + 1, after.to);
    h += `<div class="empty small"><b>Późniejsze lata (${y + 1}–${after.to})</b> nie są jeszcze opracowane. Stan źródeł: ${STATE_ORDER.filter(s => c[s]).map(s => `${STATE[s].toLowerCase()}: ${compressYears(c[s])}`).join("; ")}.</div>`;
  }
  h += `<h3 class="section-title">Powiązane domy</h3>
    ${e.houses.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${e.houses.map(n => `<button class="btn ghost small" data-goto-house="${e.v}:${n}">nr ${n}</button>`).join("")}</div>` : '<p class="small muted">Dokumenty nie wskazują jeszcze numerów domów.</p>'}
    <h3 class="section-title">Źródła</h3>${e.sources.map(sourceCard).join("")}`;
  return h;
}

function viewSearch() {
  const q = S.q || "", nq = norm(q), all = S.all === "1";
  let h = `<a href="#" class="back" data-back>← ${esc(vName(S.w))}</a><h2>Wyniki: „${esc(q)}”</h2>
    <label class="toggle"><input type="checkbox" data-allv ${all ? "checked" : ""}> Wszystkie wsie</label>`;
  if (nq.length < 2) return h + `<p class="muted">Wpisz co najmniej dwie litery nazwiska.</p>`;
  const groups = new Set(Object.entries(VAR).filter(([n]) => n.includes(nq)).map(([, g]) => g));
  const res = new Map();
  for (const a of ACTS) {
    if (!all && !inV(a, S.w)) continue;
    for (const p of a.people) {
      const nn = norm(p.nazw), np = norm(p.pan);
      const direct = (nn && nn.includes(nq)) || (np && np.includes(nq));
      const viaVar = !direct && (groups.has(VAR[nn]) || (np && groups.has(VAR[np])));
      if (!direct && !viaVar) continue;
      const dom = hasHouse(p) ? p.dom : null;
      const byName = (nn && nn.includes(nq)) || (nn && groups.has(VAR[nn]));
      const maiden = !byName && !!np;
      const shown = maiden ? p.pan : p.nazw;
      const key = `${a.v}|${dom ?? "-"}|${shown}|${dom == null ? a.id : ""}`;
      if (!res.has(key)) res.set(key, { v: a.v, dom, nazw: shown, years: [], acts: [], roles: new Set(), viaVar, maiden, derived: false });
      const r = res.get(key); r.years.push(year(a)); r.acts.push(a.id); r.roles.add(ROLE[p.rola]); if (p.der && !maiden) r.derived = true;
    }
  }
  const list = [...res.values()].sort((a, b) => a.v.localeCompare(b.v) || (a.dom ?? 1e9) - (b.dom ?? 1e9) || a.nazw.localeCompare(b.nazw, "pl"));
  if (!list.length) {
    return h + `<div class="empty" role="status"><h3>Nie znaleziono nazwiska</h3><p class="small">Wyszukiwanie obejmuje tylko opracowane wpisy ${all ? "ze wszystkich wsi" : `z wsi ${esc(vName(S.w))}`}. Wiele roczników czeka jeszcze na opracowanie.</p>
      ${all ? "" : `<button class="btn ghost small" data-allv-on>Szukaj we wszystkich wsiach</button> `}<button class="btn ghost small" data-tab="zrodla">Stan źródeł</button></div>`;
  }
  h += `<p class="small muted">Wyniki: ${list.length}. Pisownia jak w dokumencie; zbieżność nazwisk nie oznacza pokrewieństwa.</p>`;
  for (const r of list) {
    h += `<button class="result" ${r.dom != null ? `data-goto-house="${r.v}:${r.dom}"` : `data-act="${r.acts[0]}"`}>
      <span class="nm">${esc(r.nazw)}</span> ${r.viaVar ? '<span class="chip s-katalog">wariant pisowni</span>' : ""} ${r.maiden ? '<span class="chip s-katalog">nazwisko panieńskie</span>' : ""}<br>
      <span class="where">${esc(vName(r.v))} · ${r.dom != null ? `dom nr ${r.dom}` : "Bez numeru domu"}</span><br>
      <span class="small">Lata: ${listYears(r.years)} · ${esc([...r.roles].join(", "))}</span></button>`;
  }
  return h;
}

/* ===================== RENDER ===================== */
let lastView = "";
function route() {
  S = readHash();
  document.getElementById("village").value = S.w;
  document.getElementById("q").value = S.v === "szukaj" ? (S.q || "") : "";
  const views = { wies: viewVillage, dom: viewHouse, akt: viewAct, szukaj: viewSearch, wydarzenie: viewEvent };
  app.innerHTML = (views[S.v] || viewVillage)();
  const sig = [S.v, S.w, S.d, S.a, S.e, S.q].join("|");
  if (pendingScroll) { document.getElementById(pendingScroll)?.scrollIntoView({ block: "start" }); pendingScroll = null; }
  else if (sig !== lastView) window.scrollTo(0, 0);
  lastView = sig;
}

function bind() {
  const vsel = document.getElementById("village");
  vsel.innerHTML = VILLAGES.map(v => `<option value="${v.id}">${esc(v.name)}</option>`).join("");
  /* po zmianie wsi okres i filtry zostają */
  vsel.addEventListener("change", () => go({ w: vsel.value, v: "wies", d: "", a: "", e: "", q: "" }));
  document.getElementById("searchForm").addEventListener("submit", ev => {
    ev.preventDefault();
    go({ v: "szukaj", q: document.getElementById("q").value.trim(), d: "", a: "", e: "" });
  });
  app.addEventListener("click", ev => {
    const t = ev.target.closest("[data-tab],[data-period],[data-house],[data-act],[data-event],[data-scope],[data-goto-house],[data-goto-period],[data-back],[data-allv-on]");
    if (!t) return;
    ev.preventDefault();
    const d = t.dataset;
    if (d.tab) go({ v: "wies", t: d.tab, q: "" });
    else if (d.period) { pendingScroll = "okres"; go({ o: d.period, r: "" }, true); }
    else if (d.house) go({ v: "dom", d: d.house, z: "" });
    else if (d.gotoHouse) {
      const [w, n] = d.gotoHouse.split(":");
      const inPeriod = (() => { const p = findPeriod(S.o); return p && ACTS.some(a => a.v === w && year(a) >= p.from && year(a) <= p.to && a.people.some(x => hasHouse(x) && x.dom === +n)); })();
      go({ v: "dom", w, d: n, z: inPeriod ? "" : "all" });
    }
    else if (d.act) go({ v: "akt", a: d.act });
    else if (d.event) go({ v: "wydarzenie", e: d.event });
    else if (d.gotoPeriod) { pendingScroll = "okres"; go({ v: "wies", t: "domy", o: d.gotoPeriod, r: "", e: "" }); }
    else if (d.scope) go({ z: d.scope === "all" ? "all" : "" }, true);
    else if ("allvOn" in d) go({ all: "1" }, true);
    else if ("back" in d) goBack();
  });
  app.addEventListener("change", ev => {
    const t = ev.target;
    if (t.dataset.f) go({ [t.dataset.f]: t.value }, true);
    else if ("collapse" in t.dataset) go({ zw: t.checked ? "" : "0" }, true);
    else if ("allv" in t.dataset) go({ all: t.checked ? "1" : "" }, true);
  });
  window.addEventListener("hashchange", route);
}

loadAll().then(() => {
  VAR = variantOf();
  document.getElementById("stamp").textContent = `${ACTS.length} wpisów, ${ACTS.reduce((n, a) => n + a.people.length, 0)} osób w danych.`;
  bind();
  route();
}).catch(err => {
  console.error(err);
  app.innerHTML = `<div class="empty" role="alert"><h3>Nie udało się wczytać danych</h3>
    <p class="small">${esc(err.message)}</p>
    <p class="small muted">Strona czyta pliki z katalogu <code>data/</code>, więc musi być otwarta przez serwer (np. GitHub Pages albo <code>python3 -m http.server</code>), a nie bezpośrednio z dysku.</p></div>`;
});
