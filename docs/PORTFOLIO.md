# Портфолио для фриланс-площадок

Самостоятельный демонстрационный проект интернет-магазина нишевой парфюмерии. В кейсе показана текущая версия витрины PARFGREEN; это не заявление об официальном коммерческом заказе бренда. Цены, остатки и контакты на скриншотах тестовые. Публикации сайта и интеграции онлайн-оплаты нет.

## Готовые материалы

Локальные файлы, специально не включённые в Git:

- `output/pdf/Perfume-Store-Portfolio-RU.pdf` - шестистраничный PDF: главная и мобильная версия, каталог, корзина, кабинет продавца, склад, реализация.
- `output/portfolio/Portfolio-Cover.jpg` - обложка для галереи работ.
- `output/portfolio/Portfolio-Descriptions-RU-EN.txt` - тексты ниже в удобном для копирования формате.
- `output/portfolio/Freelance-Portfolio-Pack.zip` - PDF, обложка и описания одним архивом.

На форме из пользовательского скриншота лимит файла - 10 МБ. Для поля прикрепления подходит PDF; обложка предназначена для галереи. Если площадка принимает ссылки на исходный код, можно указать https://github.com/bkobetay/bey-perfume. Это репозиторий, а не опубликованный сайт; адрес 127.0.0.1 доступен только на локальном компьютере и для портфолио-ссылки не подходит.

## RU: название работы

Интернет-магазин нишевой парфюмерии: каталог, заявки и кабинет продавца

## RU: короткое описание

Разработал демонстрационный интернет-магазин нишевой парфюмерии с адаптивным дизайном, каталогом, фильтрами и поиском. Клиент выбирает аромат, объём от 5 мл и количество, затем оставляет заявку через корзину. В отдельном кабинете продавец управляет статусами заказов, готовит сообщения в WhatsApp и ведёт склад в миллилитрах. При подтверждении проверенной оплаты объём списывается один раз; наличие обновляется в каталоге. Технологии: HTML, CSS, JavaScript, Node.js, SQLite, Git. Проект демонстрационный, без онлайн-оплаты.

## RU: подробное описание

Задача: создать удобную витрину парфюмерного магазина и связать выбор покупателя с работой продавца. Проект разработан как самостоятельное демо для презентации магазинам.

Моя роль: разработка интерфейса, клиентской логики, серверного API, базы данных и сценариев заказов и склада; проверка поведения на компьютере и мобильных экранах. В работе использованы ИИ-инструменты для разработки и создания части визуалов.

Что реализовано:

- Адаптивная главная страница с подборкой ароматов, плавными переходами, состояниями наведения и блоком знакомства с магазином.
- Отдельный каталог: поиск по названию, бренду и нотам, шесть направлений ароматов, постраничная навигация. В демонстрационном ассортименте 15 ароматов.
- Выбор 5 или 10 мл, количества и соответствующей цены; корзина с итоговой суммой.
- Форма заявки с проверкой имени, форматированием телефона +7, согласием на связь и подтверждением с номером заказа.
- Отдельный кабинет продавца с входом по паролю, поиском заказов, статусами, заметками и отдельной вкладкой отменённых заявок.
- Ссылка в WhatsApp с готовым текстом заказа и вопросом о подтверждении на русском и казахском языках.
- Учёт склада в миллилитрах: подтверждение проверенной оплаты списывает заказанный объём один раз. Продавец может внести поступление или корректировку. Недоступный объём нельзя заказать; возврат после отмены выполняется вручную.
- Автоматические тесты заказов, склада, имени и защиты приватных файлов; история Git с точками отката.

Результат: рабочее локальное демо, демонстрирующее путь от выбора аромата до обработки заявки и обновления склада. Коммерческие результаты и реальные продажи не заявляются. Цены и остатки тестовые; онлайн-оплата и размещение в интернете не подключены.

Стек: HTML, CSS, JavaScript, Node.js, SQLite, Git.

## RU: текст для профиля

Разрабатываю адаптивные сайты-каталоги и интернет-магазины с заявками, а также кабинеты для управления заказами. Работаю с HTML, CSS, JavaScript, Node.js и SQLite. В моём портфолио - демонстрационный парфюмерный магазин: поиск и фильтры, корзина, формы, кабинет продавца и склад в миллилитрах. Уделяю внимание понятному интерфейсу, мобильной версии, проверке основных сценариев и сохранению истории изменений в Git. Готов обсудить сайт для вашего бизнеса и определить необходимый набор функций.

## EN: project title

Niche Perfume Store: Product Catalog, Order Requests & Seller Dashboard

## EN: short description

Built an independent demo perfume store with a responsive interface, searchable catalog and fragrance filters. Customers choose a perfume, a 5 ml or 10 ml decant and quantity, then submit an order request through the cart. A password-protected seller dashboard provides order statuses, notes, WhatsApp confirmation drafts in Russian and Kazakh, and inventory tracking in milliliters. Confirming verified payment deducts stock once; unavailable volumes cannot be ordered. Stack: HTML, CSS, JavaScript, Node.js, SQLite and Git. Demo project; no integrated online payments or public deployment.

## EN: detailed description

Goal: connect a perfume storefront with the seller's daily order and inventory workflow.

My role: interface development, frontend behavior, server API, database, order and stock workflows, and desktop/mobile verification. AI tools were used to assist development and create some visual assets.

Features include a responsive homepage, a separate paginated catalog with 15 demo fragrances, search by name/brand/notes, six fragrance categories, 5 ml and 10 ml volume options, a cart with quantity and totals, contact validation and an order reference after submission.

The seller dashboard provides password-based login, order search, status tabs, seller notes, a separate cancelled-order view and prefilled WhatsApp confirmation links in Russian and Kazakh. Inventory is tracked in milliliters. Confirmation of verified payment deducts the ordered volume once; stock replenishment and adjustments are handled by the seller. Cancelled orders require manual stock returns. Storefront availability is synchronized with inventory.

Order, inventory, name-validation and private-file tests complement browser verification. Git history and checkpoint tags preserve rollback points.

Result: a working local demonstration of the customer-to-seller workflow. This is an independent demonstration using PARFGREEN branding, not an official commissioned brand project. Prices, inventory and screenshot contacts are fictional/demo data. No commercial sales metrics, live payment integration or public deployment are claimed.

Stack: HTML, CSS, JavaScript, Node.js, SQLite, Git.

## EN: profile summary

I build responsive catalog websites, order-request stores and dashboards for small businesses using HTML, CSS, JavaScript, Node.js and SQLite. My portfolio includes a demo perfume store with product search and filters, a shopping cart, validated forms, a seller dashboard and milliliter-based inventory. I focus on clear interfaces, mobile layouts, testing essential workflows and keeping a recoverable Git history.

## Теги и навыки

Веб-разработка; адаптивная вёрстка; интернет-магазин; каталог товаров; JavaScript; HTML; CSS; Node.js; SQLite; REST API; формы; кабинет продавца; Git; тестирование.

## Границы публикации

Материалы подготовлены для ручного размещения пользователем. Регистрация, заполнение анкеты, принятие соглашений и публикация на внешних площадках не выполнялись. Реальные заказы, телефоны, пароли, приватная база и ключи в PDF, обложку, архив и Git не включены. Автор не подписан без подтверждения имени.
