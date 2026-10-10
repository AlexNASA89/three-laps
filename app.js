// Three Laps v0.5 — шпаргалка и тренажёр маршрута обхода (ТЗ v4.1). Маршрут — logic.js + shots.json, фразы — content.js.
import * as L from "./logic.js";
import * as S from "./store.js";
import { TALK, TALK_FLAT, talkLine, DEFAULT_NAME } from "./content.js";

const VERSION = "v0.5";
const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const root = $("#app");

const app = {
  data: null, tab: S.get("tab", "map"), rid: S.get("rid", "out"),
  learn: S.get("learn", { out: 0, salon: 0 }), shown: false,
  mapk: S.get("mapk", 0),    // какая карта «Снаружи» открыта на вкладке «Карта»: 0 — круг 1, 1 — круг 2
  viewer: null,      // { rid, i } — листание по маршруту | { card, tag, label } — одна карточка (карта, «Перед съёмкой»)
  phrase: null,      // индекс в TALK_FLAT — фраза крупно для хозяина
  settingsOpen: false,
  settings: { theme: "auto", name: DEFAULT_NAME, ...S.get("settings", {}) },
  build: "", update: false, checking: false, pre: { n: 0, total: 0, ready: false },
};

const theme = () => (app.settings.theme === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : app.settings.theme);
const src = (card, thumb) => L.cardPath(card, theme(), thumb);
// картинка карточки; если файла ещё нет — аккуратная заглушка с подписью (см. обработчик error ниже)
const missing = new Set();   // адреса карточек, которых нет: при перерисовке сразу заглушка, без мигания
const placeholder = (cls, tag, label) => `<div class="phc ${cls}"><b>${esc(tag)}</b><span>${esc(label)}</span><small>Карточка появится в обновлении</small></div>`;
const img = (card, tag, label, cls = "cd", thumb = false) => missing.has(src(card, thumb)) ? placeholder(cls, tag, label)
  : `<img class="${cls}" src="${src(card, thumb)}" alt="${esc(label)}" data-tag="${esc(tag)}" data-label="${esc(label)}" draggable="false">`;
const mapLabel = (r, m) => (r.maps.length > 1 ? `${r.title} · ${m.title}` : `Карта · ${r.title}`);
const pointTag = (p) => (p.id === "vin" ? "Финал" : `Точка ${p.tag}`);

const ICON = {
  map: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 2.2 6 2v11.6l-6-2V6.2z" fill="currentColor"/></svg>`,
  learn: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 1 9l11 6 9-4.9V17h2V9L12 3zM5 13.2V17l7 4 7-4v-3.8l-7 3.8-7-3.8z" fill="currentColor"/></svg>`,
  talk: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="currentColor"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.7 7.7 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.7 7.7 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1L11 21h4l.4-2.9c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5-2.2-1.6zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" fill="currentColor" transform="translate(-1 0)"/></svg>`,
};
const TABS = [["map", "Карта"], ["learn", "Учить"], ["talk", "Фразы"]];

// ---------- экраны ----------
const seg = () => `<div class="seg" role="tablist">${app.data.routes.map((r) =>
  `<button role="tab" aria-selected="${app.rid === r.id}" class="${app.rid === r.id ? "on" : ""}" data-a="rid" data-id="${r.id}">${esc(r.title)}</button>`).join("")}</div>`;

