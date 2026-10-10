"""Список файлов для офлайна: three_laps/precache.json (версия = хеш содержимого) + PWA-иконки + строка версии в sw.js.
Кэшируем только оболочку приложения и карточки, на которые ссылается shots.json (light/dark, полные и thumb).
Отсутствующие карточки пропускаем (их докладывает другой генератор) — после их появления запустить ещё раз.
python three_laps/tools/build_sw.py"""
import hashlib, json, os
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(ROOT, "icons"), exist_ok=True)
for sz in (192, 512):
    im = Image.new("RGB", (sz, sz), (15, 16, 19)); d = ImageDraw.Draw(im)
    for k, r in enumerate((0.40, 0.29, 0.18)):
        rr = sz * r; w = max(4, int(sz * 0.045))
        d.ellipse([sz / 2 - rr, sz / 2 - rr, sz / 2 + rr, sz / 2 + rr], outline=(245, 190, 30) if k == 0 else (255, 255, 255) if k == 1 else (62, 214, 116), width=w)
    im.save(os.path.join(ROOT, "icons", f"icon-{sz}.png"))

SHELL = ["index.html", "app.js", "logic.js", "content.js", "store.js", "style.css", "shots.json", "manifest.webmanifest",
         "icons/icon-192.png", "icons/icon-512.png"]
data = json.load(open(os.path.join(ROOT, "shots.json"), encoding="utf-8"))
names = [data["pre"]["card"]]
for r in data["routes"]:
    names += [m["card"] for m in r["maps"]] + [p["card"] for p in r["points"]]
names = list(dict.fromkeys(names))
cards, missing = [], []
for theme in ("light", "dark"):
    for sub in ("", "thumb/"):
        for n in names:
            rel = f"cards/{theme}/{sub}{n}.webp"
            (cards if os.path.isfile(os.path.join(ROOT, rel)) else missing).append(rel)
for f in SHELL:
    assert os.path.isfile(os.path.join(ROOT, f)), f
files = SHELL + sorted(cards); h = hashlib.sha1()
for f in files: h.update(f.encode()); h.update(open(os.path.join(ROOT, f), "rb").read())
h.update(open(os.path.join(ROOT, "sw.js"), "rb").read().split(b"\n", 1)[-1])   # правка sw.js тоже меняет версию
ver = h.hexdigest()[:10]
json.dump(dict(version=ver, files=files + ["./"]), open(os.path.join(ROOT, "precache.json"), "w"), indent=0)
sw = os.path.join(ROOT, "sw.js"); lines = open(sw, encoding="utf-8").read().split("\n")
lines = [l for l in lines if not l.startswith("// build:")]; lines.insert(0, "// build: " + ver)
open(sw, "w", encoding="utf-8", newline="\n").write("\n".join(lines))
print("precache", len(files), "files (cards", len(cards), "), missing cards", len(missing), "version", ver)
if missing:
    print("missing:", " ".join(sorted({m.split("/")[-1][:-5] for m in missing})))
