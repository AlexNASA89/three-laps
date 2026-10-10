# Three Laps — заметки сборки (10.10)
- Запуск локально: `python -m http.server 8765` в этой папке → http://localhost:8765 (Service Worker работает на localhost).
- Пересборка: `python tools/build_shots.py` (shots.json) · `python tools/pack_cards.py` (WebP) · `python tools/build_sw.py` (precache.json, иконки, версия sw.js) · тесты: `node --test logic.test.mjs`.
- После ЛЮБОЙ правки файлов запускать `tools/build_sw.py`, иначе телефон не увидит новую версию.
- Отличия от ТЗ v3: 18б требует только «дверь открыта» (часть «под капотом» — подсказка в карточке); значки-машинки рисуются SVG (30 вариантов), права свободны; «компактные карточки» и размер текста — не сделаны.
- Для установки на телефон нужен https-хостинг (любая статика). Папка целиком = сайт.
