// Three Laps v0.5 — модуль маршрута (ТЗ v4.1). Без DOM: работает в браузере и в node (тесты logic.test.mjs).
// data = shots.json: { pre, routes: [{ id: "out" | "salon", title, maps: [{ card, title, short }], points: [{ id, tag, card, map, label, note? }] }] }
// «Снаружи» — две карты: map_out1 (круг 1, точки 1–9) и map_out2 (круг 2, 1+…9+ и VIN).

export const ROUTE_IDS = ["out", "salon"];

export function route(data, rid) {
  return data.routes.find((r) => r.id === rid) || data.routes[0];
}
export const points = (data, rid) => route(data, rid).points;
export const pointAt = (data, rid, i) => points(data, rid)[i] || null;
export const indexOf = (data, rid, id) => points(data, rid).findIndex((p) => p.id === id);

// соседняя точка по порядку маршрута; на концах — null (не по кругу)
export function step(data, rid, i, dir) {
  const j = i + dir;
  return j >= 0 && j < points(data, rid).length ? j : null;
}
export const next = (data, rid, i) => step(data, rid, i, 1);
export const prev = (data, rid, i) => step(data, rid, i, -1);

// «4+ · 8 из 19»
export function position(data, rid, i) {
  const p = pointAt(data, rid, i), n = points(data, rid).length;
  return p ? `${p.tag} · ${i + 1} из ${n}` : "";
}

// карта «Снаружи»: точки 1…9, у каждой общий план и «+»; финал (VIN) отдельно
export function groups(data, rid) {
  const out = [];
  points(data, rid).forEach((p, i) => {
    const g = p.point != null && out.find((x) => x.point === p.point);
    if (g) g.items.push({ p, i });
    else out.push({ point: p.point, tag: p.point != null ? String(p.point) : p.tag, items: [{ p, i }] });
  });
  return out;
}

// карты маршрута и карта, на которой стоит точка i
export const maps = (data, rid) => route(data, rid).maps;
export function mapIndexOf(data, rid, i) {
  const p = pointAt(data, rid, i), m = maps(data, rid);
  return Math.max(0, p ? m.findIndex((x) => x.card === p.map) : 0);
}
export const mapOf = (data, rid, i) => maps(data, rid)[mapIndexOf(data, rid, i)];

// все имена карточек, нужные приложению (для проверки и офлайн-кэша)
export function cardNames(data) {
  const s = new Set([data.pre.card]);
  for (const r of data.routes) { for (const m of r.maps) s.add(m.card); for (const p of r.points) s.add(p.card); }
  return [...s];
}

export const cardPath = (name, theme, thumb = false) => `cards/${theme}/${thumb ? "thumb/" : ""}${name}.webp`;
export const clampIndex = (data, rid, i) => Math.min(Math.max(0, i | 0), points(data, rid).length - 1);
