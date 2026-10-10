// Three Laps — чистая логика (ТЗ v3). Без DOM: работает в браузере и в node (тесты).
export const PERMS = ["touch", "door", "hood", "engine"];
const clone = (o) => JSON.parse(JSON.stringify(o));
const byId = (data) => (data._by || (data._by = Object.fromEntries(data.shots.map((s) => [s.id, s]))));
const modeOf = (data, id) => data.modes.find((m) => m.id === id) || data.modes[0];

export function newSession(data, { name = "", icon = 0, perms = {}, modeId = "first", now = Date.now() } = {}) {
  const shots = {};
  for (const s of data.shots) shots[s.id] = { status: "todo", takes: 0, note: "", skipSeq: 0 };
  const s = {
    id: "s" + now.toString(36) + Math.random().toString(36).slice(2, 6), name, icon, photo: null, modeId,
    perms: { touch: !!perms.touch, door: !!perms.door, hood: !!perms.hood, engine: !!perms.engine },
    states: { doorOpen: false, hoodOpen: false }, shots, extra: [], cursor: null, skipCounter: 0, passes: 0, passMode: false,
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

// done/na сильнее locked; «уже открыто» (opens) -> auto; locked вычисляется, не хранится
export function effective(s, shot) {
  const st = s.shots[shot.id].status;
  if (st === "done" || st === "na") return st;
  if (shot.opens && s.states[shot.opens]) return "auto";
  if (!isAvailable(s, shot)) return "locked";
  return st;
}
export function modeIds(data, s) {
  const ids = new Set([...modeOf(data, s.modeId).ids, ...s.extra]);
  return data.order.filter((i) => ids.has(i));
}
const list = (data, s, eff) => modeIds(data, s).map((i) => byId(data)[i]).filter((sh) => effective(s, sh) === eff);
export const queue = (data, s) => list(data, s, "todo").sort((a, b) => a.order - b.order).map((x) => x.id);
export const skippedList = (data, s) =>
  list(data, s, "skipped").sort((a, b) => s.shots[a.id].skipSeq - s.shots[b.id].skipSeq).map((x) => x.id);
export const lockedList = (data, s) => list(data, s, "locked").map((x) => x.id);

export function counts(data, s) {
  const c = { done: 0, na: 0, skipped: 0, locked: 0, todo: 0, auto: 0 };
  for (const sh of modeIds(data, s).map((i) => byId(data)[i])) c[effective(s, sh)]++;
  c.total = c.done + c.skipped + c.locked + c.todo;
  return c;
}
export function nextAfter(data, s, fromId) {
  if (s.passMode && !skippedList(data, s).length) s.passMode = false;
  if (s.passMode) return skippedList(data, s).find((i) => i !== fromId) || null;
  const q = queue(data, s).filter((i) => i !== fromId);
  if (!q.length) return null;
  const from = fromId ? byId(data)[fromId].order : 0;
  return q.find((i) => byId(data)[i].order > from) || q[0];
}
export function endState(data, s) {
  if (s.passMode && skippedList(data, s).length) return null;
  if (queue(data, s).length) return null;
  if (skippedList(data, s).length) return "skipped";
  if (lockedList(data, s).length && !s.saidNo) return "perms";
  return "summary";
}

function push(s, type, now) {
  const snap = clone({ ...s, events: [] });
  s.events.push({ ts: now, type, snap });
  if (s.events.length > 20) s.events.shift();
}
function fixCursor(data, s, force) {
  if (s.passMode && !skippedList(data, s).length) s.passMode = false;
  const sh = s.cursor && byId(data)[s.cursor];
  const ok = sh && modeIds(data, s).includes(s.cursor) && ["todo", "skipped", "done"].includes(effective(s, sh));
  if (force || !ok) s.cursor = (s.passMode ? skippedList(data, s)[0] : queue(data, s)[0]) || null;
  return s;
}

export function act(data, s0, a, now = Date.now()) {
  const s = clone(s0);
  const sh = a.id ? byId(data)[a.id] : null;
  const st = a.id ? s.shots[a.id] : null;
  s.updatedAt = now;
  switch (a.type) {
    case "done":
      if (!sh || effective(s, sh) === "locked") return s0;
      push(s, "done", now); st.status = "done"; st.takes++;
      if (sh.opens) s.states[sh.opens] = true;
      s.cursor = nextAfter(data, s, a.id); break;
    case "skip":
      if (!sh || effective(s, sh) === "locked") return s0;
      push(s, "skip", now); st.status = "skipped"; st.skipSeq = ++s.skipCounter;
      s.cursor = nextAfter(data, s, a.id); break;
    case "na":
      push(s, "na", now); st.status = "na";
      if (s.cursor === a.id) s.cursor = nextAfter(data, s, a.id);
      break;
    case "reset": push(s, "reset", now); st.status = "todo"; s.cursor = a.id; break;
    case "take": push(s, "take", now); st.takes++; break;
    case "note": st.note = a.text || ""; break;
    case "setPerm": push(s, "perm", now); s.perms[a.key] = !!a.value; s.saidNo = false; fixCursor(data, s); break;
    case "setState": push(s, "state", now); s.states[a.key] = !!a.value; s.saidNo = false; fixCursor(data, s); break;
    case "applyAccess":
      push(s, "access", now); Object.assign(s.perms, a.perms || {}); Object.assign(s.states, a.states || {});
      s.saidNo = false; fixCursor(data, s, true); break;
    case "setMode": push(s, "mode", now); s.modeId = a.modeId; s.passMode = false; fixCursor(data, s, true); break;
    case "addExtra": push(s, "extra", now); if (!s.extra.includes(a.id)) s.extra.push(a.id); break;
    case "jump": s.cursor = a.id; break;
    case "enterPass": push(s, "pass", now); s.passMode = true; s.passes++; s.cursor = skippedList(data, s)[0] || null; break;
    case "giveUp":
      push(s, "giveup", now);
      for (const i of skippedList(data, s)) s.shots[i].status = "na";
      s.passMode = false; s.cursor = nextAfter(data, s, null); break;
    case "bulk":
      push(s, "bulk", now);
      for (const i of a.ids) {
        if (a.to === "skipped") { s.shots[i].status = "skipped"; s.shots[i].skipSeq = ++s.skipCounter; } else s.shots[i].status = a.to;
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
  const c = counts(data, s);
  const lines = [
    `Three Laps · ${s.name || "Машина без названия"} · режим ${modeOf(data, s.modeId).name}`,
    `Снято ${c.done} · Не нужно ${c.na + c.auto} · Пропущено ${c.skipped} · Ждут доступа ${c.locked} (в наборе ${c.total + c.na + c.auto})`,
  ];
  const L = { done: "снято", skipped: "пропущено", locked: "ждёт доступа", na: "не нужно", auto: "уже открыто", todo: "не снято" };
  for (const sh of modeIds(data, s).map((i) => byId(data)[i])) {
    const e = effective(s, sh), st = s.shots[sh.id];
    lines.push(`${sh.id} ${sh.title}${sh.part}: ${L[e]}${e === "done" && st.takes > 1 ? ` ×${st.takes}` : ""}${st.note ? " · " + st.note : ""}`);
  }
  const qa = Object.entries(s.qs).filter(([, v]) => v.answer || v.asked);
  if (qa.length) {
    lines.push("Вопросы хозяину:");
    for (const [q, v] of qa) lines.push(`${q}: ${v.asked ? "спросил" : ""} ${v.answer || ""}`);
  }
  return lines.join("\n");
}
export const modeName = (data, id) => modeOf(data, id).name;
