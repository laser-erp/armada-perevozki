# Навигация для агента (АРМАДА)

**Цель:** не обходить весь репозиторий — сначала **тема → файл → grep → кусок**.

**Актуальность (обязательно):** после задачи, где появился **новый файл**, **новая точка входа** или **функция, которую снова будут искать** — **в той же задаче** дописать **одну строку** в §3 (или §5 для plan). Без отдельного запроса «обнови карту».

**Обновлять:** файл + символ / `#id` поля — не пересказ логики и не копия журнала QA.

**Эта карта:** `AGENT_NAVIGATION.md` (корень репо).

---

## 1. Как искать (порядок)

1. Таблица **«Тема → файл»** ниже.
2. `grep` по **имени функции** или **id поля** (`d-price-client`, `openDetail`, …).
3. `Read` **20–80 строк** вокруг совпадения, не весь `admin.js` / `store.js`.
4. План по фиче (если есть) — `web-preview/plans/*_PLAN.md`.
5. Прогон QA — `web-preview/plans/ORDER_LIFECYCLE_QA_*.md` + `AGENT_NAVIGATION.md` не дублировать, только ссылка.

---

## 2. URL → какие скрипты грузятся

Источник: `web-preview/boot-loader.js` → `shellScripts()`.

| URL | Роль | Главные JS (после `store.js`, `billing.js`) |
|-----|------|-----------------------------------------------|
| `/a` | Логист | `order-documents.js`, `doc-templates.js`, `admin.js`, `admin-docs.js`, … → **`app.js`** |
| `/v` | Водитель | `driver.js`, `etrn.js`, … → **`app.js`** |
| `/z` | Заказчик | `order-documents.js`, `customer.js`, … → **`app.js`** |
| `/`, прочее | Оболочка | `admin.js`, `customer.js`, `driver.js`, … → **`app.js`** |
| `order.html` | Публичная заявка | отдельно: **`order-public.js`** + **`store.js`** (без полного `app.js`) |

---

## 3. Тема → файл → куда смотреть

| Тема | Файл | Символы / зона |
|------|------|----------------|
| **Агент закон** — НПА, экспедиция, негабарит, «4 м» | `legal/INDEX.md`, `legal/MANIFEST.yaml`, `.cursor/skills/legal-legislation-verify/` | в чате: «Агент закон: …»; PDF в `legal/npa/` |
| Данные, sync, push, заказы в state | `web-preview/store.js` | `persist`, `initCloudSync`, `appendCustomerPortalLead`, `insertPublicTransportOrder`, `financeForOrder` |
| Общая логика, тариф, канбан, heal inbox | `web-preview/app.js` | `isLogistInboxOrder`, `adminKanbanColumnKey`, `healPhantomPortalTrip`, `suggestCustomerOrderPrice`, `clientRate` |
| Кабинет логиста `/a` | `web-preview/admin.js` | `openDetail`, `renderAdmin`, `adminOrderDetailAssignSectionHtml`, канбан |
| Карточка заявки (цены, блоки) | `web-preview/admin.js` | `openDetail` (~4500+), `ADMIN_LOGIST_CLIENT_MARKUP`, `adminOrderLogistPricePair` |
| Публичная форма | `web-preview/order-public.js`, `order.html` | `validate`, submit, `initCloudSync` |
| Кабинет заказчика | `web-preview/customer.js` | заявки, черновики, чат |
| Водитель | `web-preview/driver.js` | смена, выезд, закрытие; создание заказа → `transportDocMode` (`transportDocMode` шаг) |
| Бумага / ЭТрН в заказе | `web-preview/app.js` | `orderTransportDocMode`, `orderTransportDocUsesEtrn` |
| Печать: заявка, ТН бланк, договор‑заявка, акт | `web-preview/order-documents.js` | `buildOrderDocBody`, `printOrderDoc` (`paperTn`), `orderPaymentDocLinesForAudience` (`customer` / `carrier`), `orderDocCustomerAmount`, `orderDocCarrierAmount` |
| Км по дороге (авто) | `web-preview/store.js`, `web-preview/app.js` | `estimateRouteGeometry`, `refreshCreateRouteKm`; в карточке — поле `#d-route-km` (ручное / позже авто) |
| Шаблоны документов | `web-preview/doc-templates.js` | `buildOrderDocFromTemplate`, `{{order.*}}` |
| ЭТрН | `web-preview/etrn.js` | По закону T1–T4; выезд со стоянки без T1; T1+T2 до выезда с грузом; `orderEtrnReadyForLeaveLoading` |
| Service Worker | `web-preview/sw.js` | кэш, `swResponseOrError` |
| Стили | `web-preview/styles.css` | по классам из grep |
| API на VPS | `armada-api/server.mjs` | health, state, marketing |
| QA: тест-учётки Армада (ТЕСТ) | `scripts/qa-armada-test-seed-console.js` | `armadaQaSeedTestAccounts()` в консоли /a |
| Деплой staging/prod | `scripts/deploy-staging-fvds.sh`, `scripts/deploy-fvds.sh` | `scripts/STAGING.md` |
| **Git: одна ветка** | `scripts/GIT_ONE_BRANCH.md`, `scripts/SYNC_FROM_GITHUB.md` | ветка **`cursor/dev-f6d2`** |
| Правила агента | `AGENTS.md`, `.cursor/rules/*.mdc` | `00-core.mdc`, `entry-routing.mdc`, … |
| **Карта навигации** | `AGENT_NAVIGATION.md` | §3 таблица, §6 правило дополнения |

