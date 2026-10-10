import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rd(n): return open(os.path.join(ROOT, n), encoding="utf-8").read()
def wr(n, t): open(os.path.join(ROOT, n), "w", encoding="utf-8", newline="\n").write(t)
def rep(t, a, b):
    assert a in t, a[:60]
    return t.replace(a, b, 1)

t = rd("content.js")
i = t.index("// 30 машинок"); j = t.index("export const nextIcon")
t = t[:i] + '''// 30 значков-машинок: временные вырезки проекта (tools/make_icons.py), потом заменим на свои/свободные.
export function carIcon(i, size = 56) {
  const n = ((i % 30) + 30) % 30;
  return `<img src="icons/cars/${String(n).padStart(2, "0")}.webp" alt="" style="width:${size}px;height:auto;display:block">`;
}
''' + t[j:]
t = t.replace("// v2\n", "")
wr("content.js", t)

t = rd("app.js")
t = rep(t, 'const root = $("#app");', '''const root = $("#app");
const errs = () => { try { return JSON.parse(localStorage.getItem("tl_errs") || "[]"); } catch { return []; } };
function logErr(m) { const a = errs(); a.push({ ts: Date.now(), m: String(m).slice(0, 300) }); while (a.length > 30) a.shift(); try { localStorage.setItem("tl_errs", JSON.stringify(a)); } catch { /* */ } }
addEventListener("error", (e) => logErr(`${e.message} @${String(e.filename || "").split("/").pop()}:${e.lineno}`));
addEventListener("unhandledrejection", (e) => logErr("promise: " + ((e.reason && e.reason.message) || e.reason)));''')
t = rep(t, 'filter: "all", select: null,', 'filter: "all", bugs: [], version: "?", select: null,')
t = rep(t, '<button class="btn ghost" data-a="settings" style="margin-top:18px">Настройки</button>', '<button class="btn ghost" data-a="settings" style="margin-top:18px">Настройки</button><button class="btn ghost" data-a="bug">Заметил ошибку</button>')
t = rep(t, '<span class="small mut" style="align-self:center">свайп листает</span>', '<button data-a="bug">Ошибка</button>')
t = rep(t, '<button class="btn" data-a="export" style="margin-top:12px">Сохранить все данные файлом</button>', '<button class="btn" data-a="bugs" style="margin-top:12px">Ошибки и заметки (${app.bugs.length})</button><button class="btn" data-a="logs">Подготовить логи</button><button class="btn" data-a="export">Сохранить все данные файлом</button>')
t = rep(t, '<div class="small mut" style="margin-top:12px">Всё хранится в телефоне.', '<div class="small mut" style="margin-top:12px">Версия ${esc(app.version)}. Всё хранится в телефоне.')
t = rep(t, "  phrases() {", '''  bugs() { return `<div class="scr"><h2>Ошибки и заметки</h2><div class="small mut">Здесь то, что вы заметили при проверке. Потом нажмите «Подготовить логи», скопируйте и пришлите.</div>
      ${app.bugs.length ? app.bugs.slice().reverse().map((b) => `<div class="ph"><div class="small mut">${new Date(b.ts).toLocaleString("ru")} · ${esc(b.screen)}${b.shot ? " · №" + esc(b.shot) : ""}${b.car ? " · " + esc(b.car) : ""}</div><div>${esc(b.text)}</div><button class="btn ghost" style="min-height:44px;margin:8px 0 0" data-a="bugdel" data-id="${b.id}">Удалить</button></div>`).join("") : `<div class="card mut">Пока пусто.</div>`}
      <button class="btn" data-a="bug">Добавить заметку</button><button class="btn go" data-a="logs">Подготовить логи</button><button class="btn ghost" data-a="back">Назад</button></div>`; },
  phrases() {''')
t = rep(t, '  if (app.sheet === "access") {', '''  if (app.sheet === "bug") return sheet(`<h2>Заметил ошибку</h2><div class="small mut">Что не так? Сохранится вместе с экраном и кадром.</div><textarea id="bugtxt" rows="5" placeholder="Например: кнопка «Снял» не нажимается на кадре 7"></textarea><button class="btn go" data-a="bugsave">Сохранить</button><button class="btn ghost" data-a="closesheet">Отмена</button>`);
  if (app.sheet && app.sheet.t === "logs") return sheet(`<h2>Логи</h2><div class="small mut">Скопируйте и пришлите мне.</div><textarea id="logtxt" rows="12" readonly style="font-size:12px">${esc(app.sheet.text)}</textarea><button class="btn go" data-a="logcopy">Скопировать</button><button class="btn" data-a="logfile">Сохранить файл</button><button class="btn ghost" data-a="closesheet">Закрыть</button>`);
  if (app.sheet === "access") {''')
t = rep(t, '<button class="btn" data-a="phrases">Фразы для хозяина</button>', '<button class="btn" data-a="phrases">Фразы для хозяина</button><button class="btn" data-a="bug">Заметил ошибку</button>')
t = rep(t, '    case "toast": {', '''    case "bug": app.sheet = "bug"; render(); setTimeout(() => { const x = $("#bugtxt"); if (x) x.focus(); }, 80); break;
    case "bugsave": { const txt = ($("#bugtxt") || {}).value || ""; if (!txt.trim()) break; app.bugs.push({ id: "b" + Date.now().toString(36), ts: Date.now(), screen: app.screen, shot: app.cur && app.cur.cursor, car: app.cur && app.cur.name, text: txt.trim() }); await S.setKV("bugs", app.bugs); app.sheet = null; showToast("Заметка сохранена", "", null, 2500); break; }
    case "bugdel": app.bugs = app.bugs.filter((b) => b.id !== id); await S.setKV("bugs", app.bugs); render(); break;
    case "bugs": go("bugs"); break;
    case "logs": app.sheet = { t: "logs", text: await buildLogs() }; render(); break;
    case "logcopy": { const x = $("#logtxt"); try { await navigator.clipboard.writeText(app.sheet.text); showToast("Скопировано", "", null, 2000); } catch { x.select(); document.execCommand("copy"); showToast("Скопировано", "", null, 2000); } break; }
    case "logfile": download("three-laps-logs.txt", app.sheet.text); break;
    case "toast": {''')
t = rep(t, "function resume() {", '''async function buildLogs() {
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
  return o.join("\\n");
}
function resume() {''')
t = rep(t, '  app.sessions = await S.allSessions(); S.persist();', '''  app.sessions = await S.allSessions(); app.bugs = await S.getKV("bugs", []); S.persist();
  try { app.version = (await (await fetch("precache.json")).json()).version; } catch { /* */ }''')
wr("app.js", t)
print("patched")
