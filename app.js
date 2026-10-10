// Three Laps — интерфейс. Логика в logic.js, хранилище в store.js.
import * as L from "./logic.js";
import * as S from "./store.js";
import { PHRASES, TIPS, QUESTIONS, ONBOARD, carIcon, nextIcon } from "./content.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const root = $("#app");
const errs = () => { try { return JSON.parse(localStorage.getItem("tl_errs") || "[]"); } catch { return []; } };
function logErr(m) { const a = errs(); a.push({ ts: Date.now(), m: String(m).slice(0, 300) }); while (a.length > 30) a.shift(); try { localStorage.setItem("tl_errs", JSON.stringify(a)); } catch { /* */ } }
addEventListener("error", (e) => logErr(`${e.message} @${String(e.filename || "").split("/").pop()}:${e.lineno}`));
addEventListener("unhandledrejection", (e) => logErr("promise: " + ((e.reason && e.reason.message) || e.reason)));
const app = { data: null, sessions: [], cur: null, screen: "home", stack: [], settings: { theme: "auto", wake: true, vibrate: true, onboarded: false },
  filter: "all", bugs: [], version: "?", select: null, temp: null, draft: null, newDraft: null, toast: null, pre: { n: 0, total: 0, ready: false }, wait: false, hold: false, sheet: null };
const LABEL = { done: "снято", skipped: "потом", locked: "заперто", na: "не нужно", auto: "уже открыто", todo: "" };
const BADGE = { done: "✓", skipped: "→", locked: "L", na: "–", auto: "–", todo: "" };
const PERMTXT = { touch: "разрешение трогать машину", door: "разрешение открывать дверь", hood: "разрешение открывать капот", engine: "разрешение завести мотор",
  doorOpen: "открытая дверь", hoodOpen: "открытый капот", doorClosed: "закрытая дверь", hoodClosed: "закрытый капот" };
const PERMS = [["touch", "Трогать машину"], ["door", "Открывать дверь"], ["hood", "Открывать капот"], ["engine", "Заводить мотор"]];
const PCHIP = { touch: "Трогать", door: "Дверь", hood: "Капот", engine: "Мотор" };
const theme = () => (app.settings.theme === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : app.settings.theme);
const cardSrc = (n, thumb) => `cards/${theme()}/${thumb ? "thumb/" : ""}${n}.webp`;
const shotOf = (id) => app.data.shots.find((x) => x.id === id);
const buzz = (ms = 15) => { if (app.settings.vibrate && navigator.vibrate) navigator.vibrate(ms); };

// ---------- навигация ----------
function go(screen, replace) {
  if (!replace && app.screen !== screen) app.stack.push(app.screen);
  app.screen = screen; app.sheet = null; render(); history.pushState({ t: Date.now() }, "");
  try { localStorage.setItem("tl_resume", screen === "frame" && app.cur ? app.cur.id : ""); } catch { /* */ }
}
function back() { const p = app.stack.pop(); if (!p) { history.pushState({}, ""); return; } app.screen = p; app.sheet = null; render(); history.pushState({}, ""); }
addEventListener("popstate", () => { if (app.owner) { app.owner = null; render(); history.pushState({}, ""); return; } if (app.sheet) { app.sheet = null; render(); history.pushState({}, ""); return; } back(); });

// ---------- сессия ----------
async function commit(s) { app.cur = s; const i = app.sessions.findIndex((x) => x.id === s.id); if (i >= 0) app.sessions[i] = s; else app.sessions.push(s); await S.saveSession(s); }
async function doAct(a, opts = {}) {
  const before = app.cur; const lockedBefore = L.lockedList(app.data, before);
  const s = L.act(app.data, before, a); if (s === before) return false; await commit(s);
  const lockedAfter = L.lockedList(app.data, s);
  const unlocked = lockedBefore.filter((i) => !lockedAfter.includes(i));
  if (opts.toast !== false) showToast(opts.msg || toastMsg(a), "Отменить", () => doUndo());
  if (unlocked.length && ["setPerm", "setState"].includes(a.type)) showToast(`Открылось: ${unlocked.join(", ")}`, "Снять сейчас", () => { app.sheet = null; jump(unlocked[0]); }, 7000);
  return true;
}
function toastMsg(a) {
  const m = { done: "Снято", skip: "Отложено", na: "Не нужен", reset: "Вернули в очередь", take: "Дубль записан", setPerm: "Доступ изменён", setState: "Отмечено", setMode: "Режим сменён", bulk: "Готово", giveUp: "Пропущенное снято с очереди" };
  return m[a.type] || "Готово";
}
async function doUndo() { const s = L.undo(app.cur); if (s !== app.cur) { await commit(s); clearToast(); render(); } }
let tt = null;
function showToast(msg, label, fn, ms = 5000) { app.toast = { msg, label, fn }; render(); clearTimeout(tt); tt = setTimeout(clearToast, ms); }
function clearToast() { app.toast = null; clearTimeout(tt); const t = $(".toast"); if (t) t.remove(); }

