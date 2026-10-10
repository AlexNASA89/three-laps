"""Маршрут обхода (ТЗ v4.1, §2) -> three_laps/shots.json. Проверяет порядок и останавливается при ошибке.
python three_laps/tools/build_shots.py

Карточки: cards/{light,dark}/<card>.webp и thumb/<card>.webp (генерирует shot_guide, сюда не пишем)."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# точка: (общий план, ближе «+»)
OUT = [
    ("Подход низко к передку ¾", "Фары — дуга с 1 м"),
    ("Строго спереди", "Эмблема на решётке"),
    ("Дуга вокруг передка", "Шильдик на крыле"),
    ("Краб вдоль борта", "Колесо — стоп и наклон"),
    ("Строгий профиль справа", "Зеркало и ручка двери"),
    ("Дуга вокруг кормы", "Фонари и выхлоп"),
    ("Строго сзади", "Звук мотора у выхлопа (если заведут)"),
    ("Краб вдоль левого борта", "Салон через открытое окно (если открыто)"),
    ("Сверху на передок", "Мотор — облёт сверху (если капот открыт)"),
]
SALON = [
    ("19", "Открыть дверь рукой"), ("17", "Салон из двери водителя"), ("20", "Приборы крупно"), ("21", "Руль и эмблема"),
    ("22", "Рычаг КПП и схема"), ("23", "Сиденья и обивка"), ("24", "Дверная карта"), ("25", "Радио, консоль, педали"),
    ("26", "Рука на руле, ключ"), ("27", "Поднять капот"), ("28", "Фары включаются"),
]

out = []
for n, (base, near) in enumerate(OUT, 1):
    out.append(dict(id=str(n), tag=str(n), point=n, plus=False, card="%02d" % n, map="map_out1", label=base))
    out.append(dict(id="%dp" % n, tag="%d+" % n, point=n, plus=True, card="%02dp" % n, map="map_out2", label=near))
out.append(dict(id="vin", tag="VIN", point=None, plus=False, card="vin", map="map_out2", label="VIN · финал",
                note="Отдельный короткий кадр в самом конце: вплотную к стеклу, под углом, блик ладонью, 3 с неподвижно"))
salon = [dict(id=c, tag=c, point=None, plus=False, card=c, map="map_salon", label=t) for c, t in SALON]

assert [p["card"] for p in out] == [x for n in range(1, 10) for x in ("%02d" % n, "%02dp" % n)] + ["vin"]
assert len(out) == 19 and len(salon) == 11
for r, maps in ((out, ("map_out1", "map_out2")), (salon, ("map_salon",))):
    assert {p["map"] for p in r} == set(maps)
    assert len({p["id"] for p in r}) == len(r) and all(p["label"] for p in r)

data = dict(
    pre=dict(id="pre", tag="Перед съёмкой", card="pre", label="Перед съёмкой",
             note="Протри камеру · заряд и место · 4K и сетка · «Не беспокоить» · солнце за спиной"),
    # карты: «Снаружи» — две (круг 1: точки 1–9; круг 2: 1+…9+ и VIN), «Салон» — одна
    routes=[dict(id="out", title="Снаружи", maps=[dict(card="map_out1", title="Круг 1 · общий план", short="Круг 1"),
                                                  dict(card="map_out2", title="Круг 2 · ближе", short="Круг 2")], points=out),
            dict(id="salon", title="Салон", maps=[dict(card="map_salon", title="Салон", short="Салон")],
                 note="Если окно или дверь открыты", points=salon)],
)
json.dump(data, open(os.path.join(ROOT, "shots.json"), "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
print("OK shots.json: out", len(out), "salon", len(salon))
