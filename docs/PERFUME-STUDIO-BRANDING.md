# Perfume Studio — оформление и демонстрация

Позиционирование: **«Разливная парфюмерия»**. Основной акцент — шампань `#ccb48d` на графитовом `#101110`. Золотистые кнопки, подсветка и тёплые отражения заменяют бирюзовое оформление LAGUNA.

## Графика

- `site/dist/assets/perfume-studio-logo.svg` — новый двухстрочный векторный знак PERFUME / STUDIO.
- `site/dist/assets/favicon.svg` — золотистая монограмма PS.
- `site/dist/assets/perfume-studio-hero.webp` — главный флакон, 1536 × 1024; встроенный imagegen, режим редактирования прежней иллюстрации LAGUNA, затем WebP quality 90.
- `site/dist/assets/perfume-studio-ritual.webp` — прежняя фотография нанесения аромата, переименована; бренд поверх неё задаётся HTML.

Промпт редактирования главного изображения:

> Use case: text-localization. Edit target: the attached perfume homepage photograph. Replace all "LAGUNA" and "NICHE PERFUMERY" bottle text with exactly "PERFUME" on the first line and "STUDIO" on the second line, in elegant thin gold serif uppercase typography. Replace every turquoise/blue lighting reflection with soft champagne-gold and warm amber reflections. Keep the same realistic bottle shape, right-side position, black stone, dark negative space on the left, 1536x1024 wide composition. Premium restrained gold perfume-store branding. Preserve photographic realism and avoid neon. No extra words, no new objects, no watermark.

Фотографии реальных товаров не перерисовывались. Ассортимент, цены, объёмы и рабочие остатки сохранены.

## Совместимость

Витрина, каталог, корзина, кабинет, сообщения WhatsApp и демоколлекция используют Perfume Studio. Новые заказы начинаются с `PS-`. Старые номера LAGUNA/TS/BEY продолжают обрабатываться. Исторические снимки заказов, база, ключ корзины, авторизация и Git remote сохранены; прежняя собственная коллекция переименовывается только при отображении.

## Минутная запись сайта

Сценарий `site/scripts/record-demo.mjs` записывает настоящий браузер: главная → подборка → каталог/фильтр/поиск → 10 мл Aventus → корзина → заявка → кабинет → подтверждение оплаты → списание 100 → 90 мл → поступление 50 мл → 140 мл.

Для записи нужны отдельно доступные Playwright, Chrome и FFmpeg с libx264/drawtext. Они не являются зависимостями самого магазина. Пример запуска из корня, когда Playwright доступен Node:

```sh
DEMO_FFMPEG=/absolute/path/to/ffmpeg node site/scripts/record-demo.mjs
```

Используются временная база и отдельные порты 4187/4188 (можно переопределить `DEMO_PORT` и `DEMO_ADMIN_PORT`). Учётные данные создаются на время записи, не выводятся в видео и удаляются вместе с временной базой. Живые заказы и остатки не используются. Ролик не отправляет сообщений клиентам.

Готовый файл: `artifacts/perfume-studio-demo/Perfume-Studio-demo.mp4`, 66 секунд, H.264/yuv420p, 30 кадров/с, 1440 × 988, без звука. Поясняющие подписи находятся в отдельной нижней полосе и не закрывают интерфейс. Рядом сохраняются исходная запись, таймлайн и контрольные кадры. Видео и локальные инструменты в `artifacts/` игнорируются Git; в репозитории хранится воспроизводимый сценарий.
