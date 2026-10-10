// Three Laps — чистая логика (ТЗ v3 + правки пользователя 10.10). Без DOM: работает в браузере и в node (тесты).
//
// Модель:
//  • точка съёмки: perm (нужные разрешения), state (нужное состояние машины), opens (что открывает: 19 — дверь, 27 — капот);
//  • доступ сессии: 4 разрешения + 2 состояния (дверь/капот открыты); запертое не удаляется и не мешает очереди;
//  • режимы: «круговые» (Первое касание, Полный) идут круг за кругом — после круга вопрос «Есть доступ?»
//    и следующий круг; «фиксированные» (Обязательное, Круг N, Быстрая) — один набор;
//  • каждый вопрос в конце очереди задаётся один раз: пропущенное (по каждому кадру), следующий круг, доступ.
export const PERMS = ["touch", "door", "hood", "engine"];
const clone = (o) => JSON.parse(JSON.stringify(o));
const byId = (data) => (data._by || (data._by = Object.fromEntries(data.shots.map((s) => [s.id, s]))));
const modeOf = (data, id) => data.modes.find((m) => m.id === id) || data.modes[0];
export const isProgressive = (data, s) => modeOf(data, s.modeId).kind === "progressive";

export function newSession(data, { name = "", icon = 0, perms = null, modeId = "first", now = Date.now() } = {}) {
  const m = modeOf(data, modeId);
  const shots = {};
  for (const s of data.shots) shots[s.id] = { status: "todo", takes: 0, note: "", skipSeq: 0 };
  const all = m.access === "all";
  const p = perms || {};
  const s = {
    id: "s" + now.toString(36) + Math.random().toString(36).slice(2, 6), name, icon, photo: null, modeId,
    perms: { touch: all || !!p.touch, door: all || !!p.door, hood: all || !!p.hood, engine: all || !!p.engine },
    states: { doorOpen: false, hoodOpen: false }, shots, extra: [], cursor: null, skipCounter: 0, passes: 0, passMode: false,
    circleNow: m.kind === "progressive" ? m.start : null, declined: {}, skipAsk: [],
    mapsSeen: {}, preSeen: false, saidNo: false, status: "active", events: [], qs: {}, createdAt: now, updatedAt: now,
  };
  s.cursor = queue(data, s)[0] || null;
  return s;
}

function stateOk(s, req) {
  for (const r of req) {
    if (r === "doorOpen" && !s.states.doorOpen) return false;
    if (r === "doorClosed" && s.states.doorOpen) return false;
    if (r === "hoodOpen" && !s.states.hoodOpen) return false;
    if (r === "hoodClosed" && s.states.hoodOpen) return false;
  }
  return true;
}
export const isAvailable = (s, shot) => shot.perm.every((p) => s.perms[p]) && stateOk(s, shot.state);
// что нужно, чтобы точка стала доступной: [{kind:"perm"|"state", key}]
export const needs = (s, shot) => [
  ...shot.perm.filter((p) => !s.perms[p]).map((key) => ({ kind: "perm", key })),
  ...shot.state.filter((x) => !stateOk(s, [x])).map((key) => ({ kind: "state", key })),
];

// done/na сильнее locked; «уже открыто» (opens) -> auto; locked вычисляется, не хранится
export function effective(s, shot) {
  const st = s.shots[shot.id].status;
  if (st === "done" || st === "na") return st;
  if (shot.opens && s.states[shot.opens]) return "auto";
  if (!isAvailable(s, shot)) return "locked";
  return st;
}

// текущий набор точек. Круговой режим: круги от стартового до текущего + жесты-«открывашки» (19/27),
// если в наборе есть точки, которым нужна открытая дверь/капот (жест встаёт в очередь раньше салона и мотора).
export function modeIds(data, s) {
  const m = modeOf(data, s.modeId);
  let ids;
  if (m.kind === "progressive") {
    const cn = s.circleNow || m.start;
    ids = new Set(m.ids.filter((i) => { const c = byId(data)[i].circle; return c >= m.start && c <= cn; }));
    for (const sh of data.shots) {
      if (!sh.opens || ids.has(sh.id)) continue;
      if ([...ids].some((i) => byId(data)[i].state.includes(sh.opens))) ids.add(sh.id);
    }
  } else ids = new Set(m.ids);
  for (const i of s.extra || []) ids.add(i);
  return data.order.filter((i) => ids.has(i));
}
const list = (data, s, eff) => modeIds(data, s).map((i) => byId(data)[i]).filter((sh) => effective(s, sh) === eff);
export const queue = (data, s) => list(data, s, "todo").sort((a, b) => a.order - b.order).map((x) => x.id);
export const skippedList = (data, s) =>
  list(data, s, "skipped").sort((a, b) => s.shots[a.id].skipSeq - s.shots[b.id].skipSeq).map((x) => x.id);
export const lockedList = (data, s) => list(data, s, "locked").map((x) => x.id);

