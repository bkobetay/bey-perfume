# aromania.kz — нишевая парфюмерия

Витрина, каталог, корзина, кабинет продавца, собственная демоколлекция и сообщения WhatsApp переименованы. Распив 5/10 мл, 15 ароматов и цены сохранены. Новые номера заказов — ARO; VOX/PB/PL/PS/LAGUNA/TS/BEY остаются совместимыми. Снимки заказов, авторизация и ключ корзины не переписываются.

## Графика

- `site/dist/assets/aromania-logo.svg`: кремовый векторный логотип с символом флакона по предоставленному референсу; коричневый акцент меню.
- `site/dist/assets/favicon.svg`: символ флакона на тёплом коричневом фоне.
- `site/dist/assets/aromania-hero.webp`: 1536 × 1024, встроенный imagegen, edit, WebP quality 90.
- `site/dist/assets/aromania-ritual.webp`: прежняя фотография нанесения, переименована.

Промпт встроенного imagegen:

> Use case: text-localization. Edit target: supplied dark perfume homepage photograph. Replace only the bottle text "VOXPARFUM.KZ" with exactly "aromania.kz" in elegant cream lowercase letters. Keep bottle shape, position at right, black rocks, warm amber reflections, large dark negative space at left and 1536x1024 composition unchanged. No additional words or watermark.

Сценарий `site/scripts/record-demo.mjs` обновлён для Aromania. При запуске готовый MP4 сохраняется в `artifacts/aromania-demo/Aromania-demo.mp4`. На этом этапе новая запись не запрашивалась. Рабочий сервер остаётся локальным.