---

## 4. Жизненный цикл заявки (E2E)

| Шаг | Где в коде | Журнал |
|-----|------------|--------|
| Создание | `order-public.js`, `store.js` | `ORDER_LIFECYCLE_QA_RUN.md` |
| Входящие / канбан | `app.js` (inbox), `admin.js` (UI) | `ORDER_LIFECYCLE_QA_AGENT.md` (техника) |
| Карточка, цены | `admin.js` `openDetail` | RUN шаг 2 |
| Назначение | `admin.js`, `store.js` `persistOrderAssignmentImmediate` | план QA шаг 3 |
| Документы на бланке | `order-documents.js` | `DOCUMENTS_PLAN.md` |
| Рейс / закрытие | `driver.js`, `app.js` `looksClosedOrder` | QA шаг 5–6 |

Изоляция после **ЗАМОК:** `ORDER_LIFECYCLE_QA_ISOLATION.md`.

---

## 5. Планы (`web-preview/plans/`)

| Файл | О чём |
|------|--------|
| `ADMIN_PLAN.md` | `/a`, парк, заказы, биржа |
| `CUSTOMER_PLAN.md` | `/z`, портал |
| `DRIVER_PLAN.md` | `/v` |
| `DOCUMENTS_PLAN.md` | документооборот |
| `ORDER_LIFECYCLE_QA_PLAN.md` | приёмка E2E |
| `ORDER_LIFECYCLE_QA_RUN.md` | журнал прогона (для людей) |
| `ORDER_LIFECYCLE_QA_AGENT.md` | техника QA (для агента) |
| `ORDER_LIFECYCLE_QA_ISOLATION.md` | ЗАМОК, какие файлы не трогать |
| `KONTUR_EPD_PLAN.md` | ЭПД / оператор |
| `VEHICLE_TYPES_PLAN.md` | типы ТС, ATI |
| `ARMADA_SX_ORDER_LINKS.md` | order.html, источники |
| `LOGIST_CABINET_PLAN.md` | настройки кабинета |
| `EXCHANGE_PLAN.md` | биржа |
| `PLATFORM_PLAN.md` | платформа общее |

Остальные — маркетинг, лендинги; **не открывать** без задачи.

---

## 6. Новый код — что дописать сюда

При **новом файле** или **новой «входной» функции**:

```markdown
| Краткая тема | `path/file.js` | `functionName` или `#id` |
```

При **новом plan-документе** — строка в §5.

---

## 7. Чего здесь нет (намеренно)

- Построчного содержимого `store.js` / `admin.js` (только grep).
- Архивов `docs/HANDOFF*`, `TASK_*.done.md`.
- Полного списка HTML-лендингов — искать `web-preview/*.html` по имени.