export function counts(data, s, circle = null) {
  const c = { done: 0, na: 0, skipped: 0, locked: 0, todo: 0, auto: 0 };
  for (const sh of modeIds(data, s).map((i) => byId(data)[i])) if (circle === null || sh.circle === circle) c[effective(s, sh)]++;
  c.total = c.done + c.skipped + c.locked + c.todo;
  return c;
}
// точки кругов, до которых ещё не дошли (круговой режим)
export function notStarted(data, s) {
  if (!isProgressive(data, s)) return [];
  const inSet = new Set(modeIds(data, s));
  return data.order.filter((i) => !inSet.has(i) && s.shots[i].status !== "na");
}

function passNext(data, s) {
  if (!s.passMode) return null;
  const seen = s.passSeen || [];
  const nx = (s.passQueue || []).find((i) => !seen.includes(i) && effective(s, byId(data)[i]) === "skipped");
  if (!nx) { s.passMode = false; s.passQueue = []; s.passSeen = []; }
  return nx || null;
}
export function nextAfter(data, s, fromId) {
  if (s.passMode) { const nx = passNext(data, s); if (nx) return nx; }
  const q = queue(data, s).filter((i) => i !== fromId);
  if (!q.length) return null;
  const from = fromId && byId(data)[fromId] ? byId(data)[fromId].order : 0;
  return q.find((i) => byId(data)[i].order > from) || q[0];
}
// следующий круг кругового режима (отказ запоминается)
export function nextStage(data, s) {
  if (!isProgressive(data, s)) return null;
  const dec = s.declined || {};
  for (let c = (s.circleNow || 1) + 1; c <= 3; c++) {
    if (dec[c]) continue;
    if (data.shots.some((x) => x.circle === c && s.shots[x.id].status !== "na")) return c;
  }
  return null;
}
export const stageIds = (data, s, c) => data.order.filter((i) => byId(data)[i].circle === c && s.shots[i].status !== "na");
// куда вести, когда очередь пуста
export function endState(data, s) {
  if (s.passMode && passNext(data, s)) return null;
  if (queue(data, s).length) return null;
  if (skippedList(data, s).some((i) => !(s.skipAsk || []).includes(i))) return "skipped";
  if (nextStage(data, s)) return "stage";
  if (lockedList(data, s).length && !s.saidNo) return "perms";
  return "summary";
}
// есть ли что ещё снимать (кнопка «Вернуться к съёмке» в итоге)
export const hasMore = (data, s) =>
  queue(data, s).length > 0 || skippedList(data, s).length > 0 || notStarted(data, s).length > 0 || lockedList(data, s).length > 0;

function push(s, type, now) {
  const snap = clone({ ...s, events: [] });
  s.events.push({ ts: now, type, snap });
  if (s.events.length > 20) s.events.shift();
}
function fixCursor(data, s, force) {
  const pn = s.passMode ? passNext(data, s) : null;
  const sh = s.cursor && byId(data)[s.cursor];
  const ok = sh && modeIds(data, s).includes(s.cursor) && ["todo", "skipped", "done"].includes(effective(s, sh));
  if (force || !ok) s.cursor = (pn || queue(data, s)[0]) || null;
  return s;
}
const askAll = (data, s) => { s.skipAsk = [...new Set([...(s.skipAsk || []), ...skippedList(data, s)])]; };
const seenPass = (s, id) => { if (s.passMode) (s.passSeen = s.passSeen || []).push(id); };

