# Aliden Parfum — нишевая парфюмерия

Название обновлено в витрине, каталоге, корзине, кабинете, WhatsApp и собственной демоколлекции. Двухстрочный золотистый логотип с засечками, почти чёрный синий фон, 15 ароматов и распив от 5 мл.

Новые номера заявок — AP. Прежние LIB/RP/FP/NA/ARO/VOX/PB/PL/PS/LAGUNA/TS/BEY совместимы без переписывания снимков заказов или остатков.

## Графика

- `site/dist/assets/aliden-parfum-logo.svg`: векторная надпись ALIDEN / PARFUM.
- `site/dist/assets/favicon.svg`: золотистая A на тёмном фоне.
- `site/dist/assets/aliden-parfum-hero.webp`: 1536 × 1024, встроенный imagegen, edit, WebP quality 90.
- `site/dist/assets/aliden-parfum-ritual.webp`: прежняя фотография нанесения.

Исходник imagegen: `/Users/alpha/.codex/generated_images/01a0ee1a-fede-7932-adf1-c32bfd6e7fb0/exec-6a9618b7-0e5a-4ae2-8e24-bc80bccd366e.png`.

Промпт:

> Edit this perfume homepage photograph. Replace only bottle lettering Liberté with exactly "ALIDEN" and smaller "PARFUM" beneath it, elegant ivory serif lettering. Preserve the bottle shape and position on right, rocks, amber reflections, dark negative space on left and 1536x1024 composition. No other text or watermark.

## Плавная запись

`site/scripts/record-demo.mjs` записывает реальный браузер с временной базой, без рабочих контактов и паролей. Движение курсора длится 720 мс с плавным ускорением и замедлением; прокрутка — 1100 мс. Переходы между страницами и к складу прикрыты мягким затемнением. Запись не ускоряется при экспорте.

Экспорт: 1440 × 988, H.264/yuv420p, 50 кадров/с, два прохода veryslow, 1950 kbit/s, faststart, без аудио. Исходная запись браузера — 25 кадров/с; каждый кадр повторяется дважды, сохраняя равномерный ритм без неравномерного повторения при переводе 25 → 30. Это не нативная запись 50 кадров/с. Подписи находятся под интерфейсом. Смешивание и компенсация движения проверены на контрольных кадрах и исключены из финального экспорта из-за двоения или искажения текста при прокрутке.

Файл: `artifacts/aliden-parfum-final/Aliden-Parfum-15MB.mp4`. Каталог, поиск, 10 мл, заявка, подтверждение оплаты и склад 100 → 90 → 140 мл. Для сохранения чёткости отправлять как документ.

Готовый файл: ровно 60 секунд, 14,90 МБ (14 898 568 байт). Полное декодирование FFmpeg без ошибок; общий обзор кадров, прокрутка и переходы просмотрены визуально.

Видео, скриншоты и приватные данные исключены из Git. Разработка остаётся локальной.
