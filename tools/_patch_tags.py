import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rd(n): return open(os.path.join(ROOT, n), encoding="utf-8").read()
def wr(n, t): open(os.path.join(ROOT, n), "w", encoding="utf-8", newline="\n").write(t)
def rep(t, a, b):
    assert a in t, a[:90]
    return t.replace(a, b, 1)

TAGS = {"h1": "Привет", "h2": "Кто я", "h3": "Можно снять?", "a1": "Дверь", "a2": "Капот", "a3": "Звук мотора", "a4": "Потрогать", "a5": "Если нет",
        "c1": "Год и модель", "c2": "Мотор", "c3": "Владение", "c4": "Реставрация", "c5": "Пробег", "c6": "Особенности", "c7": "Любимое", "c8": "Цена",
        "v1": "Публикация", "v2": "Подпись", "v3": "Контакт", "b1": "Спасибо", "b2": "Пока", "x1": "Повторить", "x2": "Написать", "x3": "Английский"}
c = rd("content.js")
for k, v in TAGS.items():
    c = rep(c, '{ id: "%s",' % k, '{ id: "%s", tag: "%s",' % (k, v))
wr("content.js", c)

t = rd("app.js")
# метка-тема рядом с номером: «ВОПРОС 8 ИЗ 11 · ЦЕНА»
t = rep(t, '''<div class="num">${num}${asked(l0) ? " · ✓" : ""}</div>''', '''<div class="num"><b class="tag">${esc(l.tag || "")}</b> ${num}${asked(l0) ? " · ✓" : ""}</div>''')
t = rep(t, '''return sheet(`<div class="num">Вопрос ${qi} из ${qn.length} · ${id === "v3" ? "Contact · Контакт" : "ответ"}</div>''',
           '''return sheet(`<div class="num"><b class="tag">${esc(l.tag)}</b> Вопрос ${qi} из ${qn.length}${id === "v3" ? " · Contact" : ""}</div>''')
t = rep(t, '''<div class="onum">${TALK_FLAT[app.owner].q''', '''<div class="onum">${esc(TALK_FLAT[app.owner].tag)} · ${TALK_FLAT[app.owner].q''')
# итог: тема вопроса вместо длинной фразы
t = rep(t, '''qa.map((l) => `• ${l.ru}\\n  ${s.qs[l.id].answer || "(спросил, ответ не записан)"}`)''',
           '''qa.map((l) => `• ${l.tag}: ${(s.qs[l.id].answer || "(спросил, ответ не записан)").replace(/\\n/g, "; ")}`)''')
wr("app.js", t)
c = rd("style.css")
c += '''.num .tag{display:inline-block;background:var(--ink);color:var(--bg);border-radius:8px;padding:2px 8px;margin-right:6px;font-size:13px;letter-spacing:0}
.ph.grant .num .tag{background:var(--green);color:#fff}.ph.q .num .tag{background:var(--blue);color:#fff}
'''
wr("style.css", c)
print("tags ok")