export function act(data, s0, a, now = Date.now()) {
  const s = clone(s0);
  const sh = a.id ? byId(data)[a.id] : null;
  const st = a.id ? s.shots[a.id] : null;
  if (a.id && (!sh || !st)) return s0;
  s.updatedAt = now;
  s.skipAsk = s.skipAsk || []; s.declined = s.declined || {}; s.extra = s.extra || [];
  switch (a.type) {
    case "done":
      if (effective(s, sh) === "locked") return s0;
      push(s, "done", now); st.status = "done"; st.takes++;
      if (sh.opens) s.states[sh.opens] = true;
      seenPass(s, a.id); s.cursor = nextAfter(data, s, a.id); break;
    case "skip":
      if (effective(s, sh) === "locked") return s0;
      push(s, "skip", now); st.status = "skipped"; st.skipSeq = ++s.skipCounter;
      if (!s.passMode) s.skipAsk = s.skipAsk.filter((x) => x !== a.id);
      seenPass(s, a.id); s.cursor = nextAfter(data, s, a.id); break;
    case "na":
      push(s, "na", now); st.status = "na"; seenPass(s, a.id);
      if (s.cursor === a.id) s.cursor = nextAfter(data, s, a.id);
      break;
    case "reset": push(s, "reset", now); st.status = "todo"; s.cursor = a.id; break;
    case "take": push(s, "take", now); st.takes++; break;
    case "note": st.note = a.text || ""; break;
    case "setPerm": push(s, "perm", now); s.perms[a.key] = !!a.value; s.saidNo = false; fixCursor(data, s); break;
    case "setState": push(s, "state", now); s.states[a.key] = !!a.value; s.saidNo = false; fixCursor(data, s); break;
    case "applyAccess":
      push(s, "access", now); Object.assign(s.perms, a.perms || {}); Object.assign(s.states, a.states || {});
      s.saidNo = !!a.answered; fixCursor(data, s, true); break;
    case "setMode": {
      push(s, "mode", now);
      const wasProg = isProgressive(data, s); s.modeId = a.modeId; const m = modeOf(data, a.modeId);
      s.circleNow = m.kind === "progressive" ? (wasProg ? Math.max(s.circleNow || 1, m.start) : m.start) : null;
      s.passMode = false; s.declined = {}; s.skipAsk = []; fixCursor(data, s, true); break;
    }
    case "addExtra": push(s, "extra", now); if (!s.extra.includes(a.id)) s.extra.push(a.id); break;
    case "jump": s.cursor = a.id; break;
    case "enterPass":
      push(s, "pass", now); askAll(data, s); s.passes++; s.passQueue = skippedList(data, s); s.passSeen = [];
      s.passMode = s.passQueue.length > 0; s.cursor = s.passQueue[0] || null; break;
    case "skipAsked": askAll(data, s); break;
    case "addStage":   // перейти к следующему кругу; ответ про доступ — тут же (вопрос больше не повторяется)
      push(s, "stage", now);
      if (a.perms) Object.assign(s.perms, a.perms);
      if (a.states) Object.assign(s.states, a.states);
      s.circleNow = a.circle; s.saidNo = true; s.passMode = false;
      s.cursor = queue(data, s)[0] || null; break;
    case "finishAll":  // «Завершить»: ничего больше не предлагать, всё остаётся в итоге
      push(s, "finish", now); s.declined = { 1: true, 2: true, 3: true }; askAll(data, s); s.saidNo = true; s.passMode = false; s.cursor = null; break;
    case "resume":     // «Вернуться к съёмке» из итога: вопросы снова можно задать
      push(s, "resume", now); s.skipAsk = []; s.saidNo = false; s.declined = {}; s.passMode = false;
      s.cursor = queue(data, s)[0] || null; break;
    case "giveUp":
      push(s, "giveup", now);
      for (const i of skippedList(data, s)) s.shots[i].status = "na";
      askAll(data, s); s.passMode = false; s.cursor = nextAfter(data, s, null); break;
    case "bulk":
      push(s, "bulk", now);
      for (const i of a.ids) {
        if (!s.shots[i]) continue;
        if (a.to === "skipped") { s.shots[i].status = "skipped"; s.shots[i].skipSeq = ++s.skipCounter; s.skipAsk = s.skipAsk.filter((x) => x !== i); }
        else s.shots[i].status = a.to;
      }
      fixCursor(data, s); break;
    case "saidNo": s.saidNo = true; break;
    case "mapSeen": s.mapsSeen[a.circle] = true; break;
    case "preSeen": s.preSeen = true; break;
    case "setStatus": s.status = a.value; break;
    case "answer": s.qs[a.q] = { ...(s.qs[a.q] || {}), ...a.v }; break;
    case "meta": Object.assign(s, a.v); break;
    default: return s0;
  }
  return s;
}

export function undo(s) {
  if (!s.events.length) return s;
  const ev = s.events[s.events.length - 1];
  const r = clone(ev.snap);
  r.events = s.events.slice(0, -1);
  r.updatedAt = Date.now();
  return r;
}
// навигация свайпом: по порядку внутри набора, статус не трогает
export function neighbor(data, s, id, dir) {
  const ids = modeIds(data, s);
  const i = ids.indexOf(id);
  if (i < 0) return ids[0] || null;
  return ids[i + dir] || null;
}
export function summaryText(data, s) {
  const c = counts(data, s), ns = notStarted(data, s);
  const lines = [
    `Three Laps · ${s.name || "Машина без названия"} · режим ${modeOf(data, s.modeId).name}`,
    `Снято ${c.done} · Не нужно ${c.na + c.auto} · Пропущено ${c.skipped} · Ждут доступа ${c.locked}${ns.length ? ` · Не начато ${ns.length}` : ""}`,
  ];
  const L = { done: "снято", skipped: "пропущено", locked: "ждёт доступа", na: "не нужно", auto: "уже открыто", todo: "не снято" };
  for (const sh of modeIds(data, s).map((i) => byId(data)[i])) {
    const e = effective(s, sh), st = s.shots[sh.id];
    lines.push(`${sh.id} ${sh.title}${sh.part}: ${L[e]}${e === "done" && st.takes > 1 ? ` ×${st.takes}` : ""}${st.note ? " · " + st.note : ""}`);
  }
  if (ns.length) lines.push(`Не начато: ${ns.join(", ")}`);
  const qa = Object.entries(s.qs).filter(([, v]) => v.answer || v.asked);
  if (qa.length) {
    lines.push("Вопросы хозяину:");
    for (const [q, v] of qa) lines.push(`${q}: ${v.asked ? "спросил" : ""} ${v.answer || ""}`);
  }
  return lines.join("\n");
}
export const modeName = (data, id) => modeOf(data, id).name;
export const modeInfo = (data, id) => modeOf(data, id);
