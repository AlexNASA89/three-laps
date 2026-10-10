// Хранилище: IndexedDB (сессии, настройки) с запасом в localStorage. Один документ сессии — одна запись.
const DB = "threelaps", VER = 1;
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (!("indexedDB" in self)) return rej(new Error("no idb"));
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore("sessions", { keyPath: "id" }); d.createObjectStore("kv"); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
const tx = (store, mode, fn) => open().then((db) => new Promise((res, rej) => {
  const t = db.transaction(store, mode); const out = fn(t.objectStore(store));
  t.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
}));
const LS = "tl_sessions_v1";
function lsAll() { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } }
export async function saveSession(s) {
  try { await tx("sessions", "readwrite", (o) => o.put(s)); } catch { const a = lsAll(); a[s.id] = s; try { localStorage.setItem(LS, JSON.stringify(a)); } catch { /* квота */ } }
}
export async function allSessions() {
  try { const r = await tx("sessions", "readonly", (o) => o.getAll()); return r || []; } catch { return Object.values(lsAll()); }
}
export async function deleteSession(id) {
  try { await tx("sessions", "readwrite", (o) => o.delete(id)); } catch { const a = lsAll(); delete a[id]; localStorage.setItem(LS, JSON.stringify(a)); }
}
export async function getKV(k, d) { try { const r = await tx("kv", "readonly", (o) => o.get(k)); return r === undefined ? d : r; } catch { try { return JSON.parse(localStorage.getItem("kv_" + k)) ?? d; } catch { return d; } } }
export async function setKV(k, v) { try { await tx("kv", "readwrite", (o) => o.put(v, k)); } catch { try { localStorage.setItem("kv_" + k, JSON.stringify(v)); } catch { /* */ } } }
export async function persist() { try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch { return false; } }
