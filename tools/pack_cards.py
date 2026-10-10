"""Карточки гайда -> WebP для приложения: three_laps/cards/{light,dark}/NAME.webp + thumb/NAME.webp. Печатает размеры.

v0.5 (10.10, маршрут 9 точек): имена — контракт приложения:
  01…09, 01p…09p, vin, map_out1, map_out2, pre  ← shot_guide/out/v05_contrast(_dark)  (shot_card.py --v05)
  17, 19…28, map_salon (= 18z_karta_krug3)       ← shot_guide/out/final_contrast(_dark) (салон не менялся)
Старые файлы (00a_pered_semkoy, 00z_karta_krug1, 09z_karta_krug2, 10–16, 18, 18z_karta_krug3) удаляются только из three_laps/cards.
"""
import os, sys
sys.stdout.reconfigure(encoding="utf-8")
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SG = os.path.join(ROOT, "..", "shot_guide", "out")
NEW = [f"{k:02d}" for k in range(1, 10)] + [f"{k:02d}p" for k in range(1, 10)] + ["vin", "map_out1", "map_out2", "pre"]
SALON = {"17": "17", **{str(k): str(k) for k in range(19, 29)}, "map_salon": "18z_karta_krug3"}
OLD = ["00a_pered_semkoy", "00z_karta_krug1", "09z_karta_krug2", "18z_karta_krug3", "18"] + [str(k) for k in range(10, 17)]


def pack(src, dst_dir, name):
    im = Image.open(src).convert("RGB")
    p = os.path.join(dst_dir, name + ".webp"); im.save(p, "WEBP", quality=82, method=6)
    t = im.resize((216, int(im.height * 216 / im.width))); tp = os.path.join(dst_dir, "thumb", name + ".webp"); t.save(tp, "WEBP", quality=70)
    return os.path.getsize(p) + os.path.getsize(tp)


tot = 0
for theme, new_dir, old_dir in (("light", "v05_contrast", "final_contrast"), ("dark", "v05_contrast_dark", "final_contrast_dark")):
    dst = os.path.join(ROOT, "cards", theme)
    os.makedirs(os.path.join(dst, "thumb"), exist_ok=True)
    for name in NEW:
        src = os.path.join(SG, new_dir, name + ".jpg")
        if not os.path.exists(src):
            raise SystemExit(f"нет {src} — сначала: python shot_guide/shot_card.py shot_guide/universal.json --v05 --theme=...")
        tot += pack(src, dst, name)
    for name, srcname in SALON.items():   # салон не менялся: уже упакованные не трогаем
        if not (os.path.exists(os.path.join(dst, name + ".webp")) and os.path.exists(os.path.join(dst, "thumb", name + ".webp"))):
            tot += pack(os.path.join(SG, old_dir, srcname + ".jpg"), dst, name)
    for name in OLD:
        for p in (os.path.join(dst, name + ".webp"), os.path.join(dst, "thumb", name + ".webp")):
            if os.path.exists(p):
                os.remove(p)
    left = sorted(os.path.splitext(f)[0] for f in os.listdir(dst) if f.endswith(".webp"))
    extra = set(left) - set(NEW) - set(SALON)
    print(theme, len(left), "файлов", ("; лишние: " + ", ".join(sorted(extra))) if extra else "")
print("упаковано MB", round(tot / 1e6, 1))
