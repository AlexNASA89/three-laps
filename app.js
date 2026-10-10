// Three Laps — интерфейс. Логика в logic.js (чистые функции, тесты logic.test.mjs), хранилище в store.js.
import * as L from "./logic.js";
import * as S from "./store.js";
import { TALK, TALK_FLAT, talkLine, ONBOARD, carIcon, nextIcon } from "./content.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const root = $("#app");
const errs = () => { try { return JSON.parse(localStorage.getItem("tl_errs") || "[]"); } catch { return []; } };
function logErr(m) { const a = errs(); a.push({ ts: Date.now(), m: String(m).slice(0, 300) }); while (a.length > 30) a.shift(); try { localStorage.setItem("tl_errs", JSON.stringify(a)); } catch { /* */ } }
addEventListener("error", (e) => logErr(`${e.message} @${String(e.filename || "").split("/").pop()}:${e.lineno}`));
addEventListener("unhandledrejection", (e) => logErr("promise: " + ((e.reason && e.reason.message) || e.reason)));

const app = {
  data: null, sessions: [], cur: null, screen: "home", stack: [], settings: { theme: "auto", wake: true, vibrate: true, onboarded: false },
  filter: "all", bugs: [], version: "?", select: null, temp: null, draft: null, newDraft: null, toast: null, pre: { n: 0, total: 0, ready: false },
  hold: false, sheet: null, owner: null, exact: false, talkSec: null,
};
const CIRCLE = { 1: "Внешний обход", 2: "Детали и надписи", 3: "Салон и жесты" };
const LABEL = { done: "снято", skipped: "потом", locked: "ждёт доступа", na: "не нужно", auto: "уже открыто", todo: "" };
const LOCK = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h1zm2 0h6V7a3 3 0 0 0-6 0v3z"/></svg>`;
const BADGE = { done: "✓", skipped: "→", locked: LOCK, na: "–", auto: "–", todo: "" };
const NEED = { touch: "разрешение трогать", door: "разрешение открыть дверь", hood: "разрешение открыть капот", engine: "разрешение завести мотор",
  doorOpen: "открытая дверь", hoodOpen: "открытый капот", doorClosed: "закрытая дверь", hoodClosed: "закрытый капот" };
const PERMS = [["touch", "Трогать машину"], ["door", "Открывать дверь"], ["hood", "Открывать капот"], ["engine", "Заводить мотор"]];
const ACCESS = {   // быстрые ответы на «Есть доступ?»
  both: { label: "Да: дверь и капот можно", perms: { touch: true, door: true, hood: true }, cls: "go" },
  door: { label: "Только дверь (салон)", perms: { touch: true, door: true } },
  hood: { label: "Только капот (мотор)", perms: { touch: true, hood: true } },
  none: { label: "Нет доступа (только снаружи)", perms: {} },
};
const theme = () => (app.settings.theme === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : app.settings.theme);
const cardSrc = (n, thumb) => `cards/${theme()}/${thumb ? "thumb/" : ""}${n}.webp`;
const shotOf = (id) => app.data.shots.find((x) => x.id === id);
const buzz = (ms = 15) => { if (app.settings.vibrate && navigator.vibrate) navigator.vibrate(ms); };
const accessText = (s) => { const on = [s.perms.door && "дверь", s.perms.hood && "капот", s.perms.engine && "мотор", s.perms.touch && !s.perms.door && !s.perms.hood && "трогать"].filter(Boolean); return on.length ? on.join(", ") : "нет"; };

// ---------- навигация ----------
function go(screen) {
  if (app.screen !== screen) app.stack.push(app.screen);
  app.screen = screen; app.sheet = null; render(); history.pushState({}, "");
}
function back() {
  const p = app.stack.pop();
  if (!p) { history.pushState({}, ""); return; }
  app.screen = p; app.sheet = null; render(); history.pushState({}, "");
}
addEventListener("popstate", () => {   // системная «Назад»: сначала закрываем лист/белый экран, потом шаг назад; приложение не закрывается
  if (app.owner !== null) { app.owner = null; render(); history.pushState({}, ""); return; }
  if (app.sheet) { app.sheet = null; render(); history.pushState({}, ""); return; }
  back();
});
const remember = () => { try { localStorage.setItem("tl_resume", app.cur && app.screen !== "home" ? app.cur.id : ""); } catch { /* */ } };

// ---------- сессия ----------
async function commit(s) {
  app.cur = s; const i = app.sessions.findIndex((x) => x.id === s.id);
  if (i >= 0) app.sessions[i] = s; else app.sessions.push(s);
  await S.saveSession(s);
}
async function doAct(a, opts = {}) {
  const before = app.cur, lockedBefore = L.lockedList(app.data, before);
  const s = L.act(app.data, before, a); if (s === before) return false;
  await commit(s);
  const unlocked = lockedBefore.filter((i) => !L.lockedList(app.data, s).includes(i) && L.effective(s, shotOf(i)) === "todo");
  if (opts.toast) showToast(opts.toast, "Отменить", () => doUndo());
  if (unlocked.length && ["setPerm", "setState"].includes(a.type)) showToast(`Открылось: ${unlocked.join(", ")}`, "Снять сейчас", () => { app.sheet = null; jump(unlocked[0]); }, 7000);
  return true;
}
async function doUndo() { const s = L.undo(app.cur); if (s !== app.cur) { await commit(s); clearToast(); toNext(true); } }
let tt = null;
function showToast(msg, label, fn, ms = 5000) { app.toast = { msg, label, fn }; render(); clearTimeout(tt); tt = setTimeout(clearToast, ms); }
function clearToast() { app.toast = null; clearTimeout(tt); const t = $(".toast"); if (t) t.remove(); }

function needMap() {   // карта круга — один раз, только для кадров текущего круга (жесты-«открывашки» из 3-го круга карту не вызывают)
  const s = app.cur, sh = s && shotOf(s.cursor);
  if (!sh || s.mapsSeen[sh.circle] || s.modeId === "quick") return false;
  return !s.circleNow || sh.circle === s.circleNow || !L.isProgressive(app.data, s);
}
// куда вести: кадр, временная очередь «подряд» или экран конца очереди
function toNext(keepScreen) {
  const s = app.cur;
  if (app.temp) {
    const rest = app.temp.ids.filter((i) => i !== app.temp.from && ["todo", "skipped"].includes(L.effective(s, shotOf(i))) && !app.temp.seen.includes(i));
    if (rest.length) { app.cur = { ...s, cursor: rest[0] }; app.screen = "frame"; render(); return; }
    const back = app.temp.back; app.temp = null;
    if (back && ["todo", "skipped"].includes(L.effective(s, shotOf(back)))) { app.cur = { ...s, cursor: back }; app.screen = "frame"; render(); return; }
  }
  if (keepScreen && !["frame", "map"].includes(app.screen) && app.screen !== "summary") { render(); return; }
  app.screen = s.cursor ? (needMap() ? "map" : "frame") : (L.endState(app.data, s) || "summary");
  render(); remember();
}
async function shotAction(type, id) {
  if (app.temp) { app.temp.seen.push(id); app.temp.from = id; }
  const ok = await doAct({ type, id }, { toast: { done: "Снято", skip: "Отложено на потом", na: "Не нужен" }[type] });
  if (ok) toNext();
}
function jump(id) { app.cur = { ...app.cur, cursor: id }; commit(app.cur); app.screen = needMap() ? "map" : "frame"; app.sheet = null; render(); history.pushState({}, ""); remember(); }

