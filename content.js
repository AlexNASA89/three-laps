// Тексты: английские фразы для хозяина, вопросы, онбординг, машинки-значки (SVG, свободные права).
export const PHRASES = [
  ["Hi! Is it okay if I film your car for a short review?", "Можно снять вашу машину для короткого обзора?"],
  ["Could I open the driver's door for a quick shot of the interior?", "Можно открыть дверь водителя, снять салон?"],
  ["Would you mind opening the hood so I can film the engine?", "Не могли бы вы открыть капот, снять мотор?"],
  ["May I touch the car? I'll be very careful.", "Можно потрогать машину? Буду аккуратен."],
  ["Could you start the engine for a few seconds? I'd like to record the sound.", "Можно завести мотор на несколько секунд, записать звук?"],
  ["I won't touch anything else. Thank you so much!", "Больше ничего не трону. Большое спасибо!"],
];
export const TIPS = ["Подойдите, поздоровайтесь, скажите, что снимаете обзор.", "Ничего не касайтесь, пока не услышали «да».", "Если ответ «нет» — это нормально, спасибо и дальше."];
export const QUESTIONS = [
  ["Год, модель, комплектация / пакет?", "Year, model, trim / package?"],
  ["Оригинальные ли мотор и коробка, что менялось?", "Are the engine and transmission original? What was changed?"],
  ["Давно ли у вас, где куплена?", "How long have you owned it, where did you buy it?"],
  ["Реставрация: что сделано, когда?", "Was it restored? What was done and when?"],
  ["Пробег настоящий? Документы, история?", "Is the mileage original? Any documents or history?"],
  ["Чем необычна: редкие опции, особенности, история?", "What makes it special: rare options, quirks, story?"],
  ["Можно ли выложить видео и назвать вас / ваш клуб?", "May I post the video and mention you / your club?"],
  ["Из интереса: во сколько вы её оцениваете или сколько заплатили? (по желанию)", "Just curious: what is it worth to you, or what did you pay? (optional)"],
  ["Контакт для связи (по желанию)", "Contact for follow-up (optional)"],
];
export const ONBOARD = [
  ["Три круга вокруг машины", "Приложение ведёт по кадрам обхода: что снимать, откуда и как. Снимаете на отдельный телефон, здесь только чек-лист."],
  ["Три кнопки", "«Снял» — кадр готов и следующий. «Потом» — вернёмся в конце. «Ещё» — не нужен, заметка, фразы для хозяина, отмена."],
  ["Первое касание", "Начинайте с кадров, где ничего не нужно открывать и трогать. Остальное откроется, когда хозяин разрешит. Снимайте с разрешения владельца и будьте внимательны вокруг машин и людей."],
];
// 30 значков-машинок: временные вырезки проекта (tools/make_icons.py), потом заменим на свои/свободные.
export function carIcon(i, size = 56) {
  const n = ((i % 30) + 30) % 30;
  return `<img src="icons/cars/${String(n).padStart(2, "0")}.webp" alt="" style="width:${size}px;height:auto;display:block">`;
}
export const nextIcon = (prev) => { let n; do { n = Math.floor(Math.random() * 30); } while (n === prev); return n; };
