# Three Laps — заметки сборки (v0.5, 10.10)
- v0.5 = шпаргалка и тренажёр маршрута (ТЗ `../shot_guide/ANDROID_TZ.md` v4.1). Чек-лист v0.4 — тег `v0.4`.
- Запуск локально: `python -m http.server 8765` в этой папке → http://localhost:8765 (Service Worker работает на localhost; во встроенной панели браузера Claude SW не регистрируется — проверять в обычном Chrome).
- Маршрут: `python tools/build_shots.py` → shots.json (таблица точек внутри скрипта). Тесты: `node --test logic.test.mjs`.
- Карточки: `cards/{light,dark}/<имя>.webp` + `thumb/` — имена 01, 01p … 09, 09p, vin, map_out1, map_out2, map_salon, pre, 17, 19…28. Нет файла → в приложении заглушка с подписью.
- После ЛЮБОЙ правки файлов или новых карточек — `python tools/build_sw.py` (precache.json: оболочка + карточки из shots.json, которые есть на диске; версия = хеш), иначе телефон не увидит новую версию.
- Для установки на телефон нужен https-хостинг (GitHub Pages). Папка целиком = сайт.