// ---------- части экранов ----------
const tog = (k, t, on, grp) => `<div class="tog" data-a="tog" data-g="${grp}" data-id="${k}" role="switch" aria-checked="${!!on}"><span>${esc(t)}</span><span class="sw ${on ? "on" : ""}"></span></div>`;
const sheet = (h) => `<div class="sheet-bg" data-a="bg"><div class="sheet" data-a="nop">${h}</div></div>`;
function accessBlock(kind) {   // общий блок «Есть доступ?» для перехода к кругу и для экрана разрешений
  const d = app.draft;
  return `<div class="title" style="margin-top:10px">Есть доступ к машине?</div>
    <div class="small mut">Хозяин разрешил открыть дверь или капот? Если нет — снимем то, что можно снаружи, остальное подождёт в итоге.</div>
    <button class="link" data-a="phrases">Сначала спросить: готовые фразы по-английски ›</button>
    ${["both", "door", "hood", "none"].map((k) => `<button class="btn ${ACCESS[k].cls || (k === "none" ? "" : "ghost")}" data-a="acc" data-id="${k}" data-k="${kind}">${ACCESS[k].label}</button>`).join("")}
    ${tog("engine", "+ можно завести мотор (записать звук)", d.perms.engine, "pdraft")}
    <button class="link" data-a="exact">${app.exact ? "Скрыть подробности" : "Точнее: что разрешено и что уже открыто"}</button>
    ${app.exact ? `<div class="card">${PERMS.map(([k, t]) => tog(k, t, d.perms[k], "pdraft")).join("")}
      <div class="small mut" style="margin-top:8px">УЖЕ ОТКРЫТО (САМ ХОЗЯИН)</div>${tog("doorOpen", "Дверь открыта", d.states.doorOpen, "sdraft")}${tog("hoodOpen", "Капот открыт", d.states.hoodOpen, "sdraft")}
      <button class="btn go" data-a="acc" data-id="exact" data-k="${kind}">Применить и снимать</button></div>` : ""}
`;
}
function segs(s, ids) {   // полоска прогресса: точка = отрезок цвета статуса
  return `<div class="segs">${ids.map((i) => `<i class="${L.effective(s, shotOf(i))} ${i === s.cursor ? "cur" : ""}"></i>`).join("")}</div>`;
}
function rowShot(s, id) {
  const sh = shotOf(id), e = L.effective(s, sh);
  return `<button class="rowshot ${e}" data-a="tile" data-id="${id}"><img src="${cardSrc(sh.card, 1)}" alt=""><span class="grow"><b>${esc(sh.id)} · ${esc(sh.title)}</b><span class="sub">${LABEL[e] || "не снято"}</span></span></button>`;
}
function modeTile(m, on, act) {
  const meta = m.kind === "progressive" ? "3 круга · до 29 точек" : `${m.ids.length} точек · ~${m.minutes} мин`;
  return `<button class="mode ${on ? "on" : ""}" data-a="${act}" data-id="${m.id}"><b>${esc(m.name)}</b> <span class="pill">${meta}</span><span>${esc(m.desc)}</span></button>`;
}

