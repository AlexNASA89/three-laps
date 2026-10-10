import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rd(n): return open(os.path.join(ROOT, n), encoding="utf-8").read()
def wr(n, t): open(os.path.join(ROOT, n), "w", encoding="utf-8", newline="\n").write(t)
def rep(t, a, b):
    assert a in t, a[:90]
    return t.replace(a, b, 1)

t = rd("app.js")
t = rep(t, 'import { TALK, TALK_FLAT, talkLine, ONBOARD, carIcon, nextIcon } from "./content.js";',
           'import { TALK, TALK_FLAT, FIELDS, talkLine, ONBOARD, carIcon, nextIcon } from "./content.js";')
# карточка вопроса: сводка ответа + «Записать ответ» (поля из FIELDS)
t = rep(t, '''          ${l.form === "contact" && s ? `${v.answer ? `<div class="card small" style="margin:8px 0 0;white-space:pre-line">${esc(v.answer)}</div>` : ""}<button class="btn go" style="margin:8px 0 0" data-a="contact" data-id="${l.id}">${v.answer ? "Изменить контакт" : "Записать контакт"}</button>`
            : l.q && s ? `<textarea data-q="${l.id}" data-f="answer" rows="2" placeholder="Ответ (можно голосом с клавиатуры)">${esc(v.answer || "")}</textarea>` : ""}</div>`; }).join("")}`).join("");''',
           '''          ${FIELDS[l.id] && s ? `${v.answer ? `<div class="ans">${esc(v.answer)}</div>` : ""}<button class="btn ${v.answer ? "" : "go"}" style="margin:8px 0 0" data-a="ansform" data-id="${l.id}">${v.answer ? "Изменить ответ" : l.id === "v3" ? "Записать контакт" : "Записать ответ"}</button>`
            : l.q && s ? `<textarea data-q="${l.id}" data-f="answer" rows="2" placeholder="Ответ (можно голосом с клавиатуры)">${esc(v.answer || "")}</textarea>` : ""}</div>`; }).join("")}`).join("");''')
# лист «Ответ»: поля с подсказками что вписать; выбор — кнопками
i = t.index('  if (app.sheet && app.sheet.t === "contact") {'); j = t.index('  if (app.sheet === "bug") return sheet(')
t = t[:i] + '''  if (app.sheet && app.sheet.t === "ans") { const id = app.sheet.id, l = TALK_FLAT.find((x) => x.id === id), fs = FIELDS[id], v = app.sheet.draft;
    const lab = (f) => f.en ? `${f.en} · <i>${f.ru}</i>` : esc(f.ru);
    const field = (f) => f.type === "choice"
      ? `<div class="fl"><span>${lab(f)}</span><div class="opts">${f.opts.map((o) => `<button class="${v[f.k] === o ? "on" : ""}" data-a="ansopt" data-id="${f.k}" data-v="${esc(o)}">${esc(o)}</button>`).join("")}</div></div>`
      : f.type === "area" ? `<label class="fl"><span>${lab(f)}</span><textarea data-fk="${f.k}" rows="2" placeholder="${esc(f.ph || "")}">${esc(v[f.k] || "")}</textarea></label>`
      : `<label class="fl"><span>${lab(f)}</span><input data-fk="${f.k}" type="${f.type === "tel" ? "tel" : f.type === "email" ? "email" : "text"}" ${["num", "money"].includes(f.type) ? 'inputmode="numeric"' : ""} value="${esc(v[f.k] || "")}" placeholder="${esc(f.ph || "")}" autocomplete="off"></label>`;
    return sheet(`<div class="num">${id === "v3" ? "Contact · Контакт" : "Ответ"}</div><h2 style="font-size:19px">${esc(l.ru)}</h2>
      ${id === "v3" ? `<div class="small mut">Можно дать телефон хозяину — подписи по-английски. Хранится только в этом телефоне.</div>` : ""}
      ${fs.map(field).join("")}<label class="fl"><span>Ещё заметка</span><textarea data-fk="_note" rows="2">${esc(v._note || "")}</textarea></label>
      <button class="btn go" data-a="anssave" data-id="${id}">Сохранить</button><button class="btn ghost" data-a="closesheet">Отмена</button>`); }
''' + t[j:]
# обработчики: заменить contact/contactsave на общий
i = t.index('    case "contact":'); j = t.index('    case "deny":')
t = t[:i] + '''    case "contact": case "ansform": { const q = (s && s.qs[id]) || {}; app.sheet = { t: "ans", id, draft: { ...(q.fields || q.contact || {}) } }; render(); break; }
    case "ansopt": { syncAns(); const d = app.sheet.draft; d[id] = d[id] === t.dataset.v ? "" : t.dataset.v; render(); break; }
    case "anssave": { syncAns(); const fs = FIELDS[id], d = app.sheet.draft;
      const money = (x) => (x && /^\\d[\\d\\s.,]*$/.test(x) ? "$" + x.replace(/[^\\d]/g, "").replace(/\\B(?=(\\d{3})+(?!\\d))/g, " ") : x);
      const lines = [...fs.map((f) => [f.ru.replace(/,? ?\\$$/, ""), f.type === "money" ? money(d[f.k]) : d[f.k]]), ["Заметка", d._note]].filter(([, x]) => x).map(([a2, x]) => `${a2}: ${x}`);
      app.sheet = null; await doAct({ type: "answer", q: id, v: { asked: true, fields: d, answer: lines.join("\\n") } });
      showToast(lines.length ? "Ответ сохранён" : "Пусто — ничего не записано", "", null, 2000); break; }
''' + t[j:]
t = rep(t, "function toggle(g, k) {", '''function syncAns() {   // перенести введённое в черновик перед перерисовкой листа
  if (!app.sheet || app.sheet.t !== "ans") return;
  root.querySelectorAll("[data-fk]").forEach((el) => { app.sheet.draft[el.dataset.fk] = el.value.trim(); });
}
function toggle(g, k) {''')
wr("app.js", t)
c = rd("style.css")
c += '''.ans{white-space:pre-line;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-top:8px;font-size:15px}
.opts{display:flex;flex-wrap:wrap;gap:8px}.opts button{min-height:48px;padding:0 16px;border-radius:24px;background:var(--btn2);font-weight:700;font-size:16px}.opts button.on{background:var(--blue);color:#fff}
.sheet .num{font-size:13px;font-weight:800;color:var(--mut);text-transform:uppercase}
'''
wr("style.css", c)
print("fields ok")
