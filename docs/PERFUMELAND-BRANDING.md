# Perfumeland — демоверсия и запись сайта

Название витрины, каталога, корзины и кабинета — **Perfumeland**. Позиционирование «Разливная парфюмерия» и золотистая палитра предыдущей версии сохранены.

## Подборка

Порядок на главной согласован с пользователем:

1. Tom Ford Ombré Leather — Eau de Parfum.
2. Kilian Black Phantom — Memento Mori.
3. Roja Elysium Pour Homme — Eau de Parfum.
4. Creed Aventus из прежнего каталога.

Первые три позиции добавлены в полный каталог; прежние 12 сохранены. Всего 15 ароматов, по 12 на странице. Новым позициям в локальной демобазе добавлено по 100 мл через защищённый API с журналированием. Предыдущие остатки и заказы не изменены. Цены демонстрационные: они не являются прайс-листом магазина.

## Графика

- `site/dist/assets/perfumeland-logo.svg` — векторная золотистая надпись PERFUMELAND.
- `site/dist/assets/favicon.svg` — монограмма PL.
- `site/dist/assets/perfumeland-hero.webp` — главный флакон, 1536 × 1024, WebP quality 90. Использован встроенный imagegen в режиме edit, исходник — предыдущий флакон Perfume Studio.
- `site/dist/assets/perfumeland-ritual.webp` — прежняя фотография нанесения, переименована без изменения изображения.
- Три фотографии новых товаров сохранены локально в `site/dist/assets/products/`; источники перечислены в `docs/CATALOG-SOURCES.md`. Флаконы реальных брендов не генерировались. Для Black Phantom сохранён чёрный фон исходной фотографии, добавлены поля и читаемый золотистый индекс.

Промпт главного изображения:

> Use case: text-localization. Edit target: the attached wide perfume-store hero photograph. Change only the bottle label from PERFUME STUDIO to exactly "PERFUMELAND" in one line of elegant small gold serif uppercase letters, fitting comfortably on the bottle front. Remove STUDIO completely. Preserve the entire photographic composition, bottle shape and position at right, dark empty left half, golden amber lighting and reflections, black stone, 1536x1024 landscape aspect ratio. No other words, no watermark.

## Совместимость и запись

Новые заказы имеют префикс `PL-`. Старые PS/LAGUNA/TS/BEY обрабатываются как раньше; исторические снимки не переписываются. Старое имя собственной коллекции заменяется только при отображении. Ключ корзины, авторизация и Git remote сохраняются.

Сценарий `site/scripts/record-demo.mjs` записывает настоящий браузер: новая главная и подборка → кожаный фильтр и поиск Ombré → выбор 10 мл → корзина → заявка → подтверждение оплаты продавцом → склад 100 → 90 мл → поступление 50 мл → 140 мл.

Запуск из корня с доступными Playwright, Chrome и FFmpeg (libx264/drawtext):

```sh
DEMO_FFMPEG=/absolute/path/to/ffmpeg node site/scripts/record-demo.mjs
```

Временная база и отдельные порты 4187/4188 не затрагивают рабочие данные. Пароль не попадает в запись, временные данные удаляются. Итоговый MP4 с русскими подписями, без озвучки: `artifacts/perfumeland-demo/Perfumeland-demo.mp4`. Около 66 секунд, 1440 × 988, H.264/yuv420p, 30 кадров/с. Исходная запись, контрольные кадры и таймлайн находятся рядом; папка исключена из Git. Предыдущее видео Perfume Studio сохранено отдельно.
