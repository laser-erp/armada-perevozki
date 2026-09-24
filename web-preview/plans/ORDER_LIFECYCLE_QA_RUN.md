# Прогон ORDER_LIFECYCLE QA — журнал

**Старт:** 24.09.2026 · **Окружение:** **staging** `https://staging.app.armada.sx` (prod без order-fix до «ок»)  
**База:** чистим/удаляем **только заказы space ООО «Армада»**. Нечаев восстановлен из бэкапа 24.09. Новые тесты — **по одной**, все поля по [ORDER_LIFECYCLE_QA_PLAN.md](ORDER_LIFECYCLE_QA_PLAN.md).  
**План:** [ORDER_LIFECYCLE_QA_PLAN.md](ORDER_LIFECYCLE_QA_PLAN.md)

| Шаг | Статус | Кто проверяет |
|-----|--------|---------------|
| 1 Создание | ✅ PASS (агент, Playwright) | вы — подтвердите во «Входящих» |
| 2 Карточка | — | |
| 3 Назначение | — | |
| 4 ЭТrН | N/A (Старт / Армада) | |
| 5–8 | — | |

**Сборка prod после фикса:** `APP_BUILD=2026-09-24-order-public-sync-v6` · SW `armada-shell-v85`

---

## Баги (найденные по ходу)

| ID | Шаг | Суть | Статус |
|----|-----|------|--------|
| B1 | 1 | `order.html` грузит только `store.js` — не хватало хелперов из `app.js` (`initCloudSync` / lead) | ✅ v5–v6: хелперы + guarded migrations |
| B2 | 1 | После lead использовался `persist()` с задержкой | ✅ `persistCustomerPortalOrderImmediate` |
| B3 | 1 | Service worker: при сбое сети `respondWith` без Response | ✅ `sw.js` |
| B4 | 1 | UX: поле **время** — браузер ругается, если введено не через picker | ℹ️ обход: выбрать время из списка |
| B5 | 1 | `updateDriverNetHint` / `mergeAdminAuthFromRemote` / `mergeLocalShifts` только в app.js — ломали push с формы | ✅ guards в store.js (v5–v6) |

---

## Шаг 1 — Создание заявки

**Агент (Playwright, «чистый» контекст, SW blocked):**

- URL: `https://app.armada.sx/order.html?source=qa-lifecycle`
- Форма: шаланда, компания QA, уникальный телефон, адрес, дата+время.
- **Результат:** экран успеха, текст **«Номер заявки: №11»** (и ранее №10 при повторе телефона).
- `dataEpoch` на клиенте увеличился (`armada-sx-order`, `customer-portal-lead`) — push без ошибки persist.

**Артефакт:** `/opt/cursor/artifacts/order-public-submit-success.webp`

**Что проверить вам (2 браузера):**

1. **Логист** `/a` → **Заказы → канбан → Входящие** — заявки с source `qa-lifecycle` / QA-телефонами (№10–11 или новее).
2. Напишите «есть во входящих №…» + **ДА** — шаг 2.

**Протокол:**

| Поле | Значение |
|------|----------|
| № заявки (агент) | 10, 11 (prod 24.09.2026) |
| Сценарий 1 шаг 1 | ☑ PASS (форма) · ☐ подтверждение логистом |

---

## Примечание про роли

Заполнение формы — в облаке; PIN — в ваших браузерах. После деплоя v6 обновите SW (жёсткое обновление / инкognito), иначе может подтянуться старый `order-public.js`.
