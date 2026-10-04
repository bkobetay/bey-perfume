# Niche Avenue — нишевая парфюмерия

Новый бренд в витрине, каталоге, корзине, кабинете, собственной демоколлекции и сообщениях WhatsApp. Логотип SVG с белым названием в две строки, символом распылителя и оранжевыми акцентами по референсу. Favicon N на оранжевом фоне. Распив 5/10 мл, 15 ароматов и цены сохранены. Новые номера заказов — NA; ARO/VOX/PB/PL/PS/LAGUNA/TS/BEY совместимы без переписывания исторических снимков.

## Графика

- `site/dist/assets/niche-avenue-logo.svg`: векторный логотип.
- `site/dist/assets/niche-avenue-hero.webp`: 1536 × 1024, встроенный imagegen, edit, WebP quality 90.
- `site/dist/assets/niche-avenue-ritual.webp`: прежняя фотография нанесения, переименована.

Промпт встроенного imagegen:

> Use case: text-localization. Edit target: supplied perfume homepage photograph. Replace only "aromania.kz" on the bottle with exactly "NICHE" on the first line and "AVENUE" beneath it, elegant ivory uppercase lettering. Preserve bottle shape and position at right, black rocks, warm amber reflections, dark negative space at left and 1536x1024 composition. No other words or watermark.

## Видео

Версия около 15 МБ: `artifacts/niche-avenue-whatsapp/Niche-Avenue-15MB.mp4`. Создана напрямую из исходной WebM, без повторного сжатия готовых MP4. H.264 veryslow, два прохода (`-pass 1` в null, затем `-pass 2` в MP4 с общим passlogfile), `-b:v 1800k`, прежний captions.filter, 30 кадров/с, yuv420p, faststart, без аудио. Результат: 15 370 654 байта (15,37 МБ), 65,73 секунды, 1440 × 988. Полностью декодирован FFmpeg; кадр каталога просмотрен. Размер меньше 16 000 000 байт. Прежние версии сохранены.

Для отдельной записи можно указать `DEMO_OUTPUT_DIR`. Экспорт использует H.264/yuv420p, CRF 12, preset veryslow, ограничение видеопотока 1800 kbit/s и faststart. После полного декодирования проверяется размер меньше 16 000 000 байт: это консервативный бюджет экспорта, а не утверждение об универсальном лимите WhatsApp. Для сохранения качества интерфейса рекомендуется отправка MP4 как документа.

Готовая запись: 65,27 секунды. Полная проверка декодирования FFmpeg и просмотр контрольных кадров прошли без ошибок.

Сценарий `site/scripts/record-demo.mjs`: главная, подборка, каталог, фильтр, поиск, выбор 10 мл, заявка, подтверждение продавцом и склад 100 → 90 → 140 мл. Отдельная временная база с демоданными, без рабочих контактов и паролей в кадре. Выход: `artifacts/niche-avenue-demo/Niche-Avenue-demo.mp4`. MP4 H.264/yuv420p, 1440 × 988, 30 кадров/с, русские подписи, без аудио. Видео и приватные данные исключены из Git. Рабочий сервер остаётся локальным.
