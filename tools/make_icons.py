"""Three Laps icon variants (drawn at 2048 px, downscaled for clean edges)."""
import math, os
from PIL import Image, ImageDraw, ImageFont

S = 2048
OUT = os.path.dirname(os.path.abspath(__file__))
BG = (15, 16, 19)
YEL = (247, 190, 32)
WHITE = (245, 245, 240)
GREEN = (58, 214, 116)


def car_top(d, cx, cy, w, h, fill, glass):
    """Top-down car: body with rounded ends, windshield, rear window, wheels."""
    r = w * 0.42
    d.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=r, fill=fill)
    # wheels
    ww, wh = w * 0.16, h * 0.17
    for sx in (-1, 1):
        for sy in (-0.30, 0.30):
            x = cx + sx * (w / 2 + ww * 0.15)
            y = cy + sy * h
            d.rounded_rectangle([x - ww / 2, y - wh / 2, x + ww / 2, y + wh / 2], radius=ww * 0.35, fill=(40, 40, 46))
    d.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=r, fill=fill)
    # windshield + roof + rear glass
    d.rounded_rectangle([cx - w * 0.36, cy - h * 0.20, cx + w * 0.36, cy - h * 0.05], radius=w * 0.08, fill=glass)
    d.rounded_rectangle([cx - w * 0.33, cy + h * 0.16, cx + w * 0.33, cy + h * 0.27], radius=w * 0.08, fill=glass)


def arc_arrow(d, cx, cy, rad, start, end, color, width, head=True):
    box = [cx - rad, cy - rad, cx + rad, cy + rad]
    d.arc(box, start, end, fill=color, width=width)
    if head:
        a = math.radians(end)
        x, y = cx + rad * math.cos(a), cy + rad * math.sin(a)
        t = a + math.pi / 2  # tangent direction (clockwise drawing)
        L = width * 2.2
        p1 = (x + L * math.cos(t), y + L * math.sin(t))
        p2 = (x + L * 0.75 * math.cos(t + 2.3), y + L * 0.75 * math.sin(t + 2.3))
        p3 = (x + L * 0.75 * math.cos(t - 2.3), y + L * 0.75 * math.sin(t - 2.3))
        d.polygon([p1, p2, p3], fill=color)


def save(img, name):
    img.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, name + '_512.png'))
    img.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, name + '_192.png'))
    return img


def variant_a():
    """Car from above, three lap arrows of growing radius around it (the method: three circles)."""
    img = Image.new('RGB', (S, S), BG); d = ImageDraw.Draw(img)
    c = S / 2
    # rings inside the maskable safe zone (radius 0.4 * size = 819 px) so Android's round mask never cuts them
    for rad, col, st in ((470, GREEN, 200), (610, WHITE, 150), (750, YEL, 110)):
        arc_arrow(d, c, c, rad, st, st + 300, col, 64)
    car_top(d, c, c, 290, 580, (225, 60, 60), (30, 34, 44))
    return save(img, 'A_laps_car')


def variant_b():
    """Big «3» whose stroke is a path, a camera dot travelling along it."""
    img = Image.new('RGB', (S, S), BG); d = ImageDraw.Draw(img)
    f = ImageFont.truetype('C:/Windows/Fonts/georgiab.ttf', 1500)
    tw = d.textlength('3', font=f)
    d.text(((S - tw) / 2, 150), '3', font=f, fill=YEL)
    car_top(d, S * 0.5, S * 0.52, 200, 400, (225, 60, 60), (30, 34, 44))
    return save(img, 'B_three')


def variant_c():
    """Car in profile (side view) with an orbit loop and a camera viewfinder — «обход и съёмка»."""
    img = Image.new('RGB', (S, S), (22, 24, 30)); d = ImageDraw.Draw(img)
    c = S / 2
    # viewfinder corners
    m, L, W = 260, 300, 60
    for (x, y, dx, dy) in ((m, m, 1, 1), (S - m, m, -1, 1), (m, S - m, 1, -1), (S - m, S - m, -1, -1)):
        d.line([(x, y), (x + dx * L, y)], fill=WHITE, width=W)
        d.line([(x, y), (x, y + dy * L)], fill=WHITE, width=W)
    # orbit ellipse with arrow
    box = [c - 640, c - 300, c + 640, c + 300]
    d.arc(box, 200, 520, fill=YEL, width=64)
    # car side silhouette
    body = [(c - 560, c + 120), (c - 540, c + 10), (c - 380, c - 30), (c - 220, c - 190), (c + 160, c - 190),
            (c + 330, c - 40), (c + 540, c - 10), (c + 570, c + 120)]
    d.polygon(body, fill=(225, 60, 60))
    d.polygon([(c - 190, c - 160), (c - 20, c - 160), (c - 20, c - 40), (c - 330, c - 40)], fill=(30, 34, 44))
    d.polygon([(c + 20, c - 160), (c + 140, c - 160), (c + 280, c - 40), (c + 20, c - 40)], fill=(30, 34, 44))
    for wx in (c - 330, c + 330):
        d.ellipse([wx - 120, c + 20, wx + 120, c + 260], fill=(20, 20, 24))
        d.ellipse([wx - 55, c + 85, wx + 55, c + 195], fill=(150, 150, 160))
    # front of orbit over the car
    d.arc(box, 20, 160, fill=YEL, width=64)
    a = math.radians(160); x, y = c + 640 * math.cos(a), c + 300 * math.sin(a)
    d.polygon([(x - 40, y - 70), (x - 40, y + 70), (x - 160, y)], fill=YEL)
    return save(img, 'C_orbit_side')


if __name__ == '__main__':
    imgs = [variant_a(), variant_b(), variant_c()]
    sheet = Image.new('RGB', (3 * 520 + 20, 560), (60, 60, 60))
    for i, im in enumerate(imgs):
        sheet.paste(im.resize((512, 512), Image.LANCZOS), (10 + i * 520, 10))
    d = ImageDraw.Draw(sheet); f = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 34)
    for i, t in enumerate('ABC'):
        d.text((20 + i * 520, 520), t, font=f, fill=WHITE)
    sheet.save(os.path.join(OUT, 'variants.jpg'), quality=92)
    print('ok')
