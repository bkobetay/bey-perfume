# voxparfum.kz — нишевая парфюмерия

Название обновлено в витрине, каталоге, корзине, кабинете продавца, собственной демоколлекции и сообщениях WhatsApp. Золотистый стиль, 15 ароматов, подборка и распив от 5 мл сохранены. Доступны объёмы 5/10 мл с прежними демонстрационными ценами.

Новые заказы имеют префикс VOX. Старые PB/PL/PS/LAGUNA/TS/BEY поддерживаются, включая исторические позиции 3 мл. Снимки заказов, текущие остатки, авторизация и ключ корзины не переписываются. Имя прежней собственной коллекции заменяется только при отображении.

## Графика

- `site/dist/assets/voxparfum-logo.svg` — золотистый SVG VOXPARFUM.KZ, настроенный для узкой шапки.
- `site/dist/assets/favicon.svg` — монограмма V.
- `site/dist/assets/voxparfum-hero.webp` — главный флакон 1536 × 1024, встроенный imagegen, режим edit прежней иллюстрации Parfburo, WebP quality 90.
- `site/dist/assets/voxparfum-ritual.webp` — прежняя фотография нанесения, переименована.

Промпт главного флакона:

> Use case: text-localization. Edit target: attached perfume homepage photograph. Replace bottle text PARFBURO with exactly "VOXPARFUM.KZ" in one line of elegant gold serif uppercase letters, fitting comfortably on the front. Preserve the bottle shape, position at right, dark negative space on left, warm gold reflections, black rock and 1536x1024 wide composition. No extra words, no watermark.

## Видео

Сценарий `site/scripts/record-demo.mjs` записывает новую главную, подборку, каталог с фильтром/поиском, выбор 10 мл, корзину, заявку, подтверждение оплаты и склад 100 → 90 → 140 мл. Используется отдельная временная база с демоданными, без реальных контактов и паролей в кадре.

```sh
DEMO_FFMPEG=/absolute/path/to/ffmpeg node site/scripts/record-demo.mjs
```

Нужны доступные Playwright, Chrome и FFmpeg с libx264/drawtext. MP4: `artifacts/voxparfum-demo/Voxparfum-demo.mp4`, около 66 секунд, H.264/yuv420p, 1440 × 988, 30 кадров/с, русские подписи, без аудио. Видео и контрольные кадры исключены из Git; воспроизводимый сценарий сохранён. Рабочий сервер остаётся локальным.
