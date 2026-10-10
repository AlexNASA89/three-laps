import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rd(n): return open(os.path.join(ROOT, n), encoding="utf-8").read()
def wr(n, t): open(os.path.join(ROOT, n), "w", encoding="utf-8", newline="\n").write(t)
def rep(t, a, b):
    assert a in t, a[:90]
    return t.replace(a, b, 1)

t = rd("app.js")
t = rep(t, 'import { PHRASES, TIPS, QUESTIONS, ONBOARD, carIcon, nextIcon } from "./content.js";',
           'import { TALK, TALK_FLAT, talkLine, ONBOARD, carIcon, nextIcon } from "./content.js";')
t = rep(t, 'hold: false, sheet: null, owner: null, exact: false,', 'hold: false, sheet: null, owner: null, exact: false, talkSec: null,')
# --- экран «Разговор с хозяином» вместо qs/phrases
i = t.index("  qs() {"); j = t.index("  bugs() {")
t = t[:i] + '''  talk() {
    const s = app.cur, nm = app.settings.myName;
    const chips = TALK.map((sec) => `<button data-a="talkgo" data-id="${sec.id}">${esc(sec.title)}</button>`).join("");
    const body = TALK.map((sec) => `<div class="ghead" id="sec-${sec.id}">${esc(sec.title)}</div>${sec.tip ? `<div class="small mut">${esc(sec.tip)}</div>` : ""}
      ${sec.lines.map((l0) => { const l = talkLine(l0, nm), v = (s && s.qs[l.id]) || {}, k = TALK_FLAT.findIndex((x) => x.id === l.id);
        return `<div class="ph ${l.q ? "q" : ""}"><div class="en">${esc(l.en)}</div><div class="ru">${esc(l.ru)}</div>
          <div class="row" style="margin-top:8px"><button class="btn" style="min-height:48px;margin:0" data-a="owner" data-id="${k}">Показать хозяину</button>
          ${l.q && s ? `<label class="chk"><input type="checkbox" data-q="${l.id}" data-f="asked" ${v.asked ? "checked" : ""}> спросил</label>` : ""}</div>
          ${l.q && s ? `<textarea data-q="${l.id}" data-f="answer" rows="2" placeholder="Ответ (можно голосом с клавиатуры)">${esc(v.answer || "")}</textarea>` : ""}</div>`; }).join("")}`).join("");
    return `<div class="top"><div class="p">Разговор с хозяином<small>читайте с экрана или покажите крупно</small></div><button class="chip" data-a="back">Готово</button></div>
      <div class="fil pad">${chips}</div><div class="scr" id="talkscr">${nm ? "" : `<div class="card small">Совет: впишите своё имя в Настройках — оно появится во фразе знакомства.</div>`}${body}
      <button class="btn" data-a="back">Назад</button></div>`;
  },
''' + t[j:]
i = t.index("  phrases() {"); j = t.index("  settings() {")
t = t[:i] + t[j:]
# --- имя в настройках
t = rep(t, '''      ${tog("wake", "Экран не гаснет на кадре", st.wake, "set")}''', '''      <div class="small mut" style="margin-top:10px">ВАШЕ ИМЯ ДЛЯ ЗНАКОМСТВА (по-английски)</div><input type="text" id="myname" placeholder="Например: Alex" value="${esc(st.myName || "")}">
      ${tog("wake", "Экран не гаснет на кадре", st.wake, "set")}''')
# --- белый экран «Показать хозяину» с листанием
t = rep(t, '''    + (app.owner ? `<div class="owner"><div class="en">${esc(app.owner[0])}</div><div class="ru">${esc(app.owner[1])}</div><button data-a="ownerx">Закрыть</button></div>` : "");''',
           '''    + (app.owner !== null ? (() => { const l = talkLine(TALK_FLAT[app.owner], app.settings.myName); return `<div class="owner"><div class="en">${esc(l.en)}</div><div class="ru">${esc(l.ru)}</div>
      <div class="ownerbar"><button data-a="ownerp" ${app.owner ? "" : "disabled"}>‹</button><button data-a="ownerx">Закрыть</button><button data-a="ownern" ${app.owner < TALK_FLAT.length - 1 ? "" : "disabled"}>›</button></div></div>`; })() : "");''')
