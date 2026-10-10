import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rd(n): return open(os.path.join(ROOT, n), encoding="utf-8").read()
def wr(n, t): open(os.path.join(ROOT, n), "w", encoding="utf-8", newline="\n").write(t)
def rep(t, a, b):
    assert a in t, a[:90]
    return t.replace(a, b, 1)

c = rd("content.js")
c = rep(c, '{ id: "a1", en:', '{ id: "a1", grant: "door", en:')
c = rep(c, '{ id: "a2", en:', '{ id: "a2", grant: "hood", en:')
c = rep(c, '{ id: "a3", en:', '{ id: "a3", grant: "engine", en:')
c = rep(c, '{ id: "a4", en:', '{ id: "a4", grant: "touch", en:')
c = rep(c, 'tip: "Просите по одному. «Нет» — нормально: поблагодарите и снимайте дальше снаружи."',
           'tip: "Просите по одному. Разрешили — жмите «Да, разрешил»: сразу покажу, что снять, потом вернёмся к следующему вопросу. «Нет» — нормально: поблагодарите и дальше."')
wr("content.js", c)

t = rd("app.js")
# карта круга не прерывает быструю съёмку по разрешению
t = rep(t, '''  const s = app.cur, sh = s && shotOf(s.cursor);
  if (!sh || s.mapsSeen[sh.circle] || s.modeId === "quick") return false;''', '''  const s = app.cur, sh = s && shotOf(s.cursor);
  if (!sh || app.temp || s.mapsSeen[sh.circle] || s.modeId === "quick") return false;''')
# конец временной очереди: вернуться к разговору
t = rep(t, '''    const back = app.temp.back; app.temp = null;
    if (back''', '''    const t0 = app.temp, back = t0.back; app.temp = null;
    if (t0.ret) { app.screen = "talk"; app.talkSec = t0.ret; render(); showToast(`Готово: ${t0.label} снято`, "", null, 2500); return; }
    if (back''')
# баннер на кадре
t = rep(t, '''      : app.temp ? `<div class="lockbar blue">Подряд: ${app.temp.seen.length + 1} из ${app.temp.ids.length}<button data-a="tempx">Выйти</button></div>` : "";''',
           '''      : app.temp && app.temp.ret ? `<div class="lockbar blue">Разрешили: ${esc(app.temp.label)} · ${Math.min(app.temp.seen.length + 1, app.temp.ids.length)} из ${app.temp.ids.length}<button data-a="tempdone">Готово — к вопросам</button></div>`
      : app.temp ? `<div class="lockbar blue">Подряд: ${app.temp.seen.length + 1} из ${app.temp.ids.length}<button data-a="tempx">Выйти</button></div>` : "";''')
# строки разговора: якорь + кнопки разрешения
t = rep(t, '''        return `<div class="ph ${l.q ? "q" : ""}"><div class="en">${esc(l.en)}</div><div class="ru">${esc(l.ru)}</div>''',
           '''        const g = l.grant && s ? grantUI(s, l) : "";
        return `<div class="ph ${l.q ? "q" : ""} ${l.grant ? "grant" : ""}" id="ln-${l.id}"><div class="en">${esc(l.en)}</div><div class="ru">${esc(l.ru)}</div>${g}''')
t = rep(t, '''  if (app.screen === "talk" && app.talkSec) { const el = document.getElementById("sec-" + app.talkSec);''',
           '''  if (app.screen === "talk" && app.talkSec) { const el = document.getElementById(app.talkSec.startsWith("ln-") ? app.talkSec : "sec-" + app.talkSec);''')
t = rep(t, "// ---------- экраны ----------", '''// ---------- разрешения из разговора: «Да, разрешил» → сразу карточки съёмки → назад к следующему вопросу ----------
const OPENS = { door: "doorOpen", hood: "hoodOpen" };
const GRANT = { door: "дверь", hood: "капот", engine: "мотор", touch: "можно трогать" };
function grantShots(s, key) {   // точки, ради которых просили: жест-«открывашка», потом всё, что ждёт этого доступа
  return app.data.order.filter((i) => { const sh = shotOf(i);
    const rel = sh.perm.includes(key) || (OPENS[key] && (sh.state.includes(OPENS[key]) || sh.opens === OPENS[key]));
    return rel && !["done", "na", "auto"].includes(L.effective(s, sh)); });
}
function grantUI(s, l) {
  const k = l.grant, on = s.perms[k] || (OPENS[k] && s.states[OPENS[k]]), left = on ? grantShots(s, k).filter((i) => L.effective(s, shotOf(i)) !== "locked").length : 0;
  const ans = s.qs[l.id] && s.qs[l.id].answer;
  if (on) return `<div class="row" style="margin-top:8px"><span class="pill okp">Разрешено ✓</span>${left ? `<button class="btn go mini" data-a="grantgo" data-id="${l.id}">Снять сейчас (${left})</button>` : `<span class="small mut">всё снято</span>`}</div>`;
  return `<div class="row" style="margin-top:8px"><button class="btn go mini" data-a="grant" data-id="${l.id}">Да, разрешил</button>
    ${OPENS[k] ? `<button class="btn mini" data-a="grantself" data-id="${l.id}">Открыл сам</button>` : ""}<button class="btn mini ${ans === "нет" ? "dark" : ""}" data-a="deny" data-id="${l.id}">Нет</button></div>`;
}
const nextLineAnchor = (id) => { const i = TALK_FLAT.findIndex((x) => x.id === id); const n = TALK_FLAT[i + 1]; return n ? "ln-" + n.id : null; };
async function startGrant(lineId, self) {
  const l = TALK_FLAT.find((x) => x.id === lineId), k = l.grant;
  if (self && OPENS[k]) await doAct({ type: "setState", key: OPENS[k], value: true }); else if (!app.cur.perms[k]) await doAct({ type: "setPerm", key: k, value: true });
  await doAct({ type: "answer", q: lineId, v: { asked: true, answer: self ? "открыл сам" : "да" } });
  const ids = grantShots(app.cur, k);
  for (const i of ids) if (!L.modeIds(app.data, app.cur).includes(i)) await doAct({ type: "addExtra", id: i });
  const ready = ids.filter((i) => ["todo", "skipped"].includes(L.effective(app.cur, shotOf(i))));
  if (!ready.length) { showToast("Отмечено. Снимать по этому разрешению нечего", "", null, 2500); app.talkSec = nextLineAnchor(lineId); render(); return; }
  app.temp = { ids, seen: [], back: null, from: null, ret: nextLineAnchor(lineId) || "ln-" + lineId, label: GRANT[k] };
  app.stack.push("talk"); jump(ready[0]);
}

// ---------- экраны ----------''')
# обработчики
t = rep(t, '''    case "tempx": app.temp = null; render(); break;''', '''    case "tempx": app.temp = null; render(); break;
    case "tempdone": { const t0 = app.temp; app.temp = null; if (t0 && t0.ret) { app.screen = "talk"; app.talkSec = t0.ret; } render(); break; }
    case "grant": await startGrant(id, false); break;
    case "grantself": await startGrant(id, true); break;
    case "grantgo": await startGrant(id, false); break;
    case "deny": await doAct({ type: "answer", q: id, v: { asked: true, answer: "нет" } }); app.talkSec = nextLineAnchor(id); render(); break;''')
wr("app.js", t)

c = rd("style.css")
c += '''.ph.grant{border-left:4px solid var(--green)}.pill.okp{background:var(--green);color:#fff;font-size:15px;padding:8px 12px}
.ph .row .btn.mini{flex:1;min-height:52px}
'''
wr("style.css", c)
print("grant patched")