const view = {
  map() {
    const r = L.route(app.data, app.rid), k = Math.min(app.mapk, r.maps.length - 1), m = r.maps[k];
    const msw = r.maps.length > 1 ? `<div class="seg small2">${r.maps.map((x, j) => `<button class="${j === k ? "on" : ""}" data-a="mapk" data-id="${j}">${esc(x.title)}</button>`).join("")}</div>` : "";
    const rows = L.groups(app.data, app.rid).map((g) => `<div class="pt"><span class="num ${g.point == null && g.tag === "VIN" ? "fin" : ""}">${esc(g.tag)}</span><div class="pt-lines">${g.items.map(({ p, i }) =>
      `<button class="pl" data-a="open" data-i="${i}">${p.plus ? `<b class="plus">+</b>` : ""}<span>${esc(p.label)}</span></button>`).join("")}</div></div>`).join("");
    return `${seg()}
      ${msw}<button class="mapbox" data-a="mapfull" data-id="${k}" aria-label="Открыть карту во весь экран">${img(m.card, "Карта", mapLabel(r, m), "mapimg")}</button>
      <button class="btn pre" data-a="pre">Перед съёмкой</button>
      ${r.note ? `<div class="note">${esc(r.note)}</div>` : ""}
      <div class="pts">${rows}</div>`;
  },
  learn() {
    const r = L.route(app.data, app.rid), i = L.clampIndex(app.data, app.rid, app.learn[app.rid]), p = L.pointAt(app.data, app.rid, i);
    const n = r.points.length, mk = L.mapIndexOf(app.data, app.rid, i), m = r.maps[mk];
    return `${seg()}
      <div class="lq">
        <button class="lmap" data-a="mapfull" data-id="${mk}" aria-label="Карта во весь экран">${img(m.card, "Карта", mapLabel(r, m), "lthumb", true)}</button>
        <div class="grow"><div class="lpos">${i + 1} из ${n}${r.maps.length > 1 ? ` · ${esc(m.short)}` : ""}</div><div class="ltag">${esc(pointTag(p))}</div><div class="lqq">Что снимаешь здесь?</div></div>
      </div>
      ${app.shown ? `<div class="lans"><b>${esc(p.tag)}</b> · ${esc(p.label)}${p.note ? `<div class="small mut">${esc(p.note)}</div>` : ""}</div>
        <div class="lcard">${img(p.card, p.tag, p.label)}</div>`
        : `<button class="btn pri big" data-a="show">Показать</button>`}
      <div class="lnav"><button class="nav" data-a="lprev" ${i > 0 ? "" : "disabled"} aria-label="Предыдущая">‹</button>
        <button class="btn ghost restart" data-a="lstart" ${i > 0 ? "" : "disabled"}>С начала</button>
        <button class="nav" data-a="lnext" ${i < n - 1 ? "" : "disabled"} aria-label="Следующая">›</button></div>`;
  },
  talk() {
    const chips = TALK.map((s) => `<button data-a="talkgo" data-id="${s.id}">${esc(s.title)}</button>`).join("");
    const body = TALK.map((s) => `<h2 id="sec-${s.id}">${esc(s.title)}</h2>${s.tip ? `<div class="small mut tip">${esc(s.tip)}</div>` : ""}
      ${s.lines.map((l0) => { const l = talkLine(l0, app.settings.name), k = TALK_FLAT.findIndex((x) => x.id === l0.id);
        return `<button class="phr" data-a="phrase" data-i="${k}"><span class="ptag">${esc(l.tag)}</span><span class="en">${esc(l.en)}</span><span class="ru">${esc(l.ru)}</span></button>`; }).join("")}`).join("");
    return `<div class="chips">${chips}</div><div class="small mut tip">Тап по фразе — крупно, чтобы показать хозяину.</div>${body}`;
  },
};

