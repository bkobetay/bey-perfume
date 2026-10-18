# Perfume Store - авторский проект Bainur Kobetay

Perfume Store - нейтральное название собственного проекта для портфолио, без привязки к BEY или другому действующему магазину. Название, логотип, favicon, подписи, каталог, корзина, кабинет продавца и сообщения WhatsApp обновлены. В пользовательском интерфейсе убраны пометки о демонстрационной версии, ценах, изображениях и подборке. Вместо предупреждения о первоначальных остатках кабинет показывает рабочую инструкцию по учёту склада.

Приложение работает локально. Оплата обсуждается с продавцом после заявки, онлайн-эквайринг не подключён. Коммерческие результаты и завершённый заказ внешнего клиента не заявляются. Остатки, исходные снимки заказов и пароль сохранены. Новые заявки получают STORE-номера, BEY/PG и остальные исторические номера совместимы. Старое системное описание начального остатка нейтрально отображается в кабинете без перезаписи истории движений.

## Материалы для портфолио

- `output/pdf/Bainur-Kobetay-Perfume-Store-Portfolio.pdf`: шестистраничный кейс с подписью Bainur Kobetay.
- `output/portfolio/perfume-store/`: отдельные PNG в двойном разрешении, обложка, тексты RU/EN и архивы.
- `Perfume-Store-Screenshots.zip`: 15 отдельных PNG без рамок PDF, включая главную и каталог целиком. Они подходят для обрезки и размещения на сайте портфолио; не нужно снимать экран с PDF.
- `Freelance-Portfolio-Pack.zip`: PDF, обложка и тексты.

Скриншоты кабинета и заявок получены из отдельной временной базы, контакты вымышленные. Рабочие заказы, пароли и база в материалы не включены. Готовые файлы сохраняются локально; исходный код, описания и отчёты - в Git. Публикации сайта или материалов не выполнялось.

## Графика

Логотип `site/dist/assets/perfume-store-logo.svg` и favicon - редактируемая векторная типографика. Фото знакомства `site/dist/assets/perfume-store-introduction.webp` сохранено без изменения пикселей. Основное фото `site/dist/assets/perfume-store-hero.webp` создано редактированием прежнего флакона встроенным imagegen; изменена только надпись на PERFUME / STORE. Конвертация в WebP, quality 92, 1536 × 1024.

Исходник: `/Users/alpha/.codex/generated_images/01a0ee1a-fede-7932-adf1-c32bfd6e7fb0/exec-c46bf6b9-49e0-48cc-9d88-31db7df9a566.png`.

Промпт:

> Use case: text-localization. Edit target: the supplied perfume homepage photograph. Replace ONLY the bottle lettering. Remove both "BEY" and "PERFUME" and replace with two centered lines exactly "PERFUME" above "STORE", in small refined gold serif capitals. This is a neutral independent web project named Perfume Store; no existing shop branding. Keep the same bottle, cap, amber liquid, glass edges, rock, lighting, dark negative space on left, camera angle, and 1536x1024 landscape composition unchanged. Keep lettering on the front of the bottle only and no additional text, no emblems, no watermark. Preserve photographic realism.
