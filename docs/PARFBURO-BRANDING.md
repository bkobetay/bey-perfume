# Parfburo — нишевая парфюмерия

Название обновлено в витрине, каталоге, корзине, кабинете, сообщениях WhatsApp и собственной демоколлекции. Золотистый стиль сохранён. Ассортимент — прежние 15 ароматов; подборка Ombré Leather, Black Phantom, Elysium Pour Homme и Aventus сохранена.

## Распив от 5 мл

Для всех ароматов доступны 5 и 10 мл с прежними демонстрационными ценами. Варианты по 3 мл удалены из данных и с обеих страниц; генератор запрещает объёмы меньше 5 мл. Сервер отклоняет новые заявки на 3 мл. Старая корзина очищается от снятых вариантов, сохраняя доступные позиции. Уже оформленные заказы на 3 мл остаются в кабинете: подтверждение, отмена и возврат работают с их сохранённым объёмом.

Новые номера заказов начинаются с PB. Старые PL/PS/LAGUNA/TS/BEY поддерживаются. Рабочая база, остатки, авторизация и ключ корзины сохранены.

## Графика

- `site/dist/assets/parfburo-logo.svg` — золотистый SVG PARFBURO.
- `site/dist/assets/favicon.svg` — монограмма PB.
- `site/dist/assets/parfburo-hero.webp` — 1536 × 1024, встроенный imagegen, режим edit, затем WebP quality 90. Исходник — предыдущая иллюстрация Perfumeland.
- `site/dist/assets/parfburo-ritual.webp` — прежняя фотография нанесения, только переименована.

Промпт главной иллюстрации:

> Use case: text-localization. Edit target: attached wide perfume hero photograph. Replace only bottle text PERFUMELAND with exactly "PARFBURO" in elegant gold serif uppercase letters. Preserve bottle shape and position, dark negative space on left, golden lighting, black stone and 1536x1024 composition. No extra text or watermark.

## Видео

Сценарий `site/scripts/record-demo.mjs` обновлён для Parfburo. Запись показывает главную, подборку, фильтр и поиск, заказ 10 мл, кабинет продавца, проверку оплаты, списание 100 → 90 мл и поступление до 140 мл. Русские подписи, без озвучки, отдельная временная база без реальных клиентских данных.

Запуск с доступными Playwright, Chrome и FFmpeg:

```sh
DEMO_FFMPEG=/absolute/path/to/ffmpeg node site/scripts/record-demo.mjs
```

MP4: `artifacts/parfburo-demo/Parfburo-demo.mp4`, около 66 секунд, H.264/yuv420p, 1440 × 988, 30 кадров/с. Видео и контрольные кадры исключены из Git; сценарий сохранён в репозитории. Прежние ролики доступны в своих папках.
