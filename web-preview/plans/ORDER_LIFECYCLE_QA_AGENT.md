# ORDER LIFECYCLE QA — только для агента

Технические подшаги, файлы, коммиты. Пользователь читает [ORDER_LIFECYCLE_QA_RUN.md](ORDER_LIFECYCLE_QA_RUN.md).

**Изоляция файлов:** [ORDER_LIFECYCLE_QA_ISOLATION.md](ORDER_LIFECYCLE_QA_ISOLATION.md)  
**Handoff локальному агенту:** [ORDER_LIFECYCLE_QA_LOCAL_AGENT.md](ORDER_LIFECYCLE_QA_LOCAL_AGENT.md)

---

## Шаг 1

### Подшаг 1a — форма `order.html`

| ID | Суть | Исправление |
|----|------|-------------|
| B1 | `order.html` → только `order-public.js` + `store.js`, без `app.js` | Хелперы sync/lead в `store.js`, `initCloudSync` в `order-public.js` |
| B2 | Lead → `persist()` с задержкой, заявка не на сервере | `persistCustomerPortalOrderImmediate` |
| B3 | SW: `respondWith` без Response при сети | `sw.js` → `swResponseOrError` |
| B4 | Поле время — валидация браузера | UX: время из picker (не блокер) |
| B5 | Вызовы только из `app.js` при submit | Guards в `store.js` |

**Файлы замка:** `order.html`, `order-public.js`, зоны portal в `store.js`, при необходимости `sw.js`.

**QA-STEP в коммите:** `1` / `1a`

**Staging (24.09):** `APP_BUILD=2026-09-24-order-public-sync-v6`

### Подшаг 1b — канбан «Входящие» vs «В работе»

| Суть | Исправление |
|------|-------------|
| №9 у логиста в **«В работе»** при пустом рейсе (stub «Диспетчер», одометры/assign phantom) | `app.js`: `healPhantomPortalTrip`, `healPortalInboxDriverStub`; колонка через `isLogistInboxOrder` / `adminKanbanColumnKey` |

**Файлы замка:** `app.js` (inbox/heal), не трогать после ЗАМОКа шага 1 без «да, чини шаг 1».

**QA-STEP в коммите:** `1b`

**Проверка:** staging `/a`, Ctrl+Shift+R, №9 во **Входящих**.

---

## Шаг 2

**Файлы:** `admin.js` — `openDetail`, блоки карточки; `ADMIN_LOGIST_CLIENT_MARKUP=1.35`.

| Задача | Реализация |
|--------|------------|
| Плейсхолдеры парка | `adminOrderDetailAssignSectionHtml` |
| Секции UI | заказчик / груз+ТС / цена / маршрут |
| Требования ТС | `adminHydrateOrderReqsForDisplay`, `mapVtypeToBodyType`, hint `vehicleTypeIds` |
| Убрать cargo-kind UI | hidden `#d-cargo-kind` |
| ИНН | `#d-customer-type`, `#d-customer-inn-wrap`, validate 10 digit on save |
| Перевозчик default | `adminDefaultCarrierId`, `adminCarrierOptionsForOrder` |
| Цены | `adminOrderLogistPricePair` + `suggestCustomerOrderPrice` |

**QA-STEP:** `2` · **BUILD:** `2026-09-24-admin-order-card-step2-v8`

---

## Шаги 3–8

*(заготовки по мере прогона)*
