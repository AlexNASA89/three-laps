"""Карточки гайда -> WebP для приложения: three_laps/cards/{light,dark}/NAME.webp + thumb/NAME.webp. Печатает размеры."""
import os, glob
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SG = os.path.join(ROOT, "..", "shot_guide", "out")
tot = 0
for theme, folder in (("light", "final_contrast"), ("dark", "final_contrast_dark")):
    os.makedirs(os.path.join(ROOT, "cards", theme, "thumb"), exist_ok=True)
    for f in sorted(glob.glob(os.path.join(SG, folder, "*.jpg"))):
        name = os.path.splitext(os.path.basename(f))[0]; im = Image.open(f).convert("RGB")
        p = os.path.join(ROOT, "cards", theme, name + ".webp"); im.save(p, "WEBP", quality=82, method=6); tot += os.path.getsize(p)
        t = im.resize((216, int(im.height * 216 / im.width))); tp = os.path.join(ROOT, "cards", theme, "thumb", name + ".webp"); t.save(tp, "WEBP", quality=70); tot += os.path.getsize(tp)
print("cards MB", round(tot / 1e6, 1))
