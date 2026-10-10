import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rd(n): return open(os.path.join(ROOT, n), encoding="utf-8").read()
def wr(n, t): open(os.path.join(ROOT, n), "w", encoding="utf-8", newline="\n").write(t)
def rep(t, a, b):
    assert a in t, a[:80]
    return t.replace(a, b, 1)

t = rd("app.js")
# 1. экран «следующий круг»
t = rep(t, "  skipped() {", '''  stage() {
    const s = app.cur, c = L.nextStage(app.data, s), d = app.draft, n = L.stageIds(app.data, s, c).length;
    const NAMES = { 1: "Внешний обход", 2: "Детали и надписи", 3: "Салон и жесты" };
    return `<div class="scr"><h2>Дальше: круг ${c}</h2><div class="card"><div class="title">${NAMES[c]}</div><div class="sub">${n} точек · сначала всё, что не требует доступа</div></div>
      <div class="title" style="margin-top:6px">Есть доступ?</div><div class="small mut">Хозяин разрешил открыть дверь, капот или завести мотор? Включите, что разрешено.</div>
      ${PERMS.map(([k, t]) => tog(k, t, d.perms[k], "pdraft")).join("")}
      <div class="small mut" style="margin-top:8px">УЖЕ ОТКРЫТО (САМ ХОЗЯИН)</div>${tog("doorOpen", "Дверь открыта", d.states.doorOpen, "sdraft")}${tog("hoodOpen", "Капот открыт", d.states.hoodOpen, "sdraft")}
      <button class="btn go" data-a="stagego" style="margin-top:12px">Есть доступ: начать круг ${c}</button>
      <button class="btn" data-a="stageno">Нет доступа: без салона и капота</button>
      <button class="btn" data-a="phrases">Спросить хозяина (фразы)</button>
      <button class="btn ghost" data-a="finishall">Завершить съёмку</button><button class="btn ghost" data-a="list">Список</button>
      <div class="small mut">Без доступа запертые кадры не мешают: они останутся в итоге и откроются, когда разрешат.</div></div>`;
  },
  skipped() {''')
# 2. skipped-экран: «Позже» + «Завершить»
t = rep(t, '''      <button class="btn" data-a="finish">Закончить съёмку</button><button class="btn ghost" data-a="list">Список</button></div>`;
  },
  summary() {''', '''      <button class="btn" data-a="skipask">Не сейчас, дальше</button><button class="btn ghost" data-a="finishall">Завершить съёмку</button><button class="btn ghost" data-a="list">Список</button></div>`;
  },
  summary() {''')
# 3. итог: вернуться к съёмке
t = rep(t, '''      ${sk ? `<button class="btn go" data-a="pass">Снять пропущенное (${sk})</button>` : ""}''', '''      ${L.hasMore(app.data, s) ? `<button class="btn pri" data-a="resumeshoot">Вернуться к съёмке</button>` : ""}
      ${sk ? `<button class="btn go" data-a="pass">Снять пропущенное (${sk})</button>` : ""}''')
# 4. «Ещё»: завершить
t = rep(t, '<button class="btn" data-a="bug">Заметил ошибку</button>', '<button class="btn" data-a="bug">Заметил ошибку</button><button class="btn" data-a="finishall">Завершить съёмку</button>')
# 5. список: завершить
t = rep(t, '''<div class="bar"><button class="btn b1" data-a="gotoq">К очереди</button><button class="btn b1" data-a="home">Домой</button></div>`}''', '''<div class="bar"><button class="btn b1" data-a="gotoq">К очереди</button><button class="btn b1" data-a="finishall">Завершить</button><button class="btn b3" data-a="home">Домой</button></div>`}''')
# 6. экран разрешений: список; «Нет» идёт дальше по цепочке
t = rep(t, '''<button class="btn ghost" data-a="no">Нет, закончить</button>''', '''<button class="btn ghost" data-a="no">Нет доступа</button><button class="btn ghost" data-a="list">Список</button><button class="btn ghost" data-a="finishall">Завершить съёмку</button>''')
t = rep(t, '''    case "no": await doAct({ type: "saidNo" }, { toast: false }); go("summary"); break;''', '''    case "no": await doAct({ type: "saidNo" }, { toast: false }); app.screen = L.endState(app.data, app.cur) || (app.cur.cursor ? "frame" : "summary"); render(); break;
    case "stagego": { const c = L.nextStage(app.data, app.cur); const pm = app.draft.perms, st = app.draft.states; const any = Object.values(pm).some(Boolean) || Object.values(st).some(Boolean);
      await doAct({ type: "addStage", circle: c, perms: pm, states: st, noAccess: !any }, { toast: false }); toNext(); break; }
    case "stageno": { const c = L.nextStage(app.data, app.cur); await doAct({ type: "addStage", circle: c, noAccess: true }, { toast: false }); toNext(); break; }
    case "skipask": await doAct({ type: "skipAsked" }, { toast: false }); toNext(); break;
    case "finishall": app.sheet = null; app.temp = null; await doAct({ type: "finishAll" }, { toast: false }); app.screen = "summary"; render(); break;
    case "resumeshoot": { const s2 = app.cur; app.cur = { ...s2, skipAsked: false, saidNo: false, declined: {} }; await commit(app.cur); toNext(); break; }''')
# 7. вспомогательная toNext и draft для stage
t = rep(t, "function toggle(g, k) {", '''function toNext() {   // после действия идти туда, где очередь или следующий вопрос
  const s = app.cur;
  app.screen = s.cursor ? "frame" : (L.endState(app.data, s) || "summary");
  if (app.screen === "frame" && needMap()) app.screen = "map";
  render();
}
function toggle(g, k) {''')
t = rep(t, 'if (app.screen === "perms" && app.cur && app.lastScr !== "perms")', 'if (["perms", "stage"].includes(app.screen) && app.cur && app.lastScr !== app.screen)')
# 8. старый finish больше не нужен — оставляем совместимость
t = rep(t, '''    case "finish": app.screen =''', '''    case "finish-old": app.screen =''')
wr("app.js", t)
print("ui patched")