function viewerHTML() {
  const v = app.viewer;
  if (v.rid) {
    const p = L.pointAt(app.data, v.rid, v.i), n = L.points(app.data, v.rid).length;
    return `<div class="vw" role="dialog" aria-label="Карточка"><div class="vtop"><button class="ib" data-a="vclose" aria-label="Закрыть">✕</button>
        <div class="vpos"><b>${esc(L.position(app.data, v.rid, v.i))}</b><small>${esc(p.label)}</small></div></div>
      <div class="vbody">${img(p.card, p.tag, p.label)}${p.note ? `<div class="vnote">${esc(p.note)}</div>` : ""}</div>
      <div class="vbar"><button class="nav" data-a="vprev" ${v.i > 0 ? "" : "disabled"} aria-label="Предыдущая">‹</button>
        <span class="vhint">свайп ← →</span><button class="nav" data-a="vnext" ${v.i < n - 1 ? "" : "disabled"} aria-label="Следующая">›</button></div></div>`;
  }
  return `<div class="vw" role="dialog" aria-label="${esc(v.label)}"><div class="vtop"><button class="ib" data-a="vclose" aria-label="Закрыть">✕</button>
      <div class="vpos"><b>${esc(v.label)}</b>${v.note ? `<small>${esc(v.note)}</small>` : ""}</div></div>
    <div class="vbody">${img(v.card, v.tag, v.label)}</div></div>`;
}
function phraseHTML() {
  const k = app.phrase, l = talkLine(TALK_FLAT[k], app.settings.name);
  return `<div class="owner" role="dialog"><div class="onum">${esc(l.tag)} · ${k + 1} из ${TALK_FLAT.length}</div><div class="en">${esc(l.en)}</div><div class="ru">${esc(l.ru)}</div>
    <div class="ownerbar"><button data-a="php" ${k ? "" : "disabled"} aria-label="Предыдущая">‹</button><button data-a="phx">Закрыть</button><button data-a="phn" ${k < TALK_FLAT.length - 1 ? "" : "disabled"} aria-label="Следующая">›</button></div></div>`;
}
const offText = () => (app.pre.ready ? "Работает без интернета ✓" : app.pre.n ? `Загрузка для офлайна ${app.pre.n}/${app.pre.total}` : "Офлайн-кэш готовится");
function showOffline() { const el = $("#offst"); if (el) el.textContent = offText(); }   // без перерисовки: не сбивать ввод имени
function settingsHTML() {
  const st = app.settings;
  return `<div class="sheet-bg" data-a="bg"><div class="sheet" role="dialog" aria-label="Настройки"><div class="row"><h2 class="grow">Настройки</h2><button class="ib" data-a="setx" aria-label="Закрыть">✕</button></div>
    <div class="lbl">Тема</div><div class="seg">${["auto", "light", "dark"].map((t) => `<button class="${st.theme === t ? "on" : ""}" data-a="theme" data-id="${t}">${{ auto: "Авто", light: "Светлая", dark: "Тёмная" }[t]}</button>`).join("")}</div>
    <label class="lbl" for="myname">Имя для знакомства (по-английски)</label><input type="text" id="myname" autocomplete="off" placeholder="${DEFAULT_NAME}" value="${esc(st.name)}">
    <div class="small mut">Во фразе: «My name is ${esc(st.name || DEFAULT_NAME)}.»</div>
    ${app.update ? `<button class="btn yel" data-a="update">Есть обновление: применить</button>` : ""}
    <button class="btn" data-a="refresh">${app.checking ? "Проверяю…" : "Обновить"}</button>
    <div class="small mut" id="offst">${esc(offText())}</div>
    <div class="small mut ver">Three Laps ${VERSION}${app.build ? ` · сборка ${esc(app.build)}` : ""}</div></div></div>`;
}

function render() {
  const th = theme();
  document.documentElement.dataset.theme = th;
  const meta = $('meta[name="theme-color"]'); if (meta) meta.content = th === "dark" ? "#0f1013" : "#ffffff";
  const sc = $(".scr"), keep = sc && root.dataset.tab === app.tab ? sc.scrollTop : 0;
  root.dataset.tab = app.tab;
  root.innerHTML = `<header class="hdr"><div class="brand">Three Laps</div>
      ${app.update ? `<button class="updpill" data-a="update">Обновить</button>` : ""}
      <button class="ib" data-a="settings" aria-label="Настройки">${ICON.gear}</button></header>
    <main class="scr" id="scr">${view[app.tab]()}</main>
    <nav class="tabs">${TABS.map(([k, t]) => `<button class="${app.tab === k ? "on" : ""}" data-a="tab" data-id="${k}" aria-current="${app.tab === k ? "page" : "false"}">${ICON[k]}<span>${t}</span></button>`).join("")}</nav>
    ${app.viewer ? viewerHTML() : ""}${app.phrase !== null ? phraseHTML() : ""}${app.settingsOpen ? settingsHTML() : ""}`;
  const n = $(".scr"); if (n && keep) n.scrollTop = keep;
  if (app.viewer) swipe($(".vbody")); else if (app.tab === "learn") swipe($(".scr"));   // Учить: свайп по всему экрану
  const mn = $("#myname");
  if (mn) mn.oninput = () => { app.settings.name = mn.value.trim(); S.set("settings", app.settings); const hint = mn.nextElementSibling; if (hint) hint.textContent = `Во фразе: «My name is ${app.settings.name || DEFAULT_NAME}.»`; };
}

