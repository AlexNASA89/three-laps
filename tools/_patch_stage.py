import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rd(n): return open(os.path.join(ROOT, n), encoding="utf-8").read()
def wr(n, t): open(os.path.join(ROOT, n), "w", encoding="utf-8", newline="\n").write(t)
def rep(t, a, b):
    assert a in t, a[:70]
    return t.replace(a, b, 1)

t = rd("logic.js")
# --- nextAfter / endState / fixCursor: проход пропущенного идёт по фиксированному списку, каждый кадр один раз
t = rep(t, '''export function nextAfter(data, s, fromId) {
  if (s.passMode && !skippedList(data, s).length) s.passMode = false;
  if (s.passMode) return skippedList(data, s).find((i) => i !== fromId) || null;
''', '''function passNext(data, s) {
  if (!s.passMode) return null;
  const seen = s.passSeen || [];
  const nx = (s.passQueue || []).find((i) => !seen.includes(i) && effective(s, byId(data)[i]) === "skipped");
  if (!nx) { s.passMode = false; s.passQueue = []; s.passSeen = []; }
  return nx || null;
}
export function nextAfter(data, s, fromId) {
  if (s.passMode) { const nx = passNext(data, s); if (nx) return nx; }
''')
t = rep(t, '''export function endState(data, s) {
  if (s.passMode && skippedList(data, s).length) return null;
  if (queue(data, s).length) return null;
  if (skippedList(data, s).length) return "skipped";
  if (lockedList(data, s).length && !s.saidNo) return "perms";
  return "summary";
}''', '''// следующий круг, которого ещё нет в наборе (только для круговых режимов); отказ от круга запоминается
export function nextStage(data, s) {
  if (!["first", "c1", "c2"].includes(s.modeId)) return null;
  const inSet = new Set(modeIds(data, s)), dec = s.declined || {};
  const cs = data.shots.filter((x) => !inSet.has(x.id) && s.shots[x.id].status !== "na" && !dec[x.circle]).map((x) => x.circle);
  return cs.length ? Math.min(...cs) : null;
}
export function stageIds(data, s, c) {
  const inSet = new Set(modeIds(data, s));
  return data.order.filter((i) => byId(data)[i].circle === c && !inSet.has(i) && s.shots[i].status !== "na");
}
// куда вести, когда очередь пуста. Каждый вопрос задаётся один раз: пропущенное, доступ, следующий круг
export function endState(data, s) {
  if (s.passMode && passNext(data, s)) return null;
  if (queue(data, s).length) return null;
  if (skippedList(data, s).length && !s.skipAsked) return "skipped";
  if (lockedList(data, s).length && !s.saidNo) return "perms";
  if (nextStage(data, s)) return "stage";
  return "summary";
}
// есть ли что ещё снимать (для кнопки «Вернуться к съёмке» в итоге)
export function hasMore(data, s) {
  return queue(data, s).length > 0 || skippedList(data, s).length > 0 || !!nextStage(data, s) || lockedList(data, s).length > 0;
}''')
t = rep(t, '''function fixCursor(data, s, force) {
  if (s.passMode && !skippedList(data, s).length) s.passMode = false;
  const sh = s.cursor && byId(data)[s.cursor];
  const ok = sh && modeIds(data, s).includes(s.cursor) && ["todo", "skipped", "done"].includes(effective(s, sh));
  if (force || !ok) s.cursor = (s.passMode ? skippedList(data, s)[0] : queue(data, s)[0]) || null;
  return s;
}''', '''function fixCursor(data, s, force) {
  const pn = s.passMode ? passNext(data, s) : null;
  const sh = s.cursor && byId(data)[s.cursor];
  const ok = sh && modeIds(data, s).includes(s.cursor) && ["todo", "skipped", "done"].includes(effective(s, sh));
  if (force || !ok) s.cursor = (pn || queue(data, s)[0]) || null;
  return s;
}
const seenPass = (s, id) => { if (s.passMode) (s.passSeen = s.passSeen || []).push(id); };''')
t = rep(t, '''      if (sh.opens) s.states[sh.opens] = true;
      s.cursor = nextAfter(data, s, a.id); break;''', '''      if (sh.opens) s.states[sh.opens] = true;
      seenPass(s, a.id); s.cursor = nextAfter(data, s, a.id); break;''')
t = rep(t, '''      push(s, "skip", now); st.status = "skipped"; st.skipSeq = ++s.skipCounter;
      s.cursor = nextAfter(data, s, a.id); break;''', '''      push(s, "skip", now); st.status = "skipped"; st.skipSeq = ++s.skipCounter;
      seenPass(s, a.id); s.cursor = nextAfter(data, s, a.id); break;''')
t = rep(t, '''      push(s, "na", now); st.status = "na";
      if (s.cursor === a.id) s.cursor = nextAfter(data, s, a.id);''', '''      push(s, "na", now); st.status = "na"; seenPass(s, a.id);
      if (s.cursor === a.id) s.cursor = nextAfter(data, s, a.id);''')
