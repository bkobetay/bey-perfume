# Flora Perfume — нишевая парфюмерия

Новый бренд в витрине, каталоге, корзине, кабинете продавца, сообщениях WhatsApp и собственной демоколлекции. Золотистый логотип с цветочным символом, почти чёрный синий фон, прежние 15 ароматов и объёмы 5/10 мл. Цены и данные сохранены. Новые заявки — FP; прежние NA/ARO/VOX/PB/PL/PS/LAGUNA/TS/BEY совместимы, исторические снимки не переписываются.

## Графика

- `site/dist/assets/flora-perfume-logo.svg`: векторный логотип FLORA / PERFUME и тонкий цветочный символ.
- `site/dist/assets/favicon.svg`: золотистая F на тёмном фоне.
- `site/dist/assets/flora-perfume-hero.webp`: 1536 × 1024, встроенный imagegen, edit, WebP quality 90.
- `site/dist/assets/flora-perfume-ritual.webp`: прежняя фотография нанесения, переименована.

Промпт imagegen:

> Use case: text-localization. Edit target: supplied perfume homepage photograph. Replace only bottle text NICHE AVENUE with exactly "FLORA" on first line and "PERFUME" underneath, elegant gold ivory serif uppercase lettering. Preserve bottle shape, right placement, black rocks, amber reflections, dark left negative space and 1536x1024 composition unchanged. No other text or watermark.

## Видео

Готовый файл: `artifacts/flora-perfume-whatsapp/Flora-Perfume-15MB.mp4`, 15,34 МБ, 65,67 секунды, 1440 × 988. Проверен декодированием и визуально; меньше 16 МБ.

Сценарий `site/scripts/record-demo.mjs` записывает главную, подборку, каталог, поиск, фильтры, выбор 10 мл, заявку, подтверждение оплаты и склад 100 → 90 → 140 мл на отдельной временной базе. Рабочие контакты и пароли не используются. Выход для этого этапа: `artifacts/flora-perfume-whatsapp/`. Финальный MP4 около 15 МБ экспортируется напрямую из исходной WebM двумя проходами H.264 veryslow, 1800 kbit/s, 30 кадров/с, yuv420p, faststart, без аудио. Для сохранения чёткости рекомендуется отправка как документа. Приватные данные и видео исключены из Git, рабочий сервер остаётся локальным.