// ---------- экраны ----------
const view = {
  home() {
    const list = [...app.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    const live = list.find((s) => s.status !== "closed");
    const off = app.pre.ready ? "Офлайн готов ✓" : app.pre.total ? `Загрузка для офлайна ${app.pre.n}/${app.pre.total}` : "Работает без интернета";
    const prog = (s) => { const c = L.counts(app.data, s); return `${s.circleNow ? `круг ${s.circleNow} · ` : ""}снято ${c.done}${c.skipped ? ` · потом ${c.skipped}` : ""}`; };
    return `<div class="scr"><h1>Three Laps</h1><div class="mut">Три круга вокруг машины</div><div class="small mut" style="margin:6px 0 12px">${off}</div>
      ${app.update ? `<button class="btn yel" data-a="update">Есть обновление: применить</button>` : ""}
      ${live ? `<div class="card hero" data-a="open" data-id="${live.id}"><div class="row"><div class="ico">${live.photo ? `<img src="${live.photo}" class="phot">` : carIcon(live.icon, 84)}</div>
        <div class="grow"><div class="title">${esc(live.name || "Машина без названия")}</div><div class="sub">${prog(live)}</div></div></div>
        <button class="btn pri" style="margin-bottom:0">Продолжить съёмку</button></div>` : ""}
      <button class="btn dark" data-a="new">Новая съёмка</button>
      ${list.length ? "<h2 style='margin-top:18px'>Мои съёмки</h2>" : `<div class="card mut">Съёмок пока нет. Нажмите «Новая съёмка».</div>`}
      ${list.map((s) => { const stt = s.status === "closed" ? "закрыта" : s.status === "paused" ? "пауза" : "идёт";
        return `<div class="card row"><div class="row grow" data-a="open" data-id="${s.id}"><div class="ico">${s.photo ? `<img src="${s.photo}" class="phot">` : carIcon(s.icon, 84)}</div>
          <div class="grow"><div class="title">${esc(s.name || "Машина без названия")}</div><div class="sub">${prog(s)} · ${stt} · ${new Date(s.updatedAt).toLocaleDateString("ru")}</div></div></div>
          <button class="dots3" data-a="sessmenu" data-id="${s.id}" aria-label="Меню съёмки">⋯</button></div>`; }).join("")}
      <div class="row" style="margin-top:14px"><button class="btn ghost" data-a="settings">Настройки</button><button class="btn ghost" data-a="bug">Заметил ошибку</button></div>
      <div class="small mut" style="text-align:center;margin-top:8px">Всё хранится в вашем телефоне</div></div>`;
  },
  onboard() {
    const i = app.ob || 0; const [t, d] = ONBOARD[i];
    return `<div class="scr center"><div class="dots">${ONBOARD.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
      <h1 style="text-align:center">${esc(t)}</h1><p class="mut" style="text-align:center;font-size:18px">${esc(d)}</p>
      <button class="btn pri" data-a="ob-next">${i === ONBOARD.length - 1 ? "Начать" : "Дальше"}</button><button class="btn ghost" data-a="ob-skip">Пропустить</button></div>`;
  },
  new() {
    const d = app.newDraft, m = L.modeInfo(app.data, d.modeId);
    return `<div class="scr"><h2>Новая съёмка</h2>
      <div class="card"><div class="row"><div class="ico big">${d.photo ? `<img src="${d.photo}" class="phot">` : carIcon(d.icon, 100)}</div>
        <div class="grow"><input type="text" id="nm" placeholder="Название (необязательно)" value="${esc(d.name)}"></div></div>
        <div class="row" style="margin-top:8px"><button class="btn mini" data-a="icon">Другой значок</button><label class="btn mini">Фото<input type="file" accept="image/*" capture="environment" id="ph" hidden></label></div></div>
      <h2>Режим</h2><div class="modes">${app.data.modes.map((x) => modeTile(x, d.modeId === x.id, "mode")).join("")}</div>
      ${m.access === "all" ? `<div class="card small">Всё разрешено: дверь, капот, мотор.</div>` : m.kind === "progressive"
        ? `<div class="card small">Начинаем без доступа. После каждого круга приложение спросит: «Есть доступ?»</div>`
        : `<button class="link" data-a="dexact">${d.exact ? "Скрыть доступ" : "Доступ уже есть? (необязательно)"}</button>${d.exact ? PERMS.map(([k, t]) => tog(k, t, d.perms[k], "dperm")).join("") : ""}`}
      </div><div class="bar"><button class="btn ghost b3" data-a="home">Отмена</button><button class="btn go b1" data-a="start">Поехали ›</button></div>`;
  },
  pre() { return `<div class="top"><div class="p">Перед съёмкой</div></div><div class="cw"><img class="cd" src="${cardSrc(app.data.pre)}" alt=""></div><div class="bar"><button class="btn go b1" data-a="pre-ok">Дальше</button></div>`; },
  map() {
    const c = shotOf(app.cur.cursor).circle;
    return `<div class="top"><div class="p">Круг ${c} · ${CIRCLE[c]}<small>карта обхода</small></div><button class="allbtn" data-a="list">▦ Все кадры</button></div>
      <div class="cw"><img class="cd" src="${cardSrc(app.data.maps[c])}" alt=""></div><div class="bar"><button class="btn go b1" data-a="map-ok">Понятно, начать круг ${c}</button></div>`;
  },
  frame() {
    const s = app.cur, sh = shotOf(s.cursor), e = L.effective(s, sh), ids = L.modeIds(app.data, s);
    const prog = L.isProgressive(app.data, s);
    const inSet = ids.includes(sh.id);
    const circleIds = prog || s.modeId.startsWith("c") ? ids.filter((i) => shotOf(i).circle === sh.circle) : ids;
    const c = L.counts(app.data, s, prog || s.modeId.startsWith("c") ? sh.circle : null);
    const pos = circleIds.indexOf(sh.id) + 1;
    const need = L.needs(s, sh).map((n) => NEED[n.key]);
    const banner = !inSet ? `<div class="lockbar gray">Этот кадр вне текущего набора<button data-a="addextra" data-id="${sh.id}">Добавить</button></div>`
      : e === "locked" ? `<div class="lockbar">Нужно: ${esc(need.join(", "))}</div>`
      : e === "auto" ? `<div class="lockbar gray">Уже открыто — жест снимать не нужно</div>`
      : app.temp ? `<div class="lockbar blue">Подряд: ${app.temp.seen.length + 1} из ${app.temp.ids.length}<button data-a="tempx">Выйти</button></div>` : "";
    const bar = e === "locked" ? `<button class="btn b1 go" data-a="access">Дать доступ</button><button class="btn b2" data-a="gotoq">Следующий ›</button>`
      : e === "done" || e === "auto" || e === "na" ? `<button class="btn pri b1" data-a="gotoq">Дальше ›</button><button class="btn b2" data-a="reset" data-id="${sh.id}">Переснять</button><button class="btn b3" data-a="take" data-id="${sh.id}">Дубль</button>`
      : `<button class="btn go b1" data-a="done" data-id="${sh.id}">✓ Снял</button><button class="btn yel b2" data-a="skip" data-id="${sh.id}">Потом</button><button class="btn b3" data-a="more">Ещё</button>`;
    return `<div class="top"><div class="p">Круг ${sh.circle} · ${pos > 0 ? `${pos} из ${circleIds.length}` : "вне круга"}<small>№${esc(sh.id)} · снято ${c.done} из ${c.total}${c.locked ? ` · ждут доступа ${c.locked}` : ""}${sh.part ? " · " + esc(sh.part.replace(" · ", "")) : ""}</small></div>
        <button class="allbtn" data-a="list">▦ Все кадры</button></div>
      ${segs(s, circleIds)}
      <div class="cw" id="cw">${banner}<img class="cd" src="${cardSrc(sh.card)}" alt="${esc(sh.title)}"></div>
      <div class="bar">${bar}</div>
      <div class="foot"><button data-a="access">Доступ: ${esc(accessText(s))}</button><button data-a="bug">Ошибка</button><button data-a="home">Домой</button></div>`;
  },
  list() {
    const s = app.cur, ids = L.modeIds(app.data, s), f = app.filter, sel = app.select;
    const ok = (sh) => { const e = L.effective(s, sh);
      return f === "all" || (f === "left" && (e === "todo" || e === "skipped")) || (f === "skipped" && e === "skipped") || (f === "done" && e === "done") || (f === "locked" && e === "locked"); };
    const FL = [["all", "Все"], ["left", "Осталось"], ["skipped", "Потом"], ["done", "Снято"], ["locked", "Ждут доступа"]];
    const tile = (sh, out) => { const e = out ? "out" : L.effective(s, sh);
      return `<button class="tile ${e} ${s.cursor === sh.id ? "cur" : ""} ${sel && sel.includes(sh.id) ? "sel" : ""}" data-a="tile" data-id="${sh.id}" ${out ? "" : `data-hold="tile"`}>
        <img loading="lazy" src="${cardSrc(sh.card, 1)}" alt=""><span class="badge">${out ? "" : BADGE[e] || ""}</span><span class="cap"><span>${sh.id}</span><span>${out ? "не начат" : LABEL[e]}</span></span></button>`; };
    const groups = [1, 2, 3].map((c) => {
      const g = ids.map(shotOf).filter((sh) => sh.circle === c && ok(sh)); if (!g.length) return "";
      const cc = L.counts(app.data, s, c);
      return `<div class="ghead">Круг ${c} · ${CIRCLE[c]} <span class="mut">снято ${cc.done} из ${cc.total}</span></div><div class="grid">${g.map((sh) => tile(sh)).join("")}</div>`;
    }).join("");
    const rest = f === "all" ? app.data.shots.filter((x) => !ids.includes(x.id) && s.shots[x.id].status !== "na") : [];
    return `<div class="top"><div class="p">Все кадры<small>режим: ${esc(L.modeName(app.data, s.modeId))}${s.circleNow ? ` · сейчас круг ${s.circleNow}` : ""}</small></div>
        <button class="chip" data-a="modesheet">Режим</button><button class="chip" data-a="${sel ? "selend" : "selbeg"}">${sel ? "Готово" : "Выбрать"}</button></div>
      <div class="scr"><div class="fil">${FL.map(([k, t]) => `<button class="${f === k ? "on" : ""}" data-a="filter" data-id="${k}">${t}</button>`).join("")}</div>
      ${sel ? `<div class="small mut">Отметьте кадры и выберите действие внизу.</div>` : `<div class="small mut">Тап — открыть кадр. Долгое нажатие — сменить статус.</div>`}
      ${f !== "all" && !sel && ids.some((i) => ok(shotOf(i)) && ["todo", "skipped"].includes(L.effective(s, shotOf(i)))) ? `<button class="btn pri" data-a="seq">Снимать эти подряд</button>` : ""}
      ${groups || `<div class="card mut">Здесь пусто.</div>`}
      ${rest.length ? `<div class="ghead">Ещё не начато</div><div class="grid">${rest.map((sh) => tile(sh, true)).join("")}</div>` : ""}</div>
      ${sel ? `<div class="bar"><button class="btn yel b1" data-a="bulk" data-id="skipped">Потом (${sel.length})</button><button class="btn b1" data-a="bulk" data-id="na">Не нужно</button><button class="btn b3" data-a="selend">Отмена</button></div>`
        : `<div class="bar"><button class="btn pri b1" data-a="gotoq">К съёмке</button><button class="btn b2" data-a="finishall">Завершить</button><button class="btn b3" data-a="home">Домой</button></div>`}`;
  },
  stage() {
    const s = app.cur, c = L.nextStage(app.data, s), prev = s.circleNow, pc = L.counts(app.data, s, prev), n = L.stageIds(app.data, s, c).length;
    const hint = c === 2 ? "Снаружи: фары, эмблемы, колёса, фонари, VIN через стекло. С доступом — ещё салон, мотор и таблички." : "Салон и жесты: почти всё требует открыть дверь.";
    return `<div class="scr"><div class="okline">Круг ${prev} готов ✓ <span class="mut">снято ${pc.done}${pc.skipped ? ` · потом ${pc.skipped}` : ""}</span></div>
      <h2>Дальше: круг ${c}</h2><div class="card"><div class="title">${CIRCLE[c]} · ${n} точек</div><div class="sub">${hint}</div></div>
      ${accessBlock("stage")}
      <div class="row"><button class="btn ghost" data-a="list">▦ Все кадры</button><button class="btn ghost" data-a="finishall">Завершить</button></div></div>`;
  },
  perms() {
    const s = app.cur, lk = L.lockedList(app.data, s);
    return `<div class="scr"><h2>Есть доступ?</h2><div class="card"><div class="title">Ждут доступа: ${lk.length}</div><div class="sub">${lk.map((i) => esc(shotOf(i).title)).slice(0, 6).join(", ")}${lk.length > 6 ? "…" : ""}</div></div>
      ${accessBlock("perms")}
      <div class="row"><button class="btn ghost" data-a="list">▦ Все кадры</button><button class="btn ghost" data-a="finishall">Завершить</button></div></div>`;
  },
  skipped() {
    const s = app.cur, sk = L.skippedList(app.data, s).filter((i) => !(s.skipAsk || []).includes(i));
    const all = L.skippedList(app.data, s);
    return `<div class="scr"><h2>${s.circleNow ? `Круг ${s.circleNow}: пропущено ${all.length}` : `Пропущено: ${all.length}`}</h2><div class="small mut">Снять их сейчас или оставить на потом? Вопрос задаётся один раз.</div>
      <div class="rows">${(sk.length ? sk : all).map((i) => rowShot(s, i)).join("")}</div>
      <button class="btn go" data-a="pass">Снять сейчас (${all.length})</button>
      <button class="btn" data-a="skipask">Не сейчас, дальше</button>
      <button class="btn ghost" data-a="giveup">Эти кадры не нужны</button>
      <button class="btn ghost" data-a="finishall">Завершить съёмку</button></div>`;
  },
  summary() {
    const s = app.cur, c = L.counts(app.data, s), ns = L.notStarted(app.data, s).length;
    return `<div class="scr"><h2>Итог · ${esc(s.name || "Машина без названия")}</h2>
      <div class="stat"><div class="g"><b>${c.done}</b>снято</div><div class="y"><b>${c.skipped}</b>потом</div><div class="r"><b>${c.locked}</b>ждут доступа</div><div><b>${ns || c.na + c.auto}</b>${ns ? "не начато" : "не нужно"}</div></div>
      ${L.hasMore(app.data, s) ? `<button class="btn pri" data-a="resumeshoot">Вернуться к съёмке</button>` : `<div class="okline">Всё снято ✓</div>`}
      ${c.skipped ? `<button class="btn go" data-a="pass">Снять пропущенное (${c.skipped})</button>` : ""}
      ${c.locked ? `<button class="btn" data-a="perms">Появился доступ?</button>` : ""}
      <button class="btn" data-a="qs">Разговор с хозяином (вопросы, ответы)</button>
      <div class="row"><button class="btn" data-a="copy">Скопировать итог</button><button class="btn" data-a="savefile">Файл</button></div>
      <div class="row"><button class="btn" data-a="pause">Пауза</button><button class="btn dark" data-a="close">Закрыть съёмку</button></div>
      <button class="btn ghost" data-a="list">▦ Все кадры</button></div>`;
  },
  talk() {
    const s = app.cur, nm = app.settings.myName;
    const chips = TALK.map((sec) => `<button data-a="talkgo" data-id="${sec.id}">${esc(sec.title)}</button>`).join("");
    const body = TALK.map((sec) => `<div class="ghead" id="sec-${sec.id}">${esc(sec.title)}</div>${sec.tip ? `<div class="small mut">${esc(sec.tip)}</div>` : ""}
      ${sec.lines.map((l0) => { const l = talkLine(l0, nm), v = (s && s.qs[l.id]) || {}, k = TALK_FLAT.findIndex((x) => x.id === l.id);
        return `<div class="ph ${l.q ? "q" : ""}"><div class="en">${esc(l.en)}</div><div class="ru">${esc(l.ru)}</div>
          <div class="row" style="margin-top:8px"><button class="btn" style="min-height:48px;margin:0" data-a="owner" data-id="${k}">Показать хозяину</button>
          ${l.q && s ? `<label class="chk"><input type="checkbox" data-q="${l.id}" data-f="asked" ${v.asked ? "checked" : ""}> спросил</label>` : ""}</div>
          ${l.q && s ? `<textarea data-q="${l.id}" data-f="answer" rows="2" placeholder="Ответ (можно голосом с клавиатуры)">${esc(v.answer || "")}</textarea>` : ""}</div>`; }).join("")}`).join("");
    return `<div class="top"><div class="p">Разговор с хозяином<small>читайте с экрана или покажите крупно</small></div><button class="chip" data-a="back">Готово</button></div>
      <div class="fil pad">${chips}</div><div class="scr" id="talkscr">${nm ? "" : `<div class="card small">Совет: впишите своё имя в Настройках — оно появится во фразе знакомства.</div>`}${body}
      <button class="btn" data-a="back">Назад</button></div>`;
  },
  bugs() {
    return `<div class="scr"><h2>Ошибки и заметки</h2><div class="small mut">То, что вы заметили при проверке. Потом «Подготовить логи», скопировать и прислать.</div>
      ${app.bugs.length ? app.bugs.slice().reverse().map((b) => `<div class="phot"><div class="small mut">${new Date(b.ts).toLocaleString("ru")} · ${esc(b.screen)}${b.shot ? " · №" + esc(b.shot) : ""}${b.car ? " · " + esc(b.car) : ""}</div><div>${esc(b.text)}</div><button class="btn ghost" style="min-height:44px;margin:8px 0 0" data-a="bugdel" data-id="${b.id}">Удалить</button></div>`).join("") : `<div class="card mut">Пока пусто.</div>`}
      <button class="btn" data-a="bug">Добавить заметку</button><button class="btn go" data-a="logs">Подготовить логи</button><button class="btn ghost" data-a="back">Назад</button></div>`;
  },
  settings() {
    const st = app.settings;
    return `<div class="scr"><h2>Настройки</h2><div class="small mut">ТЕМА</div><div class="row">${["auto", "light", "dark"].map((t) => `<button class="btn ${st.theme === t ? "pri" : ""}" style="margin:6px 0" data-a="theme" data-id="${t}">${{ auto: "Авто", light: "Светлая", dark: "Тёмная" }[t]}</button>`).join("")}</div>
      <div class="small mut" style="margin-top:10px">ВАШЕ ИМЯ ДЛЯ ЗНАКОМСТВА (по-английски)</div><input type="text" id="myname" placeholder="Например: Alex" value="${esc(st.myName || "")}">
      ${tog("wake", "Экран не гаснет на кадре", st.wake, "set")}${tog("vibrate", "Вибрация", st.vibrate, "set")}
      <button class="btn" data-a="bugs" style="margin-top:12px">Ошибки и заметки (${app.bugs.length})</button><button class="btn go" data-a="logs">Подготовить логи</button>
      <button class="btn" data-a="export">Сохранить все данные файлом</button><button class="btn" data-a="refresh">Проверить обновление</button><button class="btn ghost" data-a="replayob">Показать подсказки снова</button>
      <div class="small mut" style="margin-top:12px">Версия ${esc(app.version)}. Всё хранится в телефоне, без аккаунтов и аналитики. Снимайте с разрешения владельца и будьте внимательны вокруг машин и людей.</div>
      <button class="btn ghost" data-a="back">Назад</button></div>`;
  },
};

function sheets() {
  const s = app.cur;
  if (app.sheet === "more") { const sh = shotOf(s.cursor);
    return sheet(`<h2>№${sh.id} ${esc(sh.title)}</h2><button class="btn" data-a="na" data-id="${sh.id}">Этот кадр не нужен</button><button class="btn" data-a="take" data-id="${sh.id}">Снял ещё дубль</button>
      <button class="btn" data-a="note">Заметка${s.shots[sh.id].note ? ": " + esc(s.shots[sh.id].note) : ""}</button><button class="btn" data-a="access">Доступ и «хозяин уже открыл»</button>
      <button class="btn" data-a="talk" data-id="hello">Разговор с хозяином</button><button class="btn" data-a="undo">Отменить последнее</button><button class="btn" data-a="bug">Заметил ошибку</button>
      <button class="btn ghost" data-a="finishall">Завершить съёмку</button><button class="btn ghost" data-a="closesheet">Закрыть</button>`); }
  if (app.sheet === "bug") return sheet(`<h2>Заметил ошибку</h2><div class="small mut">Что не так? Сохранится вместе с экраном и кадром.</div><textarea id="bugtxt" rows="5" placeholder="Например: кнопка «Снял» не нажимается на кадре 7"></textarea><button class="btn go" data-a="bugsave">Сохранить</button><button class="btn ghost" data-a="closesheet">Отмена</button>`);
  if (app.sheet && app.sheet.t === "logs") return sheet(`<h2>Логи</h2><div class="small mut">Скопируйте и пришлите мне.</div><textarea id="logtxt" rows="12" readonly style="font-size:12px">${esc(app.sheet.text)}</textarea><button class="btn go" data-a="logcopy">Скопировать</button><button class="btn" data-a="logfile">Сохранить файл</button><button class="btn ghost" data-a="closesheet">Закрыть</button>`);
  if (app.sheet === "access") return sheet(`<h2>Доступ</h2><div class="small mut">Что разрешил хозяин. Можно менять в любой момент, снятое не пропадёт.</div>${PERMS.map(([k, t]) => tog(k, t, s.perms[k], "perm")).join("")}
      <div class="small mut" style="margin-top:10px">УЖЕ ОТКРЫТО (САМ ХОЗЯИН)</div>${tog("doorOpen", "Дверь открыта", s.states.doorOpen, "state")}${tog("hoodOpen", "Капот открыт", s.states.hoodOpen, "state")}
      <button class="btn" data-a="allaccess" style="margin-top:8px">Своя машина: всё разрешено</button><button class="btn go" data-a="closesheet">Готово</button>`);
  if (app.sheet === "modes") return sheet(`<h2>Режим</h2><div class="small mut">Меняет только набор кадров. Снятое и доступ остаются.</div><div class="modes">${app.data.modes.map((m) => modeTile(m, s.modeId === m.id, "setmode")).join("")}</div><button class="btn ghost" data-a="closesheet">Закрыть</button>`);
  if (app.sheet && app.sheet.t === "tile") { const sh = shotOf(app.sheet.id), inSet = L.modeIds(app.data, s).includes(sh.id);
    return sheet(`<h2>№${sh.id} ${esc(sh.title)}</h2><div class="small mut">Сейчас: ${LABEL[L.effective(s, sh)] || "не снято"}</div>
      <button class="btn go" data-a="tset" data-id="done">Снято</button><button class="btn yel" data-a="tset" data-id="skipped">Потом</button><button class="btn" data-a="tset" data-id="na">Не нужно</button><button class="btn" data-a="tset" data-id="todo">Вернуть в очередь</button>
      ${inSet ? "" : `<button class="btn" data-a="tset" data-id="extra">Добавить в съёмку</button>`}<button class="btn ghost" data-a="closesheet">Закрыть</button>`); }
  if (app.sheet && app.sheet.t === "sess") return sheet(`<h2>${esc(app.sheet.name || "Машина без названия")}</h2><button class="btn" data-a="rename" data-id="${app.sheet.id}">Переименовать</button><button class="btn" data-a="sclose" data-id="${app.sheet.id}">Закрыть съёмку</button><button class="btn danger" data-a="sdel" data-id="${app.sheet.id}">Удалить</button><button class="btn ghost" data-a="closesheet">Отмена</button>`);
  return "";
}

function render() {
  document.documentElement.dataset.theme = theme();
  if (app.cur && ["frame", "map"].includes(app.screen) && !app.cur.cursor) app.screen = L.endState(app.data, app.cur) || "summary";
  if (app.screen === "stage" && !L.nextStage(app.data, app.cur)) app.screen = L.endState(app.data, app.cur) || "summary";
  if (["perms", "stage"].includes(app.screen) && app.cur && app.lastScr !== app.screen) { app.draft = { perms: { ...app.cur.perms }, states: { ...app.cur.states } }; app.exact = false; }
  app.lastScr = app.screen;
  const v = view[app.screen] || view.home;
  const sc = $(".scr"), keep = sc ? sc.scrollTop : 0, same = root.dataset.scr === app.screen;
  root.dataset.scr = app.screen;
  root.innerHTML = v() + sheets()
    + (app.toast ? `<div class="toast ${["frame", "map", "pre"].includes(app.screen) ? "" : "top"}"><span>${esc(app.toast.msg)}</span>${app.toast.label ? `<button data-a="toast">${esc(app.toast.label)}</button>` : ""}</div>` : "")
    + (app.owner !== null ? (() => { const l = talkLine(TALK_FLAT[app.owner], app.settings.myName); return `<div class="owner"><div class="en">${esc(l.en)}</div><div class="ru">${esc(l.ru)}</div>
      <div class="ownerbar"><button data-a="ownerp" ${app.owner ? "" : "disabled"}>‹</button><button data-a="ownerx">Закрыть</button><button data-a="ownern" ${app.owner < TALK_FLAT.length - 1 ? "" : "disabled"}>›</button></div></div>`; })() : "");
  if (same) { const n = $(".scr"); if (n) n.scrollTop = keep; }
  if (app.screen === "frame") { wake(); const cw = $("#cw"); if (cw) swipe(cw); } else unwake();
  const nm = $("#nm"); if (nm) nm.oninput = () => (app.newDraft.name = nm.value);
  const ph = $("#ph"); if (ph) ph.onchange = () => photo(ph.files[0]);
  root.querySelectorAll("[data-q]").forEach((el) => (el.onchange = () => { const v2 = el.dataset.f === "asked" ? { asked: el.checked } : { answer: el.value, asked: true }; doAct({ type: "answer", q: el.dataset.q, v: v2 }); }));
  const mn = $("#myname"); if (mn) mn.onchange = () => { app.settings.myName = mn.value.trim(); S.setKV("settings", app.settings); };
  if (app.screen === "talk" && app.talkSec) { const el = document.getElementById("sec-" + app.talkSec); app.talkSec = null; if (el) el.scrollIntoView({ block: "start" }); }
}

// ---------- события ----------
let hold = null, held = false;
root.addEventListener("pointerdown", (e) => { const t = e.target.closest("[data-hold]"); held = false; if (!t) return; hold = setTimeout(() => { held = true; buzz(25); app.sheet = { t: "tile", id: t.dataset.id }; render(); }, 550); });
["pointerup", "pointercancel", "pointermove", "scroll"].forEach((ev) => root.addEventListener(ev, () => clearTimeout(hold), true));
root.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-a]"); if (!t) return; if (held) { held = false; return; }
  const a = t.dataset.a, id = t.dataset.id; if (a === "nop") return;
  if (a === "bg") { if (e.target === t) { app.sheet = null; render(); } return; }
  try { await handle(a, id, t); } catch (err) { logErr(`${a}: ${err && err.message}`); showToast("Что-то пошло не так — записано в логи", "", null, 3000); }
});
async function handle(a, id, t) {
  const s = app.cur;
  switch (a) {
    case "home": app.stack = []; app.temp = null; app.sheet = null; if (s && s.status === "active") await commit({ ...s, status: "paused" }); app.cur = null; app.screen = "home"; remember(); render(); history.pushState({}, ""); break;
    case "settings": go("settings"); break;
    case "back": back(); break;
    case "update": app.updating = true; navigator.serviceWorker.getRegistration().then((r) => { if (r && r.waiting) r.waiting.postMessage("skipWaiting"); }); break;
    case "refresh": { app.updating = true; const r = await navigator.serviceWorker.getRegistration(); if (r) { await r.update(); if (r.waiting) r.waiting.postMessage("skipWaiting"); else showToast("Установлена последняя версия", "", null, 2500); } break; }
    case "theme": app.settings.theme = id; await S.setKV("settings", app.settings); render(); break;
    case "tog": toggle(t.dataset.g, id); break;
    case "replayob": app.ob = 0; app.screen = "onboard"; render(); break;
    case "ob-next": app.ob = (app.ob || 0) + 1; if (app.ob >= ONBOARD.length) { app.settings.onboarded = true; S.setKV("settings", app.settings); app.screen = "home"; } render(); break;
    case "ob-skip": app.settings.onboarded = true; S.setKV("settings", app.settings); app.screen = "home"; render(); break;
    case "new": app.newDraft = { name: "", icon: nextIcon(-1), photo: null, modeId: "first", exact: false, perms: { touch: false, door: false, hood: false, engine: false } }; go("new"); break;
    case "icon": app.newDraft.icon = nextIcon(app.newDraft.icon); app.newDraft.photo = null; render(); break;
    case "mode": app.newDraft.modeId = id; render(); break;
    case "dexact": app.newDraft.exact = !app.newDraft.exact; render(); break;
    case "start": { const d = app.newDraft; const m = L.modeInfo(app.data, d.modeId);
      const ns = L.newSession(app.data, { name: d.name.trim(), icon: d.icon, perms: m.kind === "fixed" ? d.perms : null, modeId: d.modeId }); ns.photo = d.photo;
      await commit(ns); app.stack = []; app.screen = "home"; go("pre"); remember(); break; }
    case "open": { const x = app.sessions.find((q) => q.id === id); if (!x) break;
      app.cur = { ...x, status: "active" }; if (x.status === "closed") app.cur = L.act(app.data, app.cur, { type: "resume" });
      await commit(app.cur); app.stack = ["home"];
      if (!app.cur.preSeen) { app.screen = "pre"; render(); } else toNext(); history.pushState({}, ""); break; }
    case "sessmenu": { const x = app.sessions.find((q) => q.id === id); app.sheet = { t: "sess", id: x.id, name: x.name }; render(); break; }
    case "pre-ok": await doAct({ type: "preSeen" }); toNext(); break;
    case "map-ok": await doAct({ type: "mapSeen", circle: shotOf(app.cur.cursor).circle }); app.screen = "frame"; render(); break;
    case "done": if (app.hold) break; app.hold = true; setTimeout(() => { app.hold = false; }, 900); buzz(); await shotAction("done", id); break;
    case "skip": buzz(); await shotAction("skip", id); break;
    case "na": app.sheet = null; await shotAction("na", id); break;
    case "take": app.sheet = null; await doAct({ type: "take", id }, { toast: "Дубль записан" }); render(); break;
    case "reset": await doAct({ type: "reset", id }, { toast: "Вернули в очередь" }); render(); break;
    case "more": app.sheet = "more"; render(); break;
    case "closesheet": app.sheet = null; render(); break;
    case "note": { const sh = shotOf(s.cursor); const v = prompt("Заметка к кадру", s.shots[sh.id].note || ""); app.sheet = null; if (v !== null) await doAct({ type: "note", id: sh.id, text: v }); render(); break; }
    case "undo": app.sheet = null; await doUndo(); break;
    case "access": app.sheet = "access"; render(); break;
    case "allaccess": for (const k of L.PERMS) await doAct({ type: "setPerm", key: k, value: true }); render(); break;
    case "addextra": await doAct({ type: "addExtra", id }, { toast: "Добавлено в съёмку" }); render(); break;
    case "gotoq": { app.temp = null; const q = L.nextAfter(app.data, { ...s }, s.cursor) || L.queue(app.data, s)[0];
      if (q) jump(q); else { app.cur = { ...s, cursor: null }; toNext(); } break; }
    case "tempx": app.temp = null; render(); break;
    case "list": app.select = null; go("list"); break;
    case "filter": app.filter = id; render(); break;
    case "tile": if (app.select) { const i = app.select.indexOf(id); if (i >= 0) app.select.splice(i, 1); else app.select.push(id); render(); } else jump(id); break;
    case "selbeg": app.select = []; render(); break;
    case "selend": app.select = null; render(); break;
    case "bulk": { const ids = app.select.slice(); app.select = null; if (ids.length) await doAct({ type: "bulk", ids, to: id }, { toast: "Готово" }); render(); break; }
    case "seq": { const f = app.filter; const ids = L.modeIds(app.data, s).filter((i) => { const e = L.effective(s, shotOf(i)); return ["todo", "skipped"].includes(e) && (f === "all" || f === "left" || (f === "skipped" && e === "skipped")); });
      if (!ids.length) break; app.temp = { ids, seen: [], back: s.cursor, from: null }; jump(ids[0]); break; }
    case "modesheet": app.sheet = "modes"; render(); break;
    case "setmode": app.sheet = null; await doAct({ type: "setMode", modeId: id }, { toast: "Режим сменён" }); render(); break;
    case "tset": { const sh = app.sheet.id; app.sheet = null;
      if (id === "extra") await doAct({ type: "addExtra", id: sh }); else if (id === "todo") await doAct({ type: "reset", id: sh }); else await doAct({ type: id === "done" ? "done" : id === "skipped" ? "skip" : "na", id: sh });
      app.cur = { ...app.cur, cursor: s.cursor }; render(); break; }
    case "exact": app.exact = !app.exact; render(); break;
    case "acc": {   // ответ на «Есть доступ?» (data-k: stage | perms)
      const kind = t.dataset.k, d = app.draft;
      const perms = id === "exact" ? { ...d.perms } : { touch: false, door: false, hood: false, ...ACCESS[id].perms, engine: d.perms.engine };
      const states = id === "exact" ? { ...d.states } : {};
      if (kind === "stage") await doAct({ type: "addStage", circle: L.nextStage(app.data, app.cur), perms, states });
      else await doAct({ type: "applyAccess", perms, states, answered: true });
      app.stack = []; toNext(); break; }
    case "skipask": await doAct({ type: "skipAsked" }); toNext(); break;
    case "pass": await doAct({ type: "enterPass" }); toNext(); break;
    case "giveup": await doAct({ type: "giveUp" }, { toast: "Убрали из съёмки" }); toNext(); break;
    case "finishall": app.sheet = null; app.temp = null; await doAct({ type: "finishAll" }); app.screen = "summary"; render(); break;
    case "resumeshoot": await doAct({ type: "resume" }); toNext(); break;
    case "perms": go("perms"); break;
    case "phrases": app.sheet = null; app.talkSec = "access"; go("talk"); break;
    case "talk": app.sheet = null; app.talkSec = id || "hello"; go("talk"); break;
    case "talkgo": { const el = document.getElementById("sec-" + id); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); break; }
    case "owner": app.owner = +id; render(); history.pushState({}, ""); break;
    case "ownerp": app.owner = Math.max(0, app.owner - 1); render(); break;
    case "ownern": app.owner = Math.min(TALK_FLAT.length - 1, app.owner + 1); render(); break;
    case "ownerx": app.owner = null; render(); break;
    case "qs": app.talkSec = "car"; go("talk"); break;
    case "pause": await doAct({ type: "setStatus", value: "paused" }); await handle("home"); break;
    case "close": await doAct({ type: "setStatus", value: "closed" }); await handle("home"); break;
    case "copy": { const txt = fullSummary(s); try { await navigator.clipboard.writeText(txt); showToast("Итог скопирован", "", null, 2500); } catch { prompt("Скопируйте итог", txt); } break; }
    case "savefile": download(`three-laps-${(s.name || "car").replace(/[^\wа-яё]+/gi, "_")}.txt`, fullSummary(s)); break;
    case "export": download("three-laps-backup.json", JSON.stringify(app.sessions)); break;
    case "rename": { const x = app.sessions.find((q) => q.id === id); const v = prompt("Название", x.name || ""); app.sheet = null; if (v !== null) await commit({ ...x, name: v.trim() }); app.cur = null; render(); break; }
    case "sclose": { const x = app.sessions.find((q) => q.id === id); app.sheet = null; await commit({ ...x, status: "closed" }); app.cur = null; render(); break; }
    case "sdel": { if (confirm("Удалить съёмку? Вернуть будет нельзя.")) { await S.deleteSession(id); app.sessions = app.sessions.filter((q) => q.id !== id); } app.sheet = null; app.cur = null; render(); break; }
    case "bug": app.sheet = "bug"; render(); setTimeout(() => { const x = $("#bugtxt"); if (x) x.focus(); }, 80); break;
    case "bugsave": { const txt = ($("#bugtxt") || {}).value || ""; if (!txt.trim()) break;
      app.bugs.push({ id: "b" + Date.now().toString(36), ts: Date.now(), screen: app.screen, shot: app.cur && app.cur.cursor, car: app.cur && app.cur.name, text: txt.trim() });
      await S.setKV("bugs", app.bugs); app.sheet = null; showToast("Заметка сохранена", "", null, 2500); break; }
    case "bugdel": app.bugs = app.bugs.filter((b) => b.id !== id); await S.setKV("bugs", app.bugs); render(); break;
    case "bugs": go("bugs"); break;
    case "logs": app.sheet = { t: "logs", text: await buildLogs() }; render(); break;
    case "logcopy": { const x = $("#logtxt"); try { await navigator.clipboard.writeText(app.sheet.text); } catch { x.select(); document.execCommand("copy"); } showToast("Скопировано", "", null, 2000); break; }
    case "logfile": download("three-laps-logs.txt", app.sheet.text); break;
    case "toast": { const f = app.toast && app.toast.fn; clearToast(); if (f) f(); break; }
  }
}
function fullSummary(s) {   // итог + ответы хозяина (вопрос по-русски)
  const qa = TALK_FLAT.filter((l) => l.q && s.qs[l.id] && (s.qs[l.id].asked || s.qs[l.id].answer));
  return L.summaryText(app.data, { ...s, qs: {} }) + (qa.length ? "\n\nРазговор с хозяином:\n" + qa.map((l) => `• ${l.ru}\n  ${s.qs[l.id].answer || "(спросил, ответ не записан)"}`).join("\n") : "");
}
function toggle(g, k) {
  if (g === "dperm") { app.newDraft.perms[k] = !app.newDraft.perms[k]; render(); }
  else if (g === "pdraft") { app.draft.perms[k] = !app.draft.perms[k]; render(); }
  else if (g === "sdraft") { app.draft.states[k] = !app.draft.states[k]; render(); }
  else if (g === "perm") doAct({ type: "setPerm", key: k, value: !app.cur.perms[k] }).then(render);
  else if (g === "state") doAct({ type: "setState", key: k, value: !app.cur.states[k] }).then(render);
  else if (g === "set") { app.settings[k] = !app.settings[k]; S.setKV("settings", app.settings); render(); }
}
async function buildLogs() {
  let persisted = "?"; try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : "n/a"; } catch { /* */ }
  const o = [`Three Laps · логи · ${new Date().toLocaleString("ru")}`, `версия: ${app.version}`, `экран: ${app.screen} · окно ${innerWidth}×${innerHeight} · тема ${theme()} · офлайн готов: ${app.pre.ready} · хранилище постоянное: ${persisted}`, `устройство: ${navigator.userAgent}`, ""];
  o.push(`ЗАМЕТКИ (${app.bugs.length}):`);
  for (const b of app.bugs) o.push(`- ${new Date(b.ts).toLocaleString("ru")} · ${b.screen}${b.shot ? " · №" + b.shot : ""}${b.car ? " · " + b.car : ""}: ${b.text}`);
  o.push("", `ОШИБКИ JS (${errs().length}):`);
  for (const e of errs()) o.push(`- ${new Date(e.ts).toLocaleTimeString("ru")} ${e.m}`);
  o.push("", "СЪЁМКИ:");
  for (const s of app.sessions) {
    const c = L.counts(app.data, s);
    o.push(`- ${s.name || "без названия"} · ${s.modeId}${s.circleNow ? " круг " + s.circleNow : ""} · ${s.status} · снято ${c.done}, потом ${c.skipped}, заперто ${c.locked}, не нужно ${c.na + c.auto} · разрешения ${Object.entries(s.perms).filter(([, v]) => v).map(([k]) => k).join("+") || "нет"} · дверь ${s.states.doorOpen ? "откр" : "закр"}, капот ${s.states.hoodOpen ? "откр" : "закр"} · курсор ${s.cursor}`);
    o.push(`  действия: ${s.events.map((e) => e.type).join(", ")}`);
  }
  return o.join("\n");
}
function download(name, text) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
async function photo(f) {
  if (!f) return; const img = await createImageBitmap(f); const c = document.createElement("canvas"); c.width = 192; c.height = 120;
  const x = c.getContext("2d"); const r = Math.max(192 / img.width, 120 / img.height);
  x.drawImage(img, (192 - img.width * r) / 2, (120 - img.height * r) / 2, img.width * r, img.height * r); app.newDraft.photo = c.toDataURL("image/webp", 0.7); render();
}
// свайп только листает (статус не меняет)
function swipe(el) {
  let x0 = 0, y0 = 0;
  el.ontouchstart = (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; };
  el.ontouchend = (e) => { const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; if (Math.abs(dx) > 90 && Math.abs(dy) < 60) { const n = L.neighbor(app.data, app.cur, app.cur.cursor, dx < 0 ? 1 : -1); if (n) jump(n); } };
}
// экран не гаснет только на кадре
let wl = null;
async function wake() { if (!app.settings.wake || wl || !navigator.wakeLock) return; try { wl = await navigator.wakeLock.request("screen"); wl.onrelease = () => { wl = null; }; } catch { /* */ } }
function unwake() { if (wl) { wl.release().catch(() => {}); wl = null; } }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && app.screen === "frame") wake(); });