// заглушка вместо отсутствующей карточки (карточки могут прийти позже)
root.addEventListener("error", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLImageElement) || !t.dataset.label) return;
  missing.add(t.getAttribute("src"));
  t.outerHTML = placeholder(t.className, t.dataset.tag, t.dataset.label);
}, true);

// ---------- навигация и «Назад» ----------
const overlayOpen = () => app.viewer || app.phrase !== null || app.settingsOpen;
function openOverlay(fn) { const was = overlayOpen(); fn(); if (!was) history.pushState({ o: 1 }, ""); render(); }
function closeTop() {
  if (app.phrase !== null) app.phrase = null; else if (app.viewer) app.viewer = null; else if (app.settingsOpen) app.settingsOpen = false;
}
function closeOverlay() {
  closeTop(); render();
  if (!overlayOpen() && history.state && history.state.o) history.back();   // убрать запись истории оверлея; popstate уже ничего не закроет
}
// системная «Назад» закрывает открытый оверлей (карточка, фраза, настройки), а не приложение
addEventListener("popstate", () => { if (overlayOpen()) { app.phrase = null; app.viewer = null; app.settingsOpen = false; render(); } });

function moveViewer(dir) {
  const v = app.viewer; if (!v || !v.rid) return;
  const j = L.step(app.data, v.rid, v.i, dir); if (j === null) return;
  v.i = j; render();
}
function moveLearn(dir) {
  const i = L.clampIndex(app.data, app.rid, app.learn[app.rid]), j = L.step(app.data, app.rid, i, dir);
  if (j === null) return;
  app.learn[app.rid] = j; app.shown = false; S.set("learn", app.learn); render();
  const s = $(".scr"); if (s) s.scrollTop = 0;
}

root.addEventListener("click", (e) => {
  const t = e.target.closest("[data-a]"); if (!t) return;
  const a = t.dataset.a, id = t.dataset.id;
  switch (a) {
    case "tab": app.tab = id; app.shown = false; S.set("tab", id); render(); $(".scr").scrollTop = 0; break;
    case "rid": app.rid = id; app.shown = false; S.set("rid", id); render(); break;
    case "open": openOverlay(() => { app.viewer = { rid: app.rid, i: +t.dataset.i }; }); break;
    case "mapk": app.mapk = +id; S.set("mapk", app.mapk); render(); break;
    case "mapfull": { const r = L.route(app.data, app.rid), m = r.maps[+id || 0] || r.maps[0]; openOverlay(() => { app.viewer = { card: m.card, tag: "Карта", label: mapLabel(r, m) }; }); break; }
    case "pre": { const p = app.data.pre; openOverlay(() => { app.viewer = { card: p.card, tag: p.tag, label: p.label, note: p.note }; }); break; }
    case "vclose": case "phx": case "setx": closeOverlay(); break;
    case "bg": if (e.target === t) closeOverlay(); break;
    case "vprev": moveViewer(-1); break;
    case "vnext": moveViewer(1); break;
    case "show": app.shown = true; render(); break;
    case "lprev": moveLearn(-1); break;
    case "lnext": moveLearn(1); break;
    case "lstart": app.learn[app.rid] = 0; app.shown = false; S.set("learn", app.learn); render(); break;
    case "talkgo": { const el = document.getElementById("sec-" + id); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); break; }
    case "phrase": openOverlay(() => { app.phrase = +t.dataset.i; }); break;
    case "php": app.phrase = Math.max(0, app.phrase - 1); render(); break;
    case "phn": app.phrase = Math.min(TALK_FLAT.length - 1, app.phrase + 1); render(); break;
    case "settings": openOverlay(() => { app.settingsOpen = true; }); break;
    case "theme": app.settings.theme = id; S.set("settings", app.settings); render(); break;
    case "refresh": forceUpdate(); break;
    case "update": app.updating = true; navigator.serviceWorker.getRegistration().then((r) => { if (r && r.waiting) r.waiting.postMessage("skipWaiting"); else location.reload(); }); break;
  }
});
addEventListener("keydown", (e) => {
  if (e.target.closest && e.target.closest("input")) return;
  const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
  if (e.key === "Escape" && overlayOpen()) return closeOverlay();
  if (!d) return;
  if (app.phrase !== null) { app.phrase = Math.min(TALK_FLAT.length - 1, Math.max(0, app.phrase + d)); render(); }
  else if (app.viewer) moveViewer(d);
  else if (app.tab === "learn" && !app.settingsOpen) moveLearn(d);
});

