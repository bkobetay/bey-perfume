# LAGUNA — оформление демоверсии

Референс: предоставленный пользователем логотип с тонкими бирюзовыми буквами на графитовом фоне. Основной акцент интерфейса — `#28d4c6`. Позиционирование: «Сеть магазинов нишевой парфюмерии».

## Файлы

- `site/dist/assets/laguna-logo.svg` — масштабируемая векторная адаптация логотипа, нарисованная кодом; используется в шапке, подвале, кабинете и корзине.
- `site/dist/assets/favicon.svg` — бирюзовая буква L с волной.
- `site/dist/assets/laguna-hero.webp` — главный флакон LAGUNA, 1536 × 1024. Редактирование выполнено встроенным imagegen, режим edit, затем результат сохранён в WebP.
- `site/dist/assets/laguna-ritual.webp` — прежняя фотография нанесения аромата, только переименована; надпись поверх неё задаётся HTML.

## Промпт главной иллюстрации

Use case: text-localization and brand restyling. Image 1 is the edit target: the existing wide perfume homepage hero. Image 2 is the LAGUNA logo style reference only. Replace the gold "T S" and "PERFUME" bottle lettering with exact text "LAGUNA" in thin contemporary uppercase turquoise sans-serif, inspired by the reference, with a subtle flowing connection from G to U. Beneath it, tiny spaced "NICHE PERFUMERY". Preserve the target bottle shape, size, right-side placement, black rock, realistic photographic materials and 1536x1024 wide composition with dark empty space on the left for website text. Change the amber accent lighting to restrained cool turquoise/teal reflections, keep natural transparent glass and a neutral pale perfume liquid, charcoal background. Premium understated perfumery, not neon sci-fi. No other text, no watermarks, no new objects. Output the complete wide hero photograph.

Первый вход — прежняя иллюстрация флакона TS, второй — логотип пользователя. Сохраняются композиция, расположение флакона и свободное пространство для текста. Изображения настоящих товаров не перерисовывались.

## Совместимость

Название обновлено на витрине, в кабинете, собственных демо-коллекциях, сообщениях WhatsApp и новых номерах заказов. Старые коды TS/BEY, ключ корзины, авторизация, локальная база и Git remote сохранены совместимыми. Исторические записи в документации и Git не переписываются. Ассортимент, объёмы, цены и текущие остатки не менялись.
