// Тексты: готовый разговор с хозяином (читать с экрана), онбординг, значки-машинки.
// Разговор: разделы по порядку встречи. q: true — вопрос, у него галочка «спросил» и поле ответа, попадает в итог.
// {name} — имя из настроек («Ваше имя для знакомства»); если пусто, фраза без имени.
export const TALK = [
  { id: "hello", title: "Знакомство", tip: "Подойдите спокойно, улыбнитесь. Сначала про машину, потом про съёмку.", lines: [
    { id: "h1", en: "Hi there! Sorry to bother you — that's a beautiful car. Is it yours?", ru: "Здравствуйте! Простите, что отвлекаю, — прекрасная машина. Она ваша?" },
    { id: "h2", en: "{intro}I make short videos about classic cars.", ru: "{introRu}Я делаю короткие видео о классических машинах." },
    { id: "h3", en: "Would you mind if I film it for a couple of minutes? I'll be quick, and I won't touch anything.", ru: "Вы не против, если я сниму её пару минут? Я быстро и ничего не трону." },
  ] },
  { id: "access", title: "Разрешения", tip: "Просите по одному. «Нет» — нормально: поблагодарите и снимайте дальше снаружи.", lines: [
    { id: "a1", en: "Would it be okay to open the driver's door for a quick shot of the interior?", ru: "Можно открыть дверь водителя и быстро снять салон?" },
    { id: "a2", en: "Could you open the hood for me? I'd love to film the engine.", ru: "Не могли бы вы открыть капот? Очень хочется снять мотор." },
    { id: "a3", en: "Would you mind starting the engine for a few seconds? I'd like to record the sound.", ru: "Можете завести мотор на несколько секунд? Хочу записать звук." },
    { id: "a4", en: "Is it okay if I touch the door handle and the steering wheel? I'll be careful.", ru: "Можно я коснусь ручки двери и руля? Я аккуратно." },
    { id: "a5", en: "No problem at all — thank you anyway!", ru: "Ничего страшного — всё равно спасибо!" },
  ] },
  { id: "car", title: "О машине", tip: "Задавайте 3–4 вопроса, которые интересны. Ответ можно записать сразу или голосом с клавиатуры.", lines: [
    { id: "c1", q: true, en: "What year is it, and what's the exact model or trim?", ru: "Какой это год и какая точно модель или комплектация?" },
    { id: "c2", q: true, en: "Is the engine original? Has anything been changed or upgraded?", ru: "Мотор родной? Что-нибудь меняли или дорабатывали?" },
    { id: "c3", q: true, en: "How long have you had it? Where did you find it?", ru: "Давно она у вас? Где вы её нашли?" },
    { id: "c4", q: true, en: "Has it been restored? What was done, and when?", ru: "Её реставрировали? Что сделано и когда?" },
    { id: "c5", q: true, en: "Are the miles original? Do you have any documents or history for it?", ru: "Пробег родной? Есть документы или история машины?" },
    { id: "c6", q: true, en: "What makes this car special? Any rare options, or a story behind it?", ru: "Чем эта машина особенная? Редкие опции или интересная история?" },
    { id: "c7", q: true, en: "What's your favorite thing about driving it?", ru: "Что вам больше всего нравится, когда вы на ней ездите?" },
    { id: "c8", q: true, en: "Just out of curiosity — what do you think it's worth today? Totally fine if you'd rather not say.", ru: "Просто из интереса: во сколько вы её сегодня оцениваете? Если не хотите говорить — ничего страшного." },
  ] },
  { id: "video", title: "Видео и связь", tip: "Спросите до прощания: можно ли выложить и как подписать.", lines: [
    { id: "v1", q: true, en: "Would it be okay if I post the video online?", ru: "Можно я выложу видео в интернет?" },
    { id: "v2", q: true, en: "Would you like me to mention your name, your shop, or your club?", ru: "Упомянуть ваше имя, мастерскую или клуб?" },
    { id: "v3", q: true, en: "Can I send you the video when it's ready? What's the best way to reach you?", ru: "Прислать вам видео, когда будет готово? Как с вами лучше связаться?" },
  ] },
  { id: "bye", title: "Прощание", lines: [
    { id: "b1", en: "Thank you so much for your time — it's a gorgeous car!", ru: "Большое спасибо за ваше время — машина великолепная!" },
    { id: "b2", en: "Have a great day!", ru: "Хорошего дня!" },
  ] },
  { id: "help", title: "Если не понял", lines: [
    { id: "x1", en: "Sorry, could you say that again a little slower?", ru: "Простите, можете повторить чуть медленнее?" },
    { id: "x2", en: "Could you write it down for me, please?", ru: "Можете написать, пожалуйста?" },
    { id: "x3", en: "My English isn't perfect — thank you for your patience!", ru: "Мой английский не идеален — спасибо за терпение!" },
  ] },
];
export function talkLine(l, name) {   // подставить имя в знакомство
  const n = (name || "").trim();
  return { ...l, en: l.en.replace("{intro}", n ? `My name is ${n}. ` : ""), ru: l.ru.replace("{introRu}", n ? `Меня зовут ${n}. ` : "") };
}
export const TALK_FLAT = TALK.flatMap((s) => s.lines.map((l) => ({ ...l, section: s.id })));
export const ONBOARD = [
  ["Три круга вокруг машины", "Приложение ведёт по кадрам обхода: что снимать, откуда и как. Снимаете на отдельный телефон, здесь только чек-лист."],
  ["Три кнопки", "«Снял» — кадр готов, дальше следующий. «Потом» — вернёмся в конце круга. «Ещё» — не нужен, заметка, разговор с хозяином, отмена."],
  ["Первое касание", "Сначала снимаем всё, что можно, ничего не открывая. После каждого круга приложение спросит: «Есть доступ?» Снимайте с разрешения владельца и будьте внимательны вокруг машин и людей."],
];
// 30 значков-машинок: временные вырезки проекта (tools/make_icons.py), потом заменим на свои/свободные.
export function carIcon(i, size = 56) {
  const n = ((i % 30) + 30) % 30;
  return `<img src="icons/cars/${String(n).padStart(2, "0")}.webp" alt="" style="width:${size}px;height:auto;display:block">`;
}
export const nextIcon = (prev) => { let n; do { n = Math.floor(Math.random() * 30); } while (n === prev); return n; };
