import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rd(n): return open(os.path.join(ROOT, n), encoding="utf-8").read()
def wr(n, t): open(os.path.join(ROOT, n), "w", encoding="utf-8", newline="\n").write(t)

t = rd("app.js")
i = t.index("  talk() {"); j = t.index("  bugs() {")
t = t[:i] + '''  talk() {
    const s = app.cur, nm = app.settings.myName;
    const qs = TALK_FLAT.filter((l) => l.q), grants = TALK_FLAT.filter((l) => l.grant);
    const asked = (l) => !!(s && s.qs[l.id] && (s.qs[l.id].asked || s.qs[l.id].answer));
    const qDone = qs.filter(asked).length, gDone = grants.filter(asked).length;
    const secCount = (sec) => { const a = sec.lines.filter((l) => l.q || l.grant); return a.length ? ` ${a.filter(asked).length}/${a.length}` : ""; };
    const chips = TALK.map((sec) => `<button data-a="talkgo" data-id="${sec.id}">${esc(sec.title)}${secCount(sec)}</button>`).join("");
    const body = TALK.map((sec) => `<div class="ghead" id="sec-${sec.id}">${esc(sec.title)}${secCount(sec) ? `<span class="mut">${secCount(sec)}</span>` : ""}</div>${sec.tip ? `<div class="small mut">${esc(sec.tip)}</div>` : ""}
      ${sec.lines.map((l0) => { const l = talkLine(l0, nm), v = (s && s.qs[l.id]) || {}, k = TALK_FLAT.findIndex((x) => x.id === l.id);
        const num = l.q ? `Вопрос ${qs.indexOf(l0) + 1} из ${qs.length}` : l.grant ? `Разрешение ${grants.indexOf(l0) + 1} из ${grants.length}` : `Фраза ${k + 1} из ${TALK_FLAT.length}`;
        const g = l.grant && s ? grantUI(s, l) : "";
        return `<div class="ph ${l.q ? "q" : ""} ${l.grant ? "grant" : ""} ${asked(l0) ? "asked" : ""}" id="ln-${l.id}"><div class="num">${num}${asked(l0) ? " · ✓" : ""}</div><div class="en">${esc(l.en)}</div><div class="ru">${esc(l.ru)}</div>${g}
          <div class="row" style="margin-top:8px"><button class="btn" style="min-height:48px;margin:0" data-a="owner" data-id="${k}">Показать хозяину</button>
          ${l.q && s ? `<label class="chk"><input type="checkbox" data-q="${l.id}" data-f="asked" ${v.asked ? "checked" : ""}> спросил</label>` : ""}</div>
          ${l.q && s ? `<textarea data-q="${l.id}" data-f="answer" rows="2" placeholder="Ответ (можно голосом с клавиатуры)">${esc(v.answer || "")}</textarea>` : ""}</div>`; }).join("")}`).join("");
    return `<div class="top"><div class="p">Разговор с хозяином<small>${s ? `вопросы ${qDone} из ${qs.length} · разрешения ${gDone} из ${grants.length}` : "читайте с экрана или покажите крупно"}</small></div><button class="chip" data-a="back">Готово</button></div>
      <div class="fil pad">${chips}</div><div class="scr" id="talkscr">${nm ? "" : `<div class="card small">Совет: впишите своё имя в Настройках — оно появится во фразе знакомства.</div>`}${body}
      <button class="btn" data-a="back">Назад</button></div>`;
  },
''' + t[j:]
# карточки заметок об ошибках: класс ph (а не phot — это картинка)
t = t.replace('''app.bugs.slice().reverse().map((b) => `<div class="phot">''', '''app.bugs.slice().reverse().map((b) => `<div class="ph">''')
# белый экран: номер фразы
t = t.replace('''return `<div class="owner"><div class="en">${esc(l.en)}</div>''', '''return `<div class="owner"><div class="onum">${TALK_FLAT[app.owner].q ? `Вопрос ${TALK_FLAT.filter((x) => x.q).indexOf(TALK_FLAT[app.owner]) + 1} из ${TALK_FLAT.filter((x) => x.q).length}` : `Фраза ${app.owner + 1} из ${TALK_FLAT.length}`}</div><div class="en">${esc(l.en)}</div>''')
wr("app.js", t)
c = rd("style.css")
c += '''.ph .num{font-size:13px;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.03em;margin-bottom:4px}
.ph.asked{opacity:.75}.ph.asked .num{color:var(--green)}
.owner .onum{position:absolute;top:calc(16px + env(safe-area-inset-top));left:0;right:0;font-weight:800;color:#777;font-size:16px}
'''
wr("style.css", c)
print("ok")
