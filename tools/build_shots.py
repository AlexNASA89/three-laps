"""universal.json + таблица доступа (ТЗ v3 §4) -> three_laps/shots.json. Проверяет числа и останавливается при ошибке.
python three_laps/tools/build_shots.py"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "..", "shot_guide", "universal.json")
u = json.load(open(SRC, encoding="utf-8")); cards = u["shots"] if isinstance(u, dict) else u
assert len(cards) == 28, len(cards)
ORDER = ["1","2","3","4","5","6","7","8","9","10","11","13","14","15","18a","19","17","18b","20","21","22","23","24","25","26","27","12","16","28"]
# id -> (perm, state, opens)
REQ = {"19": (["touch","door"], ["doorClosed"], "doorOpen"), "27": (["touch","hood"], ["hoodClosed"], "hoodOpen"),
       "16": (["engine"], [], None), "12": ([], ["hoodOpen"], None), "26": (["touch"], ["doorOpen"], None), "28": (["touch"], ["doorOpen"], None),
       "17": ([], ["doorOpen"], None), "18b": ([], ["doorOpen"], None)}
for n in range(20, 26): REQ[str(n)] = ([], ["doorOpen"], None)
QUICK = ["1", "3", "6", "14", "19", "27"]
out = []
for sid in ORDER:
    n = int("".join(ch for ch in sid if ch.isdigit())); c = cards[n - 1]
    perm, state, opens = REQ.get(sid, ([], [], None))
    rhythm = sum(x[1] for x in c.get("timeline", []) if isinstance(x[1], (int, float)))
    part = " · часть 1 из 2: VIN через лобовое" if sid == "18a" else " · часть 2 из 2: таблички на двери" if sid == "18b" else ""
    out.append(dict(id=sid, card="%02d" % n, title=c["title"].capitalize() if c["title"].isupper() else c["title"], part=part, circle=c["circle"],
                    section=c["section"], priority=c.get("priority", "optional"), rhythm=rhythm, perm=perm, state=state, opens=opens,
                    order=ORDER.index(sid) + 1))
first = [s["id"] for s in out if not s["perm"] and not s["state"]]
must = [s["id"] for s in out if s["priority"] == "must"]
assert len(out) == 29, len(out)
assert len(first) == 15, first
assert len(must) in (24,), len(must)   # 23 обязательных + вторая часть 18
modes = [
    dict(id="first", name="Первое касание", desc="Ничего не открываем и не трогаем", ids=first, default=True),
    dict(id="full", name="Полный", desc="Все точки (своя машина или всё разрешено)", ids=ORDER),
    dict(id="must", name="Обязательное", desc="Только важное", ids=[i for i in ORDER if i in must]),
    dict(id="c1", name="Круг 1", desc="Внешний обход", ids=[s["id"] for s in out if s["circle"] == 1]),
    dict(id="c2", name="Круг 2", desc="Детали и надписи", ids=[s["id"] for s in out if s["circle"] == 2]),
    dict(id="c3", name="Круг 3", desc="Салон и жесты", ids=[s["id"] for s in out if s["circle"] == 3]),
    dict(id="quick", name="Быстрая эффектная", desc="Яркие кадры за 2–3 минуты", ids=[i for i in ORDER if i in QUICK]),
]
for m in modes:
    m["minutes"] = max(1, round(sum(next(s["rhythm"] for s in out if s["id"] == i) + 45 for i in m["ids"]) / 60))
json.dump(dict(shots=out, modes=modes, order=ORDER, maps={"1": "00z_karta_krug1", "2": "09z_karta_krug2", "3": "18z_karta_krug3"}, pre="00a_pered_semkoy"),
          open(os.path.join(ROOT, "shots.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("OK shots", len(out), "first", len(first), "must", len(must), [(m["id"], len(m["ids"]), m["minutes"]) for m in modes])