async function checkOffline() {
  try {
    const m = await (await fetch("precache.json", { cache: "no-store" })).json(); const c = await caches.open("threelaps-" + m.version);
    const n = (await c.keys()).length; app.pre = { n, total: m.files.length, ready: n >= m.files.length };
    if (app.pre.ready) localStorage.setItem("tl_offline", m.version); else setTimeout(checkOffline, 2500);
    if (app.screen === "home") render();
  } catch { /* нет сети или SW ещё не готов */ }
}
// ---------- старт ----------
async function init() {
  app.data = await (await fetch("shots.json")).json();
  app.settings = { ...app.settings, ...(await S.getKV("settings", {})) };
  app.sessions = (await S.allSessions()).filter((s) => s && s.shots && app.data.shots.every((x) => s.shots[x.id]));
  app.bugs = await S.getKV("bugs", []); S.persist();
  try { app.version = (await (await fetch("precache.json")).json()).version; } catch { /* */ }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (app.updating) location.reload(); });
    navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.type === "precache") { app.pre = { n: e.data.n, total: e.data.total, ready: e.data.n >= e.data.total }; if (app.pre.ready) try { localStorage.setItem("tl_offline", e.data.version); } catch { /* */ } if (app.screen === "home") render(); } });
    navigator.serviceWorker.register("sw.js").then((r) => { r.addEventListener("updatefound", () => { const w = r.installing; w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) { app.update = true; if (app.screen === "home") render(); } }); }); }).catch(() => {});
    if (localStorage.getItem("tl_offline")) app.pre.ready = true;
    checkOffline();
  }
  history.replaceState({}, ""); history.pushState({}, "");
  if (!app.settings.onboarded) app.screen = "onboard";
  const rid = localStorage.getItem("tl_resume");
  const rs = rid && app.sessions.find((x) => x.id === rid && x.status !== "closed");
  if (rs && app.settings.onboarded) { app.cur = rs; app.stack = ["home"]; if (!rs.preSeen) app.screen = "pre"; else toNext(); return; }
  render();
}
init();
window.__tl = { app, L, render, handle };