t = rep(t, '''    case "setMode": push(s, "mode", now); s.modeId = a.modeId; s.passMode = false; fixCursor(data, s, true); break;''', '''    case "setMode": push(s, "mode", now); s.modeId = a.modeId; s.passMode = false; s.declined = {}; s.skipAsked = false; fixCursor(data, s, true); break;''')
t = rep(t, '''    case "enterPass": push(s, "pass", now); s.passMode = true; s.passes++; s.cursor = skippedList(data, s)[0] || null; break;''', '''    case "enterPass":
      push(s, "pass", now); s.skipAsked = true; s.passes++; s.passQueue = skippedList(data, s); s.passSeen = []; s.passMode = s.passQueue.length > 0;
      s.cursor = s.passQueue[0] || null; break;
    case "skipAsked": s.skipAsked = true; break;
    case "addStage": {   // открыть следующий круг; доступ можно выдать сразу, а можно «без доступа»: запертое не мешает очереди
      push(s, "stage", now);
      if (a.perms) Object.assign(s.perms, a.perms);
      if (a.states) Object.assign(s.states, a.states);
      for (const i of stageIds(data, s, a.circle)) if (!s.extra.includes(i)) s.extra.push(i);
      s.skipAsked = false; s.saidNo = !!a.noAccess; s.passMode = false;
      s.cursor = queue(data, s)[0] || null; break;
    }
    case "finishAll":    // «Завершить»: больше ничего не предлагать, всё остаётся в итоге
      push(s, "finish", now); s.declined = { 1: true, 2: true, 3: true }; s.skipAsked = true; s.saidNo = true; s.passMode = false; s.cursor = null; break;''')
t = rep(t, '''      for (const i of skippedList(data, s)) s.shots[i].status = "na";
      s.passMode = false; s.cursor = nextAfter(data, s, null); break;''', '''      for (const i of skippedList(data, s)) s.shots[i].status = "na";
      s.skipAsked = true; s.passMode = false; s.cursor = nextAfter(data, s, null); break;''')
wr("logic.js", t)

t = rd("logic.test.mjs")
t += '''
test("потом-потом: проход пропущенного заканчивается, повторно не предлагается", () => {
  let s = mk({ modeId: "c1" });
  for (let i = 0; i < 9; i++) s = L.act(data, s, { type: "skip", id: s.cursor });
  assert.equal(L.endState(data, s), "skipped");
  s = L.act(data, s, { type: "enterPass" });
  let guard = 0;
  while (s.cursor && guard++ < 50) s = L.act(data, s, { type: "skip", id: s.cursor });   // снова «Потом» на каждом
  assert.ok(guard <= 10, "проход зациклился");
  assert.equal(s.passMode, false);
  assert.notEqual(L.endState(data, s), "skipped");
});
test("первое касание: после круга 1 предлагается круг 2, потом круг 3, потом итог", () => {
  let s = mk({});
  for (const id of L.queue(data, s)) s = L.act(data, s, { type: "done", id });
  assert.equal(L.endState(data, s), "stage"); assert.equal(L.nextStage(data, s), 2);
  s = L.act(data, s, { type: "addStage", circle: 2, noAccess: true });
  assert.equal(s.cursor, null);   // без доступа всё запертое
  assert.equal(L.endState(data, s), "stage"); assert.equal(L.nextStage(data, s), 3);
  s = L.act(data, s, { type: "addStage", circle: 3, noAccess: true });
  assert.equal(L.endState(data, s), "summary");
  assert.ok(L.lockedList(data, s).length > 0);
});
test("круг 2 с доступом: дверь+капот → все точки круга снимаются", () => {
  let s = mk({});
  for (const id of L.queue(data, s)) s = L.act(data, s, { type: "done", id });
  s = L.act(data, s, { type: "addStage", circle: 2, perms: { touch: true, door: true, hood: true, engine: true } });
  assert.ok(s.cursor);
  let guard = 0;
  while (s.cursor && guard++ < 60) s = L.act(data, s, { type: "done", id: s.cursor });
  assert.equal(L.nextStage(data, s), 3);
});
test("«Завершить» ведёт в итог и больше ничего не предлагает", () => {
  let s = mk({}); s = L.act(data, s, { type: "skip", id: s.cursor });
  s = L.act(data, s, { type: "finishAll" });
  assert.equal(L.endState(data, s), "summary"); assert.equal(L.nextStage(data, s), null);
});
test("в быстром режиме круги не предлагаются", () => {
  let s = mk({ modeId: "quick" });
  for (const id of L.queue(data, s)) s = L.act(data, s, { type: "done", id });
  assert.notEqual(L.endState(data, s), "stage");
});
'''
wr("logic.test.mjs", t)
print("ok")