// свайп влево/вправо (палец или мышь); вертикальная прокрутка остаётся за браузером (touch-action: pan-y)
function swipe(el) {
  let x0 = null, y0 = 0;
  el.onpointerdown = (e) => { x0 = e.clientX; y0 = e.clientY; };
  el.onpointercancel = () => { x0 = null; };
  el.onpointerup = (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
    const dir = dx < 0 ? 1 : -1;
    if (app.viewer) moveViewer(dir); else if (app.tab === "learn") moveLearn(dir);
  };
}

// ---------- обновление и офлайн ----------
function toast(msg) {
  const d = document.createElement("div"); d.className = "toast"; d.textContent = msg; document.body.appendChild(d);
  setTimeout(() => d.remove(), 2600);
}
async function forceUpdate() {
  if (!("serviceWorker" in navigator)) { location.reload(); return; }
  app.checking = true; render();
  try {
    const r = await navigator.serviceWorker.getRegistration();
    if (!r) { location.reload(); return; }
    await r.update();
    const t0 = Date.now();
    while (r.installing && Date.now() - t0 < 60000) await new Promise((z) => setTimeout(z, 500));   // докачать новую версию
    if (r.waiting) { app.updating = true; r.waiting.postMessage("skipWaiting"); setTimeout(() => location.reload(), 4000); return; }
    toast(`Уже последняя версия (${VERSION})`);
  } catch { toast("Нет связи — обновлю, когда появится интернет"); }
  app.checking = false; render();
}
let offTries = 0;
async function checkOffline() {   // сколько файлов уже в офлайн-кэше (опрос до готовности, не дольше ~3 мин)
  try {
    const m = await (await fetch("precache.json", { cache: "no-store" })).json(); const c = await caches.open("threelaps-" + m.version);
    const n = (await c.keys()).length; app.pre = { n, total: m.files.length, ready: n >= m.files.length };
    if (!app.pre.ready && ++offTries < 70) setTimeout(checkOffline, 2500);
    showOffline();
  } catch { /* нет сети или SW ещё не готов */ }
}

// ---------- старт ----------
async function init() {
  app.data = await (await fetch("shots.json")).json();
  if (!L.ROUTE_IDS.includes(app.rid)) app.rid = "out";
  if (!TABS.some(([k]) => k === app.tab)) app.tab = "map";
  for (const rid of L.ROUTE_IDS) app.learn[rid] = L.clampIndex(app.data, rid, app.learn[rid]);
  try { app.build = (await (await fetch("precache.json")).json()).version; } catch { /* */ }
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (app.settings.theme === "auto") render(); });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (app.updating) location.reload(); });
    navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.type === "precache") { app.pre = { n: e.data.n, total: e.data.total, ready: e.data.n >= e.data.total }; showOffline(); } });
    navigator.serviceWorker.register("sw.js").then((r) => {
      r.addEventListener("updatefound", () => { const w = r.installing; w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) { app.update = true; render(); } }); });
    }).catch(() => {});
    checkOffline();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.serviceWorker) navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
  });
  history.replaceState({}, "");
  render();
}
init();
