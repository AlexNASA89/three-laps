// Хранилище v0.5: только настройки и последняя позиция (localStorage). Если хранилище недоступно — работаем без него.
const KEY = "tl5_";
export function get(k, d) {
  try { const v = localStorage.getItem(KEY + k); return v === null ? d : JSON.parse(v); } catch { return d; }
}
export function set(k, v) {
  try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* приватный режим, квота */ }
}
