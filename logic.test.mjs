import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as L from "./logic.js";

const data = JSON.parse(fs.readFileSync(new URL("./shots.json", import.meta.url)));
const mk = (o) => L.newSession(data, o);
const shot = (id) => data.shots.find((x) => x.id === id);

test("первое касание = 15 доступных точек", () => {
  const s = mk({});
  assert.equal(L.queue(data, s).length, 15);
  assert.equal(L.counts(data, s).total, 15);
  assert.equal(L.lockedList(data, s).length, 0);
});
test("полный набор без разрешений: 15 доступно, 14 заперто", () => {
  const s = mk({ modeId: "full" });
  assert.equal(L.queue(data, s).length, 15);
  assert.equal(L.lockedList(data, s).length, 14);
});
test("все разрешения + 19 и 27 открывают все 29", () => {
  let s = mk({ modeId: "full", perms: { touch: 1, door: 1, hood: 1, engine: 1 } });
  s = L.act(data, s, { type: "done", id: "19" });
  s = L.act(data, s, { type: "done", id: "27" });
  assert.equal(L.lockedList(data, s).length, 0);
  assert.equal(L.counts(data, s).total, 29);
});
test("«Потом» на запертом ничего не меняет", () => {
  const s = mk({ modeId: "full" });
  assert.equal(L.act(data, s, { type: "skip", id: "17" }), s);
});
test("снятое сильнее «заперто»: выключили доступ — остаётся снятым", () => {
  let s = mk({ modeId: "full", perms: { touch: 1, door: 1 } });
  s = L.act(data, s, { type: "done", id: "19" });
  s = L.act(data, s, { type: "done", id: "17" });
  s = L.act(data, s, { type: "setPerm", key: "door", value: false });
  assert.equal(L.effective(s, shot("17")), "done");
});
test("хозяин уже открыл дверь: 19 = auto, салон доступен", () => {
  let s = mk({ modeId: "full" });
  s = L.act(data, s, { type: "setState", key: "doorOpen", value: true });
  assert.equal(L.effective(s, shot("19")), "auto");
  assert.ok(L.queue(data, s).includes("17"));
});
test("потом → пропущенное → проход → пропустить насовсем", () => {
  let s = mk({ modeId: "c1" });
  for (let i = 0; i < 9; i++) s = L.act(data, s, { type: "skip", id: s.cursor });
  assert.equal(L.endState(data, s), "skipped");
  assert.equal(L.skippedList(data, s).length, 9);
  s = L.act(data, s, { type: "enterPass" });
  assert.ok(s.cursor);
  s = L.act(data, s, { type: "done", id: s.cursor });
  s = L.act(data, s, { type: "giveUp" });
  assert.equal(L.skippedList(data, s).length, 0);
});
test("конец очереди: запертые → экран разрешений; «Нет» запоминается; смена разрешения сбрасывает", () => {
  let s = mk({ modeId: "full" });
  for (const id of L.queue(data, s)) s = L.act(data, s, { type: "done", id });
  assert.equal(L.endState(data, s), "perms");
  s = L.act(data, s, { type: "saidNo" });
  assert.equal(L.endState(data, s), "summary");
  s = L.act(data, s, { type: "setPerm", key: "door", value: true });
  assert.equal(s.saidNo, false);
});
test("«Отменить» восстанавливает; журнал ≤ 20", () => {
  let s = mk({});
  for (let i = 0; i < 25; i++) s = L.act(data, s, { type: "take", id: "1" });
  assert.equal(s.events.length, 20);
  assert.equal(L.undo(s).shots["1"].takes, 24);
  let t = mk({});
  const id = t.cursor;
  t = L.act(data, t, { type: "done", id });
  assert.equal(L.undo(t).shots[id].status, "todo");
});
test("смена режима не стирает статусы и не трогает разрешения", () => {
  let s = mk({});
  s = L.act(data, s, { type: "done", id: "1" });
  const p = JSON.stringify(s.perms);
  s = L.act(data, s, { type: "setMode", modeId: "full" });
  assert.equal(s.shots["1"].status, "done");
  assert.equal(JSON.stringify(s.perms), p);
});
test("быстрая: 6 точек, 19 и 27 заперты без разрешений", () => {
  const s = mk({ modeId: "quick" });
  assert.equal(L.modeIds(data, s).length, 6);
  assert.equal(L.lockedList(data, s).length, 2);
});
test("порядок очереди: 19 → 17 → 18б → салон → 27 → 12 → 16 → 28", () => {
  assert.deepEqual(data.order.slice(14), ["18a", "19", "17", "18b", "20", "21", "22", "23", "24", "25", "26", "27", "12", "16", "28"]);
});
test("после прохода пропущенного очередь не залипает (passMode сбрасывается)", () => {
  let s = mk({ modeId: "full", perms: { touch: 1, door: 1, hood: 1, engine: 1 } });
  s = L.act(data, s, { type: "skip", id: s.cursor });
  for (const id of L.queue(data, s)) { s = L.act(data, s, { type: "done", id }); if (s.cursor === null) break; }
  s = L.act(data, s, { type: "enterPass" });
  s = L.act(data, s, { type: "done", id: s.cursor });
  s = L.act(data, s, { type: "applyAccess", perms: { engine: true }, states: {} });
  assert.equal(s.passMode, false);
  assert.ok(s.cursor === null || L.queue(data, s).includes(s.cursor));
});
