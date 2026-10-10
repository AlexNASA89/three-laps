import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as L from "./logic.js";

const data = JSON.parse(fs.readFileSync(new URL("./shots.json", import.meta.url)));
const mk = (o) => L.newSession(data, o);
const shot = (id) => data.shots.find((x) => x.id === id);
const doneAll = (s) => { let g = 0; while (s.cursor && g++ < 100) s = L.act(data, s, { type: "done", id: s.cursor }); return s; };
const seq = (s) => { const out = []; let g = 0; while (s.cursor && g++ < 100) { out.push(s.cursor); s = L.act(data, s, { type: "done", id: s.cursor }); } return [s, out]; };
const ALL = { touch: true, door: true, hood: true, engine: true };

test("первое касание: круг 1 = 9 точек, затем вопрос «дальше круг 2»", () => {
  let s = mk({});
  assert.deepEqual(L.queue(data, s), ["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  s = doneAll(s);
  assert.equal(L.endState(data, s), "stage");
  assert.equal(L.nextStage(data, s), 2);
});
test("круг 2 без доступа: 6 точек без касания, остальное ждёт; потом круг 3; без доступа — итог", () => {
  let s = doneAll(mk({}));
  s = L.act(data, s, { type: "addStage", circle: 2 });
  let order; [s, order] = seq(s);
  assert.deepEqual(order, ["10", "11", "13", "14", "15", "18a"]);
  assert.equal(L.endState(data, s), "stage"); assert.equal(L.nextStage(data, s), 3);
  s = L.act(data, s, { type: "addStage", circle: 3 });
  assert.equal(s.cursor, null);
  assert.equal(L.endState(data, s), "summary");
  assert.equal(L.counts(data, s).done, 15);
});
test("круг 2 с доступом (дверь+капот): жест «открыть дверь» перед салоном, «капот» перед мотором", () => {
  let s = doneAll(mk({}));
  s = L.act(data, s, { type: "addStage", circle: 2, perms: { touch: true, door: true, hood: true } });
  let order; [s, order] = seq(s);
  assert.deepEqual(order, ["10", "11", "13", "14", "15", "18a", "19", "17", "18b", "27", "12"]);
  assert.deepEqual(L.lockedList(data, s), ["16"]);   // мотор заводить не разрешили
  assert.equal(L.endState(data, s), "stage");          // не «есть разрешение?» — вопрос уже задан
  s = L.act(data, s, { type: "addStage", circle: 3, perms: {} });
  [s, order] = seq(s);
  assert.deepEqual(order, ["20", "21", "22", "23", "24", "25", "26", "28"]);
  assert.equal(L.endState(data, s), "summary");
});
test("полный режим: всё разрешено, три круга подряд → 29 точек", () => {
  let s = mk({ modeId: "full" });
  s = doneAll(s); assert.equal(L.endState(data, s), "stage");
  s = L.act(data, s, { type: "addStage", circle: 2 }); s = doneAll(s);
  s = L.act(data, s, { type: "addStage", circle: 3 }); s = doneAll(s);
  assert.equal(L.counts(data, s).done, 29);
  assert.equal(L.endState(data, s), "summary");
});
test("«Потом» на запертом ничего не меняет; снятое сильнее «заперто»", () => {
  let s = doneAll(mk({})); s = L.act(data, s, { type: "addStage", circle: 2 });
  assert.equal(L.act(data, s, { type: "skip", id: "17" }), s);
  s = L.act(data, s, { type: "setPerm", key: "door", value: true });
  s = L.act(data, s, { type: "done", id: "19" }); s = L.act(data, s, { type: "done", id: "17" });
  s = L.act(data, s, { type: "setPerm", key: "door", value: false });
  assert.equal(L.effective(s, shot("17")), "done");
});
test("хозяин сам открыл дверь: жест 19 = «уже открыто», салон доступен", () => {
  let s = doneAll(mk({})); s = L.act(data, s, { type: "addStage", circle: 2, states: { doorOpen: true } });
  assert.equal(L.effective(s, shot("19")), "auto");
  assert.ok(L.queue(data, s).includes("17"));
});
test("потом-потом: вопрос о пропущенном один раз, проход не зацикливается", () => {
  let s = mk({ modeId: "c1" });
  for (let i = 0; i < 9; i++) s = L.act(data, s, { type: "skip", id: s.cursor });
  assert.equal(L.endState(data, s), "skipped");
  s = L.act(data, s, { type: "enterPass" });
  let g = 0; while (s.cursor && g++ < 50) s = L.act(data, s, { type: "skip", id: s.cursor });
  assert.ok(g <= 10, "проход зациклился");
  assert.equal(L.endState(data, s), "summary");
});
test("пропущенное из круга 1 не всплывает после ответа на круге 2/3", () => {
  let s = mk({});
  for (let i = 0; i < 9; i++) s = L.act(data, s, { type: "skip", id: s.cursor });
  assert.equal(L.endState(data, s), "skipped");
  s = L.act(data, s, { type: "skipAsked" });
  assert.equal(L.endState(data, s), "stage");
  s = L.act(data, s, { type: "addStage", circle: 2 }); s = doneAll(s);
  assert.equal(L.endState(data, s), "stage");
  s = L.act(data, s, { type: "addStage", circle: 3 });
  assert.equal(L.endState(data, s), "summary");
  assert.equal(L.skippedList(data, s).length, 9);   // остались в итоге
});
test("«Отменить» восстанавливает; журнал ≤ 20", () => {
  let s = mk({}); for (let i = 0; i < 25; i++) s = L.act(data, s, { type: "take", id: "1" });
  assert.equal(s.events.length, 20); assert.equal(L.undo(s).shots["1"].takes, 24);
  let t = mk({}); const id = t.cursor; t = L.act(data, t, { type: "done", id }); assert.equal(L.undo(t).shots[id].status, "todo");
});
test("смена режима не стирает статусы и не трогает разрешения", () => {
  let s = mk({}); s = L.act(data, s, { type: "done", id: "1" }); const p = JSON.stringify(s.perms);
  s = L.act(data, s, { type: "setMode", modeId: "must" });
  assert.equal(s.shots["1"].status, "done"); assert.equal(JSON.stringify(s.perms), p);
});
test("быстрая: 6 точек; 19 и 27 ждут разрешения двери/капота", () => {
  let s = mk({ modeId: "quick" }); assert.equal(L.modeIds(data, s).length, 6); assert.deepEqual(L.lockedList(data, s), ["19", "27"]);
  s = L.act(data, s, { type: "setPerm", key: "door", value: true }); assert.deepEqual(L.lockedList(data, s), ["27"]);
  s = doneAll(s); assert.notEqual(L.endState(data, s), "stage");
});
test("«Завершить» и «Вернуться к съёмке»", () => {
  let s = mk({}); s = L.act(data, s, { type: "skip", id: s.cursor }); s = L.act(data, s, { type: "finishAll" });
  assert.equal(s.cursor, null); assert.equal(L.nextStage(data, s), null); assert.ok(L.hasMore(data, s));
  s = L.act(data, s, { type: "resume" }); assert.ok(s.cursor);
});
test("порядок данных: 19 → 17 → 18б → салон → 27 → 12 → 16 → 28", () => {
  assert.deepEqual(data.order.slice(14), ["18a", "19", "17", "18b", "20", "21", "22", "23", "24", "25", "26", "27", "12", "16", "28"]);
});

// ---------- «обезьяна»: тысячи случайных нажатий, проверка инвариантов ----------
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
function check(s, finished) {
  const ids = L.modeIds(data, s);
  if (s.cursor) {
    assert.ok(ids.includes(s.cursor), `курсор ${s.cursor} вне набора`);
    assert.ok(["todo", "skipped", "done"].includes(L.effective(s, shot(s.cursor))), `курсор на ${L.effective(s, shot(s.cursor))}`);
  } else if (!finished) {
    assert.notEqual(L.endState(data, s), null, "курсор пуст, но очередь не пуста — тупик");
  }
  const c = L.counts(data, s);
  assert.equal(c.done + c.na + c.skipped + c.locked + c.todo + c.auto, ids.length);
}
function answer(r, s, e) {   // ответ на экран конца очереди
  if (e === "skipped") return pick(r, [{ type: "enterPass" }, { type: "skipAsked" }, { type: "giveUp" }]);
  if (e === "stage") {
    const c = L.nextStage(data, s);
    return pick(r, [{ type: "addStage", circle: c }, { type: "addStage", circle: c, perms: { touch: true, door: true, hood: true } },
      { type: "addStage", circle: c, perms: { touch: true, door: true } }, { type: "addStage", circle: c, states: { hoodOpen: true } }]);
  }
  if (e === "perms") return pick(r, [{ type: "saidNo" }, { type: "applyAccess", perms: ALL, answered: true }]);
  return null;
}
test("обезьяна: случайные нажатия не ломают инварианты", () => {
  const modes = data.modes.map((m) => m.id);
  for (let run = 0; run < 400; run++) {
    const r = rng(run + 1); let s = mk({ modeId: pick(r, modes) }); let finished = false;
    for (let step = 0; step < 300; step++) {
      let a;
      if (s.cursor) {
        a = pick(r, [{ type: "done", id: s.cursor }, { type: "done", id: s.cursor }, { type: "skip", id: s.cursor }, { type: "skip", id: s.cursor },
          { type: "na", id: s.cursor }, { type: "take", id: s.cursor }, { type: "setPerm", key: pick(r, L.PERMS), value: r() < 0.5 },
          { type: "setState", key: pick(r, ["doorOpen", "hoodOpen"]), value: r() < 0.5 }, { type: "undo" },
          { type: "setMode", modeId: pick(r, modes) }, { type: "bulk", ids: [pick(r, data.order)], to: pick(r, ["skipped", "na", "todo"]) }]);
        if (r() < 0.02) a = { type: "finishAll" };
      } else {
        const e = L.endState(data, s);
        if (finished || e === "summary" || e === null) { if (r() < 0.3) { a = { type: "resume" }; } else break; }
        else a = answer(r, s, e);
      }
      s = a.type === "undo" ? L.undo(s) : L.act(data, s, a);
      if (a.type === "finishAll") finished = true;
      if (a.type === "resume" || a.type === "undo") finished = false;
      check(s, finished || a.type === "undo");
    }
  }
});
test("обезьяна-«потом»: всегда «Потом» и первый вариант ответа — съёмка заканчивается", () => {
  for (const modeId of data.modes.map((m) => m.id)) {
    let s = mk({ modeId }); let steps = 0;
    while (steps++ < 500) {
      if (s.cursor) { s = L.act(data, s, { type: "skip", id: s.cursor }); continue; }
      const e = L.endState(data, s);
      if (e === "summary") break;
      s = L.act(data, s, e === "skipped" ? { type: "enterPass" } : e === "stage" ? { type: "addStage", circle: L.nextStage(data, s) } : { type: "saidNo" });
    }
    assert.ok(steps < 200, `${modeId}: съёмка не заканчивается (${steps} шагов)`);
  }
});
