import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as L from "./logic.js";

const data = JSON.parse(fs.readFileSync(new URL("./shots.json", import.meta.url)));
const cards = (rid) => L.points(data, rid).map((p) => p.card);

test("снаружи: 1 → 1+ → 2 → … → 9 → 9+ → VIN", () => {
  const exp = [];
  for (let n = 1; n <= 9; n++) exp.push(String(n).padStart(2, "0"), String(n).padStart(2, "0") + "p");
  exp.push("vin");
  assert.deepEqual(cards("out"), exp);
  assert.deepEqual(L.points(data, "out").map((p) => p.tag).slice(0, 4), ["1", "1+", "2", "2+"]);
  assert.equal(L.points(data, "out").at(-1).label, "VIN · финал");
});

test("салон: 19, 17, 20…28", () => {
  assert.deepEqual(cards("salon"), ["19", "17", "20", "21", "22", "23", "24", "25", "26", "27", "28"]);
});

test("листание: на концах null, без перескока по кругу", () => {
  for (const rid of L.ROUTE_IDS) {
    const n = L.points(data, rid).length;
    assert.equal(L.prev(data, rid, 0), null);
    assert.equal(L.next(data, rid, n - 1), null);
    assert.equal(L.next(data, rid, 0), 1);
    assert.equal(L.prev(data, rid, n - 1), n - 2);
    let i = 0, seen = 1;
    while (L.next(data, rid, i) !== null) { i = L.next(data, rid, i); seen++; }
    assert.equal(seen, n);
  }
});

test("позиция «4+ · 8 из 19»", () => {
  const i = L.indexOf(data, "out", "4p");
  assert.equal(L.position(data, "out", i), "4+ · 8 из 19");
  assert.equal(L.position(data, "salon", 0), "19 · 1 из 11");
});

test("у каждой точки есть карточка, метка и уникальный id", () => {
  for (const r of data.routes) {
    assert.ok(r.maps.length, r.id);
    const mapCards = r.maps.map((m) => m.card);
    const ids = new Set();
    for (const p of r.points) {
      assert.match(p.card, /^[0-9a-z]+$/, p.id);
      assert.ok(p.label && p.label.trim(), p.id);
      assert.ok(p.tag, p.id);
      assert.ok(mapCards.includes(p.map), p.id + " map");
      assert.ok(!ids.has(p.id), p.id); ids.add(p.id);
    }
  }
  assert.equal(data.pre.card, "pre");
  assert.deepEqual(data.routes.map((r) => r.maps.map((m) => m.card)), [["map_out1", "map_out2"], ["map_salon"]]);
  const names = L.cardNames(data);
  assert.equal(names.length, 1 + 3 + 19 + 11);
  assert.ok(!names.includes("map_out"));
  assert.equal(L.cardPath("04p", "dark", true), "cards/dark/thumb/04p.webp");
});

test("карта «Снаружи»: 9 точек по две подписи + финал", () => {
  const g = L.groups(data, "out");
  assert.equal(g.length, 10);
  for (let k = 0; k < 9; k++) {
    assert.equal(g[k].tag, String(k + 1));
    assert.deepEqual(g[k].items.map((x) => x.p.plus), [false, true]);
  }
  assert.equal(g[9].tag, "VIN"); assert.equal(g[9].items.length, 1);
  assert.equal(L.groups(data, "salon").length, 11);
});

test("карта точки: 1–9 на круге 1, 1+…9+ и VIN на круге 2, салон — своя", () => {
  for (const p of L.points(data, "out")) {
    const i = L.indexOf(data, "out", p.id);
    assert.equal(L.mapOf(data, "out", i).card, /^\d$/.test(p.id) ? "map_out1" : "map_out2", p.id);
  }
  assert.equal(L.mapIndexOf(data, "out", L.indexOf(data, "out", "vin")), 1);
  assert.equal(L.mapOf(data, "salon", 3).card, "map_salon");
});

test("индексы вне диапазона приводятся к маршруту", () => {
  assert.equal(L.clampIndex(data, "out", 99), 18);
  assert.equal(L.clampIndex(data, "out", -3), 0);
  assert.equal(L.route(data, "nope").id, "out");
});

test("в данных нет старой логики чек-листа", () => {
  const txt = fs.readFileSync(new URL("./shots.json", import.meta.url), "utf8") + fs.readFileSync(new URL("./logic.js", import.meta.url), "utf8")
    + fs.readFileSync(new URL("./app.js", import.meta.url), "utf8") + fs.readFileSync(new URL("./content.js", import.meta.url), "utf8");
  for (const w of ["perm", "grant", "FIELDS", "ONBOARD", "skipped", "modes", "doorOpen", "hoodOpen"]) assert.ok(!txt.includes(w), w);
});
