"""Список файлов для офлайна: three_laps/precache.json (версия = хеш содержимого) + PWA-иконки.
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
files = []
for base, _, names in os.walk(ROOT):
    for n in names:
        p = os.path.join(base, n); rel = os.path.relpath(p, ROOT).replace("\\", "/")
        if rel.startswith("tools/") or rel.startswith("_") or rel in ("precache.json", "package.json", "logic.test.mjs", "sw.js") or rel.endswith((".py", ".md")): continue
        files.append(rel)
files.sort(); h = hashlib.sha1()
for f in files: h.update(f.encode()); h.update(open(os.path.join(ROOT, f), "rb").read())
json.dump(dict(version=h.hexdigest()[:10], files=files + ["./"]), open(os.path.join(ROOT, "precache.json"), "w"), indent=0)
sw = os.path.join(ROOT, "sw.js"); lines = open(sw, encoding="utf-8").read().split("\n")
lines = [l for l in lines if not l.startswith("// build:")]; lines.insert(0, "// build: " + h.hexdigest()[:10])
open(sw, "w", encoding="utf-8", newline="\n").write("\n".join(lines))
print("precache", len(files), "files", h.hexdigest()[:10])
