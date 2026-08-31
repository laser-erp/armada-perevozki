# Оформление подписи в приложении (все роли → оператор ЭПД)

Статус: **in-app shell готов** · API на armada-api — следующий шаг.

---

## Принцип

**Подписи живут в АРМАДА** — пользователь не уходит «куда-то в Контур навсегда»:

1. Карточка «Оформить КЭП/ПЭП» в профиле роли.
2. Кнопка → **полноэкранное окно оператора внутри приложения** (`#epd-operator-shell` + iframe).
3. Подпись титула ЭТrН → то же окно (`openEpdTitulSign`).
4. Статус профиля — в `state.epdSignProfiles`, синхронизация через API/webhook.

Криптография и юридическая сила — **у оператора**. АРМАДА — оболочка и учёт статуса.

---

## UI по ролям

| Роль | Экран | Подпись |
|------|-------|---------|
| Заказчик | Бух доки | КЭП · T1 |
| Логист | Профиль | КЭП · T2 |
| Водитель | Профиль | ПЭП · T3/T4 |

ИП «один на всё»: T2 из водительского приложения тоже открывает окно оператора (контекст фирмы по `DRIVER_COMPANY_ID`).

---

## Модуль `epd-sign.js`

| Функция | Назначение |
|---------|------------|
| `openEpdSignUp(role)` | Оформление подписи → iframe оператора |
| `openEpdTitulSign(orderId, titul, role)` | Подпись титула ЭТrН in-app |
| `openEpdOperatorShell(url)` | Общая оболочка |
| `syncEpdSignProfileFromApi` | Опрос `/epd/sign-status` |

Sandbox (без ключей): панель внутри shell + «Подписать (sandbox)».

---

## API armada-api

### `POST /epd/sign-up-url` — выпуск подписи

### `POST /epd/titul-sign-url` — подпись титула `{ orderId, titul, role }`

### `GET /epd/sign-status?role=&entityId=`

### `POST /epd/webhook` — события оператора → профили + `order.etrn.tituls`

`returnUrl`: `?epd-sign=1&role=carrier&orderId=…&titul=t2`

---

## Fallback

Если оператор запрещает iframe (X-Frame-Options) — кнопки «В браузере» и «Я подписал — обновить».

---

## Файлы

- `web-preview/epd-sign.js` — shell + логика
- `web-preview/etrn.js` — T1/T2/T3/T4 через `openEpdTitulSign`
- `web-preview/styles.css` — `.epd-operator-shell`
