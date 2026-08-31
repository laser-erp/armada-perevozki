# Оформление подписи в приложении (все роли → оператор ЭПД)

Статус: **MVP UI готов** · API `POST /epd/sign-up-url` — следующий шаг на armada-api.

---

## Идея

Зарегистрировался в АРМАДА → в своём приложении видишь блок **«Оформить подпись»** → одна кнопка → **ссылка оператора ЭПД** (Кontur и др.) → вернулся → статус **«активна»**.

Без «езжай в УЦ с флешкой», без отдельных кабинетов. АРМАДА не выпускает КЭП/ПЭП — только **ведёт в оператора** и хранит статус.

| Роль | Где в UI | Тип подписи | ЭТrН |
|------|----------|-------------|------|
| Заказчик | Портал → «Бух доки» | КЭП | T1 |
| Логист / перевозчик | Кабинет → Профиль | КЭП | T2 |
| Водитель | Водитель → Профиль | ПЭП | T3, T4 |

ИП «директор = водитель»: **КЭП в кабинете**, **ПЭП в приложении водителя** — оба с телефона через оператора.

---

## Поток пользователя

```
[Регистрация / вход в АРМАДА]
        ↓
[Карточка «Оформить КЭП/ПЭП» — статус: не оформлена]
        ↓
[Оформить] → POST armada-api/epd/sign-up-url
        ↓
[302 / JSON.url → окно оператора: Гosуслуги, SMS, облачная КЭП…]
        ↓
[Webhook оператора → armada-api → state.epdSignProfiles]
        ↓
[returnUrl ?epd-sign=1&role=carrier] → статус «активна» в приложении
        ↓
[Подписать ЭТrН] → deep link оператора на конкретный титул
```

---

## Модель данных (клиент)

`state.epdSignProfiles['carrier:companyId']`:

```json
{
  "role": "carrier",
  "entityId": "…",
  "signKind": "kep",
  "status": "none|pending|active|expired",
  "operatorId": "kontur",
  "externalUserId": "",
  "issuedAt": "",
  "expiresAt": "",
  "pendingUrl": ""
}
```

Ключ: `{role}:{entityId}`.

---

## API armada-api (добавить на VPS)

### `POST /epd/sign-up-url`

Тело:

```json
{
  "role": "customer|carrier|driver",
  "entityId": "uuid",
  "inn": "10 или 12 цифр",
  "phone": "+7…",
  "name": "Наименование / ФИО",
  "returnUrl": "https://app.armada.sx/a/?epd-sign=1&role=carrier"
}
```

Ответ:

```json
{
  "url": "https://… оператор …",
  "expiresInSec": 3600
}
```

Логика на сервере:

1. Проверить JWT / сессию роли.
2. Создать или найти пользователя в API оператора (Кontur Logistics / Diadoc).
3. Вернуть **одноразовую ссылку** на регистрацию/выпуск подписи.
4. Записать `pending` в PB рядом с заказом/компанией.

### `POST /epd/webhook` (уже есть черновик)

События: `sign.issued`, `sign.expired`, `titul.signed` → обновить `epdSignProfiles` и `order.etrn.tituls`.

### `GET /epd/sign-status?role=&entityId=`

Для обновления статуса без перезагрузки.

---

## Fallback без API

Пока `configured: false` — кнопка открывает **landing оператора** с UTM и подставленными `inn`, `phone` (`epd-sign.js` → `epdSignFallbackUrl`).

---

## Файлы

| Файл | Назначение |
|------|------------|
| `web-preview/epd-sign.js` | Карточка, статусы, ссылки |
| `web-preview/customer.js` | `renderCustomerEpdSignCard` в «Бух доки» |
| `web-preview/admin-profile.js` | КЭП перевозчика |
| `web-preview/driver.js` | ПЭП водителя |
| `scripts/armada-api.env.example` | ключи оператора |

---

## Чек-лист для ИП (текст в UI)

1. Нажмите «Оформить КЭП» в **Профиле** кабинета (перевозчик).
2. В приложении **водителя** → «Оформить ПЭП» (тот же телефон).
3. Заказчик оформляет КЭП в **Бух доки** (T1).
4. На погрузке: T1 → T2 (вы в кабинете или с телефона) → T3 (водитель).

---

## Следующие шаги

1. Реализовать `POST /epd/sign-up-url` в armada-api при ключах Контура.
2. Webhook → синхронизация статуса (не только `?epd-sign=1` на return).
3. При «Подписать T2/T3» — `POST /orders/:id/etrn/sign-url?titul=t2` вместо sandbox.
4. Badge «подпись не оформлена» на вкладках до `active`.
