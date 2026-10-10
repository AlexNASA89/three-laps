import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rd(n): return open(os.path.join(ROOT, n), encoding="utf-8").read()
def wr(n, t): open(os.path.join(ROOT, n), "w", encoding="utf-8", newline="\n").write(t)
def rep(t, a, b):
    assert a in t, a[:90]
    return t.replace(a, b, 1)

t = rd("app.js")
# главный экран: строка версии с кнопкой «Обновить»
t = rep(t, '''<div class="small mut" style="margin:6px 0 12px">${off}</div>''',
           '''<div class="verline"><span class="small mut">${off} · версия ${esc(app.version)}</span><button class="upd" data-a="refresh">${app.checking ? "Проверяю…" : "Обновить"}</button></div>''')
# надёжное обновление: проверить → дождаться установки → переключить → перезагрузить
i = t.index('    case "refresh":'); j = t.index("\n", i)
t = t[:i] + '''    case "refresh": await forceUpdate(); break;''' + t[j:]
t = rep(t, "function toggle(g, k) {", '''async function forceUpdate() {
  if (!("serviceWorker" in navigator)) { location.reload(); return; }
  app.checking = true; render();
  try {
    const r = await navigator.serviceWorker.getRegistration();
    if (!r) { location.reload(); return; }
    await r.update();
    const t0 = Date.now();
    while (r.installing && Date.now() - t0 < 60000) await new Promise((z) => setTimeout(z, 500));   // докачать новую версию (≈10 МБ)
    if (r.waiting) { app.updating = true; r.waiting.postMessage("skipWaiting"); setTimeout(() => location.reload(), 4000); return; }
    showToast(`Уже последняя версия (${app.version})`, "", null, 2500);
  } catch (e) { logErr("update: " + e.message); showToast("Нет связи — обновлю, когда появится интернет", "", null, 3000); }
  app.checking = false; render();
}
function toggle(g, k) {''')
# проверять обновление при каждом открытии приложения
t = rep(t, '''document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && app.screen === "frame") wake(); });''',
           '''document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (app.screen === "frame") wake();
  if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
});''')
wr("app.js", t)
c = rd("style.css")
c += '''.verline{display:flex;align-items:center;gap:8px;margin:6px 0 12px}.upd{margin-left:auto;min-height:40px;padding:0 14px;border-radius:12px;background:var(--btn2);font-weight:800;font-size:14px;flex:none}
'''
wr("style.css", c)
print("update ok")