t = rep(t, '''  root.querySelectorAll("[data-q]").forEach((el) => (el.onchange = () => { const k = "q" + el.dataset.q; const v2 = el.dataset.f === "asked" ? { asked: el.checked } : { answer: el.value }; doAct({ type: "answer", q: k, v: v2 }); }));''',
           '''  root.querySelectorAll("[data-q]").forEach((el) => (el.onchange = () => { const v2 = el.dataset.f === "asked" ? { asked: el.checked } : { answer: el.value, asked: true }; doAct({ type: "answer", q: el.dataset.q, v: v2 }); }));
  const mn = $("#myname"); if (mn) mn.onchange = () => { app.settings.myName = mn.value.trim(); S.setKV("settings", app.settings); };
  if (app.screen === "talk" && app.talkSec) { const el = document.getElementById("sec-" + app.talkSec); app.talkSec = null; if (el) el.scrollIntoView({ block: "start" }); }''')
t = rep(t, '''  if (app.owner) { app.owner = null; render(); history.pushState({}, ""); return; }''', '''  if (app.owner !== null) { app.owner = null; render(); history.pushState({}, ""); return; }''')
# --- обработчики
t = rep(t, '''    case "phrases": app.sheet = null; go("phrases"); break;
    case "owner": app.owner = PHRASES[+id]; render(); history.pushState({}, ""); break;
    case "ownerx": app.owner = null; render(); break;
    case "qs": go("qs"); break;''', '''    case "phrases": app.sheet = null; app.talkSec = "access"; go("talk"); break;
    case "talk": app.sheet = null; app.talkSec = id || "hello"; go("talk"); break;
    case "talkgo": { const el = document.getElementById("sec-" + id); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); break; }
    case "owner": app.owner = +id; render(); history.pushState({}, ""); break;
    case "ownerp": app.owner = Math.max(0, app.owner - 1); render(); break;
    case "ownern": app.owner = Math.min(TALK_FLAT.length - 1, app.owner + 1); render(); break;
    case "ownerx": app.owner = null; render(); break;
    case "qs": app.talkSec = "car"; go("talk"); break;''')
t = rep(t, '''    case "copy": { const txt = L.summaryText(app.data, s);''', '''    case "copy": { const txt = fullSummary(s);''')
t = rep(t, '''download(`three-laps-${(s.name || "car").replace(/[^\\wа-яё]+/gi, "_")}.txt`, L.summaryText(app.data, s));''', '''download(`three-laps-${(s.name || "car").replace(/[^\\wа-яё]+/gi, "_")}.txt`, fullSummary(s));''')
t = rep(t, "function toggle(g, k) {", '''function fullSummary(s) {   // итог + ответы хозяина (вопрос по-русски)
  const qa = TALK_FLAT.filter((l) => l.q && s.qs[l.id] && (s.qs[l.id].asked || s.qs[l.id].answer));
  return L.summaryText(app.data, { ...s, qs: {} }) + (qa.length ? "\\n\\nРазговор с хозяином:\\n" + qa.map((l) => `• ${l.ru}\\n  ${s.qs[l.id].answer || "(спросил, ответ не записан)"}`).join("\\n") : "");
}
function toggle(g, k) {''')
# --- кнопки входа
t = rep(t, '''<button class="btn" data-a="phrases">Фразы для хозяина</button><button class="btn" data-a="undo">Отменить последнее</button>''',
           '''<button class="btn" data-a="talk" data-id="hello">Разговор с хозяином</button><button class="btn" data-a="undo">Отменить последнее</button>''')
t = rep(t, '''<button class="btn" data-a="qs">Вопросы хозяину</button>''', '''<button class="btn" data-a="qs">Разговор с хозяином (вопросы, ответы)</button>''')
t = rep(t, '''<button class="btn ghost" data-a="phrases">Спросить хозяина (фразы по-английски)</button>''', '''<button class="btn ghost" data-a="phrases">Спросить хозяина: готовые фразы по-английски</button>''')
wr("app.js", t)

c = rd("style.css")
c += '''
/* разговор с хозяином */
.fil.pad{padding:8px 12px;margin:0;background:var(--surf);border-bottom:1px solid var(--line)}
.ph .en{font-size:19px;line-height:1.35}.ph.q{border-left:4px solid var(--blue)}
.chk{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 6px;font-weight:600;flex:none}.chk input{width:26px;height:26px}
.ph textarea{margin-top:8px}
.owner .en{font-size:clamp(28px,8vw,42px)}
.ownerbar{display:flex;gap:10px;margin-top:30px;width:100%;max-width:420px}.ownerbar button{flex:1;margin:0;min-height:60px;font-size:20px}.ownerbar button[disabled]{opacity:.3}
'''
wr("style.css", c)
print("talk patched")
