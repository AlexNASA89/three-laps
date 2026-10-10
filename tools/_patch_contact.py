import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rd(n): return open(os.path.join(ROOT, n), encoding="utf-8").read()
def wr(n, t): open(os.path.join(ROOT, n), "w", encoding="utf-8", newline="\n").write(t)
def rep(t, a, b):
    assert a in t, a[:90]
    return t.replace(a, b, 1)

c = rd("content.js")
c = rep(c, '{ id: "v3", q: true,', '{ id: "v3", q: true, form: "contact",')
wr("content.js", c)

t = rd("app.js")
t = rep(t, '''          ${l.q && s ? `<textarea data-q="${l.id}" data-f="answer" rows="2" placeholder="Ответ (можно голосом с клавиатуры)">${esc(v.answer || "")}</textarea>` : ""}</div>`; }).join("")}`).join("");''',
           '''          ${l.form === "contact" && s ? `${v.answer ? `<div class="card small" style="margin:8px 0 0;white-space:pre-line">${esc(v.answer)}</div>` : ""}<button class="btn go" style="margin:8px 0 0" data-a="contact" data-id="${l.id}">${v.answer ? "Изменить контакт" : "Записать контакт"}</button>`
            : l.q && s ? `<textarea data-q="${l.id}" data-f="answer" rows="2" placeholder="Ответ (можно голосом с клавиатуры)">${esc(v.answer || "")}</textarea>` : ""}</div>`; }).join("")}`).join("");''')
# лист контакта: подписи на двух языках — телефон можно дать хозяину, чтобы вписал сам
t = rep(t, '''  if (app.sheet === "bug") return sheet(''', '''  if (app.sheet && app.sheet.t === "contact") { const v = ((s && s.qs[app.sheet.id]) || {}).contact || {};
    const f = (k, en, ru, type, ph) => `<label class="fl"><span>${en} · <i>${ru}</i></span><input type="${type}" id="c_${k}" value="${esc(v[k] || "")}" placeholder="${ph}" autocomplete="off"></label>`;
    return sheet(`<h2>Contact · Контакт</h2><div class="small mut">Можно дать телефон хозяину — подписи по-английски. Хранится только в этом телефоне.</div>
      ${f("name", "Name", "имя", "text", "John")}${f("phone", "Phone", "телефон", "tel", "+1 …")}${f("email", "Email", "почта", "email", "name@mail.com")}
      ${f("social", "Instagram / Facebook", "соцсеть", "text", "@…")}${f("credit", "How to credit you in the video", "как подписать в видео", "text", "name, shop or club")}
      <label class="fl"><span>Note · <i>заметка</i></span><textarea id="c_note" rows="2">${esc(v.note || "")}</textarea></label>
      <button class="btn go" data-a="contactsave" data-id="${app.sheet.id}">Сохранить · Save</button><button class="btn ghost" data-a="closesheet">Отмена</button>`); }
  if (app.sheet === "bug") return sheet(''')
t = rep(t, '''    case "deny":''', '''    case "contact": app.sheet = { t: "contact", id }; render(); setTimeout(() => { const x = $("#c_name"); if (x) x.focus(); }, 80); break;
    case "contactsave": { const g = (k) => (($("#c_" + k) || {}).value || "").trim();
      const ct = { name: g("name"), phone: g("phone"), email: g("email"), social: g("social"), credit: g("credit"), note: g("note") };
      const L2 = [["Имя", ct.name], ["Телефон", ct.phone], ["Почта", ct.email], ["Соцсеть", ct.social], ["Подписать в видео", ct.credit], ["Заметка", ct.note]].filter(([, x]) => x).map(([a2, x]) => `${a2}: ${x}`);
      app.sheet = null; await doAct({ type: "answer", q: id, v: { asked: true, contact: ct, answer: L2.join("\\n") } }); showToast(L2.length ? "Контакт сохранён" : "Пусто — ничего не сохранено", "", null, 2500); break; }
    case "deny":''')
wr("app.js", t)
c = rd("style.css")
c += '''.fl{display:block;margin:10px 0}.fl span{display:block;font-weight:700;font-size:15px;margin-bottom:4px}.fl i{font-style:normal;color:var(--mut);font-weight:600}
.fl input,.fl textarea{width:100%}
input[type=tel],input[type=email]{width:100%;font:inherit;font-size:17px;padding:12px;border-radius:12px;border:2px solid var(--line);background:var(--surf);color:var(--ink);min-height:52px}
'''
wr("style.css", c)
print("contact ok")