function flow() {   // куда вести после действия
  const s = app.cur;
  if (app.temp) { const i = app.temp.i + 1; if (i < app.temp.ids.length) { app.temp.i = i; s.cursor = app.temp.ids[i]; return "frame"; } const back = app.temp.back; app.temp = null; if (back) { app.cur = { ...s, cursor: back }; return "frame"; } }
  if (s.cursor) return "frame";
  const e = L.endState(app.data, s);
  return e || "frame";
}
async function afterAct(a) { const ok = await doAct(a); if (!ok) return; const f = flow(); app.screen = f === "frame" && !app.cur.cursor ? "summary" : f; if (app.screen === "frame" && needMap()) app.screen = "map"; render(); }
function needMap() { const sh = shotOf(app.cur.cursor); return sh && !app.cur.mapsSeen[sh.circle] && !["map"].includes(app.screen) && sh.circle; }
function jump(id) { app.cur = { ...app.cur, cursor: id }; commit(app.cur); app.screen = "frame"; if (needMap()) app.screen = "map"; render(); history.pushState({}, ""); }

// ---------- экраны ----------
function frameCounts() { const c = L.counts(app.data, app.cur); return c; }
const view = {
  home() {
    const live = app.sessions.filter((s) => s.status !== "closed").sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const list = [...app.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    return `<div class="scr"><h1>Three Laps</h1><div class="mut">Три круга вокруг машины</div>
      <div class="small mut" style="margin:6px 0 12px">${app.pre.ready ? "Офлайн готов ✓" : app.pre.total ? `Загрузка для офлайна ${app.pre.n}/${app.pre.total}` : "Работает без интернета"}</div>
      ${app.update ? `<button class="btn yel" data-a="update">Есть обновление: применить</button>` : ""}
      ${live ? `<button class="btn pri" data-a="open" data-id="${live.id}">Продолжить: ${esc(live.name || "Машина без названия")}</button>` : ""}
      <button class="btn dark" data-a="new">Новая съёмка</button>
      ${list.length ? "<h2 style='margin-top:18px'>Мои съёмки</h2>" : `<div class="card mut">Съёмок пока нет. Нажмите «Новая съёмка».</div>`}
      ${list.map((s) => { const c = L.counts(app.data, s); const stt = s.status === "closed" ? "закрыта" : s.status === "paused" ? "пауза" : "идёт";
        return `<div class="card row" data-a="open" data-id="${s.id}" data-hold="menu"><div class="ico">${s.photo ? `<img src="${s.photo}" style="width:92px;height:56px;object-fit:cover;border-radius:12px">` : carIcon(s.icon, 84)}</div>
        <div class="grow"><div class="title">${esc(s.name || "Машина без названия")}</div><div class="sub">снято ${c.done} из ${c.total} · ${stt} · ${new Date(s.updatedAt).toLocaleDateString("ru")}</div></div></div>`; }).join("")}
      <button class="btn ghost" data-a="settings" style="margin-top:18px">Настройки</button><button class="btn ghost" data-a="bug">Заметил ошибку</button>
      <div class="small mut" style="text-align:center;margin-top:8px">Всё хранится в вашем телефоне</div></div>`;
  },
  onboard() {
    const i = app.ob || 0; const [t, d] = ONBOARD[i];
    return `<div class="scr" style="display:flex;flex-direction:column;justify-content:center;min-height:100%"><div class="dots">${ONBOARD.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
      <h1 style="text-align:center">${esc(t)}</h1><p class="mut" style="text-align:center;font-size:18px">${esc(d)}</p>
      <button class="btn pri" data-a="ob-next">${i === ONBOARD.length - 1 ? "Начать" : "Дальше"}</button><button class="btn ghost" data-a="ob-skip">Пропустить</button></div>`;
  },
  new() {
    const d = app.newDraft;
    return `<div class="scr"><h2>Новая съёмка</h2>
      <div class="card"><div class="row"><div class="ico" style="width:112px;height:72px">${d.photo ? `<img src="${d.photo}" style="width:112px;height:72px;object-fit:cover;border-radius:12px">` : carIcon(d.icon, 100)}</div>
      <div class="grow"><input type="text" id="nm" placeholder="Какая машина (необязательно)" value="${esc(d.name)}"></div></div>
      <div class="row" style="margin-top:8px"><button class="btn" style="margin:0" data-a="icon">Другой значок</button><label class="btn" style="margin:0;text-align:center">Фото<input type="file" accept="image/*" capture="environment" id="ph" hidden></label></div></div>
      <h2>Режим</h2><div class="modes">${app.data.modes.map((m) => `<button class="mode ${d.modeId === m.id ? "on" : ""}" data-a="mode" data-id="${m.id}"><b>${esc(m.name)}</b> <span class="pill">${m.ids.length} точек · ~${m.minutes} мин</span><span>${esc(m.desc)}</span></button>`).join("")}</div>
      <h2 style="margin-top:16px">Что разрешено</h2><div class="small mut">По умолчанию ничего. Включайте, когда хозяин разрешил.</div>
      ${PERMS.map(([k, t]) => tog(k, t, d.perms[k], "dperm")).join("")}
      <button class="btn ghost" data-a="allperm">Своя машина: всё разрешено</button>
      <button class="btn go" data-a="start">Поехали</button><button class="btn ghost" data-a="home">Отмена</button></div>`;
  },
  pre() { return `<div class="top"><div class="p">Перед съёмкой</div></div><div class="cw"><img class="cd" src="${cardSrc(app.data.pre)}" alt=""></div><div class="bar"><button class="btn go b1" data-a="pre-ok">Дальше</button></div>`; },
  map() { const sh = shotOf(app.cur.cursor); const c = sh.circle; return `<div class="top"><div class="p">Круг ${c}<small>карта обхода</small></div></div><div class="cw"><img class="cd" src="${cardSrc(app.data.maps[c])}" alt=""></div><div class="bar"><button class="btn go b1" data-a="map-ok">Понятно</button></div>`; },
  frame() {
    const s = app.cur, sh = shotOf(s.cursor), e = L.effective(s, sh), c = L.counts(app.data, s);
    const need = [...sh.perm.filter((p) => !s.perms[p]).map((p) => PERMTXT[p]), ...sh.state.filter((x) => !stOk(s, x)).map((x) => PERMTXT[x])];
    const chips = L.PERMS.map((k) => `<button class="chip ${s.perms[k] ? "on" : ""}" data-a="access" aria-label="${PCHIP[k]}">${PCHIP[k]}${s.perms[k] ? " ✓" : ""}</button>`).join("");
    const idx = L.modeIds(app.data, s).indexOf(sh.id) + 1;
    const bar = e === "locked" ? `<button class="btn b1" data-a="access">Какой доступ нужен</button><button class="btn b3" data-a="gotoq">К очереди</button>`
      : e === "done" ? `<button class="btn go b1" disabled>Снято ✓</button><button class="btn b2" data-a="reset" data-id="${sh.id}">В очередь</button><button class="btn b3" data-a="take" data-id="${sh.id}">Дубль</button>`
      : `<button class="btn go b1" data-a="done" data-id="${sh.id}">✓ Снял</button><button class="btn yel b2" data-a="skip" data-id="${sh.id}">Потом</button><button class="btn b3" data-a="more">Ещё</button>`;
    return `<div class="top"><div class="p">№${sh.id} · круг ${sh.circle} · ${idx} из ${c.total + c.na + c.auto}${c.locked ? `<small>снято ${c.done} · ждут доступа ${c.locked}</small>` : `<small>снято ${c.done} из ${c.total}${sh.part ? " · " + esc(sh.part.replace(" · ", "")) : ""}</small>`}</div><div class="chips">${chips}</div></div>
      <div class="cw" id="cw">${e === "locked" ? `<div class="lockbar"><span>Нужно: ${esc(need.join(", "))}</span></div>` : e === "auto" ? `<div class="lockbar" style="background:var(--gray)">Уже открыто, снимать жест не нужно</div>` : ""}<img class="cd" src="${cardSrc(sh.card)}" alt="${esc(sh.title)}"></div>
      <div class="bar">${bar}</div><div class="foot"><button data-a="list">Список</button><button data-a="bug">Ошибка</button><button data-a="home">Домой</button></div>`;
  },
  list() {
    const s = app.cur, ids = L.modeIds(app.data, s), f = app.filter, sel = app.select;
    const rows = ids.map((i) => shotOf(i)).filter((sh) => { const e = L.effective(s, sh);
      return f === "all" || (f === "left" && (e === "todo" || e === "skipped")) || (f === "skipped" && e === "skipped") || (f === "done" && e === "done") || (f === "locked" && e === "locked") || (f === "c1" && sh.circle === 1) || (f === "c2" && sh.circle === 2) || (f === "c3" && sh.circle === 3); });
    const FL = [["all", "Все"], ["left", "Осталось"], ["skipped", "Пропущено"], ["done", "Снято"], ["locked", "Заперто"], ["c1", "Круг 1"], ["c2", "Круг 2"], ["c3", "Круг 3"]];
    const outs = app.data.shots.filter((x) => !ids.includes(x.id)).map((x) => x.id);
    return `<div class="top"><div class="p">Список · ${ids.length} точек<small>режим: ${esc(L.modeName(app.data, s.modeId))}</small></div><div class="chips"><button class="chip" style="min-width:76px" data-a="modesheet">Режим</button><button class="chip" style="min-width:76px" data-a="${sel ? "selend" : "selbeg"}">${sel ? "Готово" : "Выбрать"}</button></div></div>
      <div class="scr"><div class="fil">${FL.map(([k, t]) => `<button class="${f === k ? "on" : ""}" data-a="filter" data-id="${k}">${t}</button>`).join("")}</div>
      ${f !== "all" && rows.length && !sel ? `<button class="btn pri" data-a="seq">Снимать подряд (${rows.length})</button>` : ""}
      <div class="grid">${rows.map((sh) => { const e = L.effective(s, sh); return `<button class="tile ${e} ${s.cursor === sh.id ? "cur" : ""} ${sel && sel.includes(sh.id) ? "sel" : ""}" data-a="tile" data-id="${sh.id}" data-hold="tile"><img loading="lazy" src="${cardSrc(sh.card, 1)}" alt=""><span class="badge">${BADGE[e] || ""}</span><span class="cap"><span>${sh.id}</span><span>${LABEL[e]}</span></span></button>`; }).join("")}</div>
      ${!rows.length ? `<div class="card mut">Здесь пусто.</div>` : ""}
      ${f === "all" && outs.length ? `<h2 style="margin-top:16px">Вне режима</h2><div class="grid">${outs.map((i) => { const sh = shotOf(i); return `<button class="tile out" data-a="tile" data-id="${sh.id}"><img loading="lazy" src="${cardSrc(sh.card, 1)}" alt=""><span class="cap"><span>${sh.id}</span><span>вне</span></span></button>`; }).join("")}</div>` : ""}</div>
      ${sel ? `<div class="bar"><button class="btn yel b1" data-a="bulk" data-id="skipped">Отложить (${sel.length})</button><button class="btn b1" data-a="bulk" data-id="na">Не нужно</button></div>` : `<div class="bar"><button class="btn b1" data-a="gotoq">К очереди</button><button class="btn b1" data-a="home">Домой</button></div>`}`;
  },
  perms() {
    const d = app.draft;
    return `<div class="scr"><h2>Есть разрешение открывать?</h2><div class="mut">Что хозяин позволил. Заперто сейчас: ${L.lockedList(app.data, app.cur).length}</div>
      <div class="small mut" style="margin-top:12px">ЧТО РАЗРЕШИЛ ХОЗЯИН</div>${PERMS.map(([k, t]) => tog(k, t, d.perms[k], "pdraft")).join("")}
      <div class="small mut" style="margin-top:12px">УЖЕ ОТКРЫТО (САМ ХОЗЯИН)</div>${tog("doorOpen", "Дверь открыта", d.states.doorOpen, "sdraft")}${tog("hoodOpen", "Капот открыт", d.states.hoodOpen, "sdraft")}
      <button class="btn go" data-a="apply" style="margin-top:14px">Применить и снимать дальше</button>
      <button class="btn" data-a="phrases">Спросить хозяина (фразы)</button><button class="btn ghost" data-a="no">Нет, закончить</button>
      <div class="small mut">«Нет» запоминается: экран не повторится, пока вы сами не измените разрешения.</div></div>`;
  },
  skipped() {
    const s = app.cur, sk = L.skippedList(app.data, s);
    return `<div class="scr"><h2>Осталось пропущенное</h2><div class="card">${sk.map((i) => `<span class="pill" style="margin:2px">${i}</span>`).join(" ")}</div><div class="mut">Снять сейчас?</div>
      <button class="btn go" data-a="pass">Снять пропущенное (${sk.length})</button>
      ${s.passes >= 1 ? `<button class="btn yel" data-a="giveup">Пропустить насовсем (${sk.length})</button>` : ""}
      <button class="btn" data-a="finish">Закончить съёмку</button><button class="btn ghost" data-a="list">Список</button></div>`;
  },
  summary() {
    const s = app.cur, c = L.counts(app.data, s), sk = c.skipped;
    return `<div class="scr"><h2>Итог · ${esc(s.name || "Машина без названия")}</h2><div class="stat"><div><b>${c.done}</b>снято</div><div><b>${c.na + c.auto}</b>не нужно</div><div><b>${c.skipped}</b>пропущено</div><div><b>${c.locked}</b>ждут доступа</div></div>
      ${sk ? `<button class="btn go" data-a="pass">Снять пропущенное (${sk})</button>` : ""}
      ${c.locked ? `<button class="btn" data-a="perms">Есть разрешение открывать?</button>` : ""}
      <button class="btn" data-a="qs">Вопросы хозяину</button><button class="btn" data-a="pause">Пауза, вернусь позже</button>
      <button class="btn" data-a="copy">Скопировать итог</button><button class="btn" data-a="savefile">Сохранить файл</button>
      <button class="btn dark" data-a="close">Закрыть съёмку</button><button class="btn ghost" data-a="list">Список</button></div>`;
  },
  qs() {
    const s = app.cur;
    return `<div class="scr"><h2>Вопросы хозяину</h2><div class="small mut">Галочка «спросил» и ответ сохраняются в съёмке.</div>${QUESTIONS.map(([ru, en], i) => { const v = s.qs["q" + i] || {};
      return `<div class="ph"><div class="en">${esc(en)}</div><div class="ru">${esc(ru)}</div><label class="row" style="margin:6px 0"><input type="checkbox" data-q="${i}" data-f="asked" ${v.asked ? "checked" : ""} style="width:26px;height:26px"> спросил</label><textarea data-q="${i}" data-f="answer" rows="2" placeholder="Ответ">${esc(v.answer || "")}</textarea></div>`; }).join("")}
      <button class="btn" data-a="back">Назад</button></div>`;
  },
  bugs() { return `<div class="scr"><h2>Ошибки и заметки</h2><div class="small mut">Здесь то, что вы заметили при проверке. Потом нажмите «Подготовить логи», скопируйте и пришлите.</div>
      ${app.bugs.length ? app.bugs.slice().reverse().map((b) => `<div class="ph"><div class="small mut">${new Date(b.ts).toLocaleString("ru")} · ${esc(b.screen)}${b.shot ? " · №" + esc(b.shot) : ""}${b.car ? " · " + esc(b.car) : ""}</div><div>${esc(b.text)}</div><button class="btn ghost" style="min-height:44px;margin:8px 0 0" data-a="bugdel" data-id="${b.id}">Удалить</button></div>`).join("") : `<div class="card mut">Пока пусто.</div>`}
      <button class="btn" data-a="bug">Добавить заметку</button><button class="btn go" data-a="logs">Подготовить логи</button><button class="btn ghost" data-a="back">Назад</button></div>`; },
  phrases() { return `<div class="scr"><h2>Спросить хозяина</h2>${TIPS.map((t) => `<div class="small mut">• ${esc(t)}</div>`).join("")}<div style="height:10px"></div>${PHRASES.map(([en, ru], i) => `<div class="ph"><div class="en">${esc(en)}</div><div class="ru">${esc(ru)}</div><button class="btn" style="min-height:48px;margin:8px 0 0" data-a="owner" data-id="${i}">Показать хозяину</button></div>`).join("")}<button class="btn" data-a="back">Назад</button></div>`; },
  settings() {
    const st = app.settings;
    return `<div class="scr"><h2>Настройки</h2><div class="small mut">ТЕМА</div><div class="row">${["auto", "light", "dark"].map((t) => `<button class="btn ${st.theme === t ? "pri" : ""}" style="margin:6px 0" data-a="theme" data-id="${t}">${{ auto: "Авто", light: "Светлая", dark: "Тёмная" }[t]}</button>`).join("")}</div>
      ${tog("wake", "Экран не гаснет на кадре", st.wake, "set")}${tog("vibrate", "Вибрация", st.vibrate, "set")}
      <button class="btn" data-a="bugs" style="margin-top:12px">Ошибки и заметки (${app.bugs.length})</button><button class="btn" data-a="logs">Подготовить логи</button><button class="btn" data-a="export">Сохранить все данные файлом</button>
      <button class="btn" data-a="refresh">Обновить приложение</button>
      <div class="small mut" style="margin-top:12px">Версия ${esc(app.version)}. Всё хранится в телефоне. Без аккаунтов и аналитики. Снимайте с разрешения владельца и будьте внимательны вокруг машин и людей.</div>
      <button class="btn ghost" data-a="home">Назад</button></div>`;
  },
};
const stOk = (s, x) => (x === "doorOpen" ? s.states.doorOpen : x === "doorClosed" ? !s.states.doorOpen : x === "hoodOpen" ? s.states.hoodOpen : !s.states.hoodOpen);
const tog = (k, t, on, grp) => `<div class="tog" data-a="tog" data-g="${grp}" data-id="${k}" role="switch" aria-checked="${!!on}"><span>${esc(t)}</span><span class="sw ${on ? "on" : ""}"></span></div>`;

function sheets() {
  if (app.sheet === "more") { const sh = shotOf(app.cur.cursor); return sheet(`<h2>№${sh.id} ${esc(sh.title)}</h2><button class="btn" data-a="na" data-id="${sh.id}">Не нужен</button><button class="btn" data-a="take" data-id="${sh.id}">Снял ещё дубль</button><button class="btn" data-a="note">Заметка${app.cur.shots[sh.id].note ? ": " + esc(app.cur.shots[sh.id].note) : ""}</button><button class="btn" data-a="phrases">Фразы для хозяина</button><button class="btn" data-a="bug">Заметил ошибку</button><button class="btn" data-a="access">Доступ и «хозяин уже открыл»</button><button class="btn" data-a="undo">Отменить последнее</button><button class="btn ghost" data-a="closesheet">Закрыть</button>`); }
  if (app.sheet === "bug") return sheet(`<h2>Заметил ошибку</h2><div class="small mut">Что не так? Сохранится вместе с экраном и кадром.</div><textarea id="bugtxt" rows="5" placeholder="Например: кнопка «Снял» не нажимается на кадре 7"></textarea><button class="btn go" data-a="bugsave">Сохранить</button><button class="btn ghost" data-a="closesheet">Отмена</button>`);
  if (app.sheet && app.sheet.t === "logs") return sheet(`<h2>Логи</h2><div class="small mut">Скопируйте и пришлите мне.</div><textarea id="logtxt" rows="12" readonly style="font-size:12px">${esc(app.sheet.text)}</textarea><button class="btn go" data-a="logcopy">Скопировать</button><button class="btn" data-a="logfile">Сохранить файл</button><button class="btn ghost" data-a="closesheet">Закрыть</button>`);
  if (app.sheet === "access") { const s = app.cur; return sheet(`<h2>Доступ</h2><div class="small mut">РАЗРЕШЕНИЯ</div>${PERMS.map(([k, t]) => tog(k, t, s.perms[k], "perm")).join("")}<div class="small mut" style="margin-top:10px">УЖЕ ОТКРЫТО (САМ ХОЗЯИН)</div>${tog("doorOpen", "Дверь открыта", s.states.doorOpen, "state")}${tog("hoodOpen", "Капот открыт", s.states.hoodOpen, "state")}<button class="btn" data-a="allaccess" style="margin-top:8px">Своя машина: всё разрешено</button><button class="btn ghost" data-a="closesheet">Готово</button>`); }
  if (app.sheet === "modes") return sheet(`<h2>Режим</h2><div class="small mut">Меняет только набор точек, разрешения не трогает.</div><div class="modes">${app.data.modes.map((m) => `<button class="mode ${app.cur.modeId === m.id ? "on" : ""}" data-a="setmode" data-id="${m.id}"><b>${esc(m.name)}</b> <span class="pill">${m.ids.length} · ~${m.minutes} мин</span><span>${esc(m.desc)}</span></button>`).join("")}</div><button class="btn ghost" data-a="closesheet">Закрыть</button>`);
  if (app.sheet && app.sheet.t === "tile") { const sh = shotOf(app.sheet.id); return sheet(`<h2>№${sh.id} ${esc(sh.title)}</h2><button class="btn go" data-a="tset" data-id="done">Снято</button><button class="btn yel" data-a="tset" data-id="skipped">Потом</button><button class="btn" data-a="tset" data-id="na">Не нужно</button><button class="btn" data-a="tset" data-id="todo">Вернуть в очередь</button>${app.cur.modeId && !L.modeIds(app.data, app.cur).includes(sh.id) ? `<button class="btn" data-a="tset" data-id="extra">Добавить в съёмку</button>` : ""}<button class="btn ghost" data-a="closesheet">Закрыть</button>`); }
  if (app.sheet && app.sheet.t === "sess") { return sheet(`<h2>${esc(app.sheet.name || "Машина без названия")}</h2><button class="btn" data-a="rename" data-id="${app.sheet.id}">Переименовать</button><button class="btn" data-a="sclose" data-id="${app.sheet.id}">Закрыть съёмку</button><button class="btn" style="color:var(--red)" data-a="sdel" data-id="${app.sheet.id}">Удалить</button><button class="btn ghost" data-a="closesheet">Отмена</button>`); }
  return "";
}
const sheet = (h) => `<div class="sheet-bg" data-a="bg"><div class="sheet" data-a="nop">${h}</div></div>`;

function render() {
  document.documentElement.dataset.theme = theme();
  if (app.cur && ["frame", "map"].includes(app.screen) && !app.cur.cursor) app.screen = L.endState(app.data, app.cur) || "summary";
  if (app.screen === "perms" && app.cur && app.lastScr !== "perms") app.draft = { perms: { ...app.cur.perms }, states: { ...app.cur.states } };
  app.lastScr = app.screen;
  const v = view[app.screen] || view.home; const keep = $(".scr, .cw") ? ($(".scr") || $(".cw")).scrollTop : 0; const sameScreen = root.dataset.scr === app.screen;
  root.dataset.scr = app.screen; root.innerHTML = v() + sheets() + (app.toast ? `<div class="toast ${["frame", "map", "pre"].includes(app.screen) ? "" : "top"}"><span>${esc(app.toast.msg)}</span>${app.toast.label ? `<button data-a="toast">${esc(app.toast.label)}</button>` : ""}</div>` : "") + (app.owner ? `<div class="owner"><div class="en">${esc(app.owner[0])}</div><div class="ru">${esc(app.owner[1])}</div><button data-a="ownerx">Закрыть</button></div>` : "");
  if (sameScreen && app.screen === "list") { const sc = $(".scr"); if (sc) sc.scrollTop = keep; }
  if (app.screen === "frame") { wake(); const cw = $("#cw"); if (cw) swipe(cw); } else unwake();
  const nm = $("#nm"); if (nm) nm.oninput = () => (app.newDraft.name = nm.value);
  const ph = $("#ph"); if (ph) ph.onchange = () => photo(ph.files[0]);
  root.querySelectorAll("[data-q]").forEach((el) => (el.onchange = () => { const k = "q" + el.dataset.q; const cur = app.cur.qs[k] || {}; const v = el.dataset.f === "asked" ? { asked: el.checked } : { answer: el.value }; doAct({ type: "answer", q: k, v }, { toast: false }); }));
}

// ---------- события ----------
let hold = null, held = false;
root.addEventListener("pointerdown", (e) => { const t = e.target.closest("[data-hold]"); held = false; if (!t) return; hold = setTimeout(() => { held = true; buzz(25); onHold(t); }, 550); });
["pointerup", "pointercancel", "pointermove", "scroll"].forEach((ev) => root.addEventListener(ev, () => clearTimeout(hold), true));
function onHold(t) { if (t.dataset.hold === "tile") { app.sheet = { t: "tile", id: t.dataset.id }; render(); } if (t.dataset.hold === "menu") { const s = app.sessions.find((x) => x.id === t.dataset.id); app.sheet = { t: "sess", id: s.id, name: s.name }; render(); } }
root.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-a]"); if (!t) return; if (held) { held = false; return; }
  const a = t.dataset.a, id = t.dataset.id; if (a === "nop") return;
  if (a === "bg") { if (e.target === t) { app.sheet = null; render(); } return; }
  await handle(a, id, t);
});
async function handle(a, id, t) {
  const s = app.cur;
  switch (a) {
    case "home": app.stack = []; app.screen = "home"; app.cur = null; app.temp = null; app.sheet = null; try { localStorage.setItem("tl_resume", ""); } catch { /* */ } if (s && s.status === "active") await commit({ ...s, status: "paused" }); render(); history.pushState({}, ""); break;
    case "settings": go("settings"); break;
    case "back": back(); break;
    case "update": app.updating = true; navigator.serviceWorker.getRegistration().then((r) => { if (r && r.waiting) r.waiting.postMessage("skipWaiting"); }); break;
    case "refresh": { app.updating = true; const r = await navigator.serviceWorker.getRegistration(); if (r) { await r.update(); if (r.waiting) r.waiting.postMessage("skipWaiting"); } showToast("Проверили обновления", "", null, 2500); break; }
    case "theme": app.settings.theme = id; await S.setKV("settings", app.settings); render(); break;
    case "tog": toggle(t.dataset.g, id); break;
    case "ob-next": app.ob = (app.ob || 0) + 1; if (app.ob >= ONBOARD.length) { app.settings.onboarded = true; S.setKV("settings", app.settings); app.screen = "home"; } render(); break;
    case "ob-skip": app.settings.onboarded = true; S.setKV("settings", app.settings); app.screen = "home"; render(); break;
    case "new": app.newDraft = { name: "", icon: nextIcon(-1), photo: null, modeId: "first", perms: { touch: false, door: false, hood: false, engine: false } }; go("new"); break;
    case "icon": app.newDraft.icon = nextIcon(app.newDraft.icon); app.newDraft.photo = null; render(); break;
    case "mode": app.newDraft.modeId = id; render(); break;
    case "allperm": for (const k of L.PERMS) app.newDraft.perms[k] = true; render(); break;
    case "start": { const d = app.newDraft; const ns = L.newSession(app.data, { name: d.name.trim(), icon: d.icon, perms: d.perms, modeId: d.modeId }); ns.photo = d.photo; await commit(ns); app.stack = []; app.screen = "home"; go(ns.preSeen ? "frame" : "pre"); break; }
    case "open": { const x = app.sessions.find((q) => q.id === id); if (!x) break; app.cur = { ...x, status: x.status === "closed" ? "active" : "active" }; app.stack = []; app.screen = "home";
      if (x.status === "closed") { app.draft = { perms: { ...x.perms }, states: { ...x.states } }; go("perms"); } else resume(); break; }
    case "pre-ok": await doAct({ type: "preSeen" }, { toast: false }); go("frame", true); app.screen = needMap() ? "map" : "frame"; render(); break;
    case "map-ok": await doAct({ type: "mapSeen", circle: shotOf(app.cur.cursor).circle }, { toast: false }); app.screen = "frame"; render(); break;
    case "done": case "skip": if (a === "done") { if (app.hold) break; app.hold = true; setTimeout(() => { app.hold = false; }, 1000); } buzz(); await afterAct({ type: a, id }); break;
    case "na": app.sheet = null; await afterAct({ type: "na", id }); break;
    case "take": app.sheet = null; await doAct({ type: "take", id }); render(); break;
    case "reset": await doAct({ type: "reset", id }); render(); break;
    case "more": app.sheet = "more"; render(); break;
    case "closesheet": app.sheet = null; render(); break;
    case "note": { const sh = shotOf(s.cursor); const v = prompt("Заметка к кадру", s.shots[sh.id].note || ""); app.sheet = null; if (v !== null) await doAct({ type: "note", id: sh.id, text: v }, { toast: false }); render(); break; }
    case "undo": app.sheet = null; await doUndo(); render(); break;
    case "access": app.sheet = "access"; render(); break;
    case "allaccess": for (const k of L.PERMS) await doAct({ type: "setPerm", key: k, value: true }, { toast: false }); render(); break;
    case "gotoq": { const q = L.queue(app.data, s)[0]; if (q) jump(q); else { const e = L.endState(app.data, s); app.screen = e || "summary"; render(); } break; }
    case "list": app.screen = "list"; app.select = null; app.stack.push("frame"); render(); history.pushState({}, ""); break;
    case "filter": app.filter = id; render(); break;
    case "tile": if (app.select) { const i = app.select.indexOf(id); if (i >= 0) app.select.splice(i, 1); else app.select.push(id); render(); } else jump(id); break;
    case "selbeg": app.select = []; render(); break;
    case "selend": app.select = null; render(); break;
    case "bulk": { const ids = app.select.slice(); app.select = null; await doAct({ type: "bulk", ids, to: id }); render(); break; }
    case "seq": { const ids = L.modeIds(app.data, s).map(shotOf).filter((sh) => ["todo", "skipped", "done"].includes(L.effective(s, sh))).map((x) => x.id); const f = app.filter;
      const sel = ids.filter((i) => { const sh = shotOf(i), e = L.effective(s, sh); return (f === "left" && (e === "todo" || e === "skipped")) || (f === "skipped" && e === "skipped") || (f === "done" && e === "done") || (f === "c1" && sh.circle === 1) || (f === "c2" && sh.circle === 2) || (f === "c3" && sh.circle === 3); });
      if (!sel.length) break; app.temp = { ids: sel, i: 0, back: s.cursor }; jump(sel[0]); break; }
    case "modesheet": app.sheet = "modes"; render(); break;
    case "setmode": app.sheet = null; await doAct({ type: "setMode", modeId: id }); render(); break;
    case "tset": { const sh = app.sheet.id; app.sheet = null; if (id === "extra") await doAct({ type: "addExtra", id: sh }); else if (id === "todo") await doAct({ type: "reset", id: sh }); else await doAct({ type: id === "done" ? "done" : id === "skipped" ? "skip" : "na", id: sh }); render(); break; }
    case "perms": app.draft = { perms: { ...s.perms }, states: { ...s.states } }; go("perms"); break;
    case "apply": await doAct({ type: "applyAccess", perms: app.draft.perms, states: app.draft.states }, { toast: false }); app.stack = []; app.screen = app.cur.cursor ? "frame" : (L.endState(app.data, app.cur) || "summary"); if (app.screen === "frame" && needMap()) app.screen = "map"; render(); break;
    case "no": await doAct({ type: "saidNo" }, { toast: false }); go("summary"); break;
    case "phrases": app.sheet = null; go("phrases"); break;
    case "owner": app.owner = PHRASES[+id]; render(); history.pushState({}, ""); break;
    case "ownerx": app.owner = null; render(); break;
    case "pass": await doAct({ type: "enterPass" }, { toast: false }); app.screen = app.cur.cursor ? "frame" : "summary"; render(); break;
    case "giveup": await doAct({ type: "giveUp" }, { toast: false }); { const e = L.endState(app.data, app.cur); app.screen = app.cur.cursor ? "frame" : (e || "summary"); } render(); break;
    case "finish": app.screen = L.lockedList(app.data, s).length && !s.saidNo ? "perms" : "summary"; if (app.screen === "perms") app.draft = { perms: { ...s.perms }, states: { ...s.states } }; render(); break;
    case "qs": go("qs"); break;
    case "pause": await doAct({ type: "setStatus", value: "paused" }, { toast: false }); handle("home"); break;
    case "close": await doAct({ type: "setStatus", value: "closed" }, { toast: false }); handle("home"); break;
    case "copy": { const txt = L.summaryText(app.data, s); try { await navigator.clipboard.writeText(txt); showToast("Итог скопирован", "", null, 2500); } catch { prompt("Скопируйте итог", txt); } break; }
    case "savefile": download(`three-laps-${(s.name || "car").replace(/\W+/g, "_")}.txt`, L.summaryText(app.data, s)); break;
    case "export": download("three-laps-backup.json", JSON.stringify(app.sessions)); break;
    case "rename": { const x = app.sessions.find((q) => q.id === id); const v = prompt("Название", x.name || ""); app.sheet = null; if (v !== null) await commit({ ...x, name: v }); render(); break; }
    case "sclose": { const x = app.sessions.find((q) => q.id === id); app.sheet = null; await commit({ ...x, status: "closed" }); render(); break; }
    case "sdel": { if (confirm("Удалить съёмку без возможности вернуть?")) { await S.deleteSession(id); app.sessions = app.sessions.filter((q) => q.id !== id); } app.sheet = null; render(); break; }
    case "bug": app.sheet = "bug"; render(); setTimeout(() => { const x = $("#bugtxt"); if (x) x.focus(); }, 80); break;
    case "bugsave": { const txt = ($("#bugtxt") || {}).value || ""; if (!txt.trim()) break; app.bugs.push({ id: "b" + Date.now().toString(36), ts: Date.now(), screen: app.screen, shot: app.cur && app.cur.cursor, car: app.cur && app.cur.name, text: txt.trim() }); await S.setKV("bugs", app.bugs); app.sheet = null; showToast("Заметка сохранена", "", null, 2500); break; }
    case "bugdel": app.bugs = app.bugs.filter((b) => b.id !== id); await S.setKV("bugs", app.bugs); render(); break;
    case "bugs": go("bugs"); break;
    case "logs": app.sheet = { t: "logs", text: await buildLogs() }; render(); break;
    case "logcopy": { const x = $("#logtxt"); try { await navigator.clipboard.writeText(app.sheet.text); showToast("Скопировано", "", null, 2000); } catch { x.select(); document.execCommand("copy"); showToast("Скопировано", "", null, 2000); } break; }
    case "logfile": download("three-laps-logs.txt", app.sheet.text); break;
    case "toast": { const f = app.toast && app.toast.fn; clearToast(); if (f) f(); break; }
  }
}
function toggle(g, k) {
  if (g === "dperm") { app.newDraft.perms[k] = !app.newDraft.perms[k]; render(); }
  else if (g === "pdraft") { app.draft.perms[k] = !app.draft.perms[k]; render(); }
  else if (g === "sdraft") { app.draft.states[k] = !app.draft.states[k]; render(); }
  else if (g === "perm") doAct({ type: "setPerm", key: k, value: !app.cur.perms[k] }, { toast: false }).then(render);
  else if (g === "state") doAct({ type: "setState", key: k, value: !app.cur.states[k] }, { toast: false }).then(render);
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
    o.push(`- ${s.name || "без названия"} · ${s.modeId} · ${s.status} · снято ${c.done}, потом ${c.skipped}, заперто ${c.locked}, не нужно ${c.na + c.auto} · разрешения ${Object.entries(s.perms).filter(([, v]) => v).map(([k]) => k).join("+") || "нет"} · дверь ${s.states.doorOpen ? "откр" : "закр"}, капот ${s.states.hoodOpen ? "откр" : "закр"} · курсор ${s.cursor}`);
  }
  if (app.cur) {
    o.push("", `ТЕКУЩАЯ (${app.cur.name || "без названия"}), последние действия: ${app.cur.events.map((e) => e.type).join(", ")}`);
    o.push(`статусы: ${Object.entries(app.cur.shots).filter(([, v]) => v.status !== "todo").map(([k, v]) => k + ":" + v.status).join(" ")}`);
  }
  return o.join("\n");
}
function resume() {
  const s = app.cur; if (!s.preSeen) return go("pre");
  if (s.cursor == null) { const e = L.endState(app.data, s); if (e) { app.screen = e; if (e === "perms") app.draft = { perms: { ...s.perms }, states: { ...s.states } }; render(); return; } }
  go(needMap() ? "map" : "frame");
}
function download(name, text) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
async function photo(f) { if (!f) return; const img = await createImageBitmap(f); const c = document.createElement("canvas"); c.width = 160; c.height = 120; const x = c.getContext("2d"); const r = Math.max(160 / img.width, 120 / img.height); x.drawImage(img, (160 - img.width * r) / 2, (120 - img.height * r) / 2, img.width * r, img.height * r); app.newDraft.photo = c.toDataURL("image/webp", 0.7); render(); }

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
  app.sessions = await S.allSessions(); app.bugs = await S.getKV("bugs", []); S.persist();
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
  if (rs) { app.cur = rs; app.screen = "frame"; if (needMap()) app.screen = "map"; }
  render();
}
init();
window.__tl = { app, L };
