# AGENTS.md — АРМАДА

Читать первым. Бюджет токенов: **grep → кусок**, не целые модули.

## Ядро

**`.cursor/rules/00-core.mdc`** — не ломать, две проверки, стоп после задачи, staging/прод, токены.

Задачи от Евгения: **`КАК_ПИСАТЬ_ЗАДАЧИ.md`** (он не программист).

## Прод и staging

- Live: https://app.armada.sx/ · staging: https://staging.app.armada.sx/
- **Новые правки (UI/скрипты): всегда сначала только staging** — `./scripts/deploy-staging-fvds.sh` (или ветка). **Prod не трогать.**
- **Prod** — `./scripts/deploy-fvds.sh` **только после проверки Евгением на staging** и явных слов: «деплоим на прод», «ок на prod», «выложи на прод» (не путать с «пуш» в git).
- Push в git — отдельно, только по просьбе «пуш» / «коммить».
- Staging: `scripts/STAGING.md`. Пароль VPS в окружении агента: секрет **`root`** (или `FVDS_SSH_PASSWORD`) — **не спрашивать**, staging деплоить сразу после правок.

## Правила по теме (не always — подключаются при работе с файлами)

| Файл | Когда |
|------|--------|
| `investigate-before-fix.mdc` | данные, справочники, sync |
| `entry-routing.mdc` | boot, `/`, `/a` `/v` `/z` |
| `customer-chat-mobile.mdc` | чат заказчика |
| `mobile-performance.mdc` | UI в `web-preview/` |
| `00-never-break.mdc` / `do-not-break-verify.mdc` | детальный чеклист |

## Прогон QA (жизненный цикл заявки)

- Изоляция шагов: `ORDER_LIFECYCLE_QA_ISOLATION.md` — после **ДА**: **на шаге N установлен ЗАМОК** (список **ЗАМКИ** в `ORDER_LIFECYCLE_QA_RUN.md`); правки только для следующих шагов.
- Журнал: `ORDER_LIFECYCLE_QA_RUN.md` · техника для агента: `ORDER_LIFECYCLE_QA_AGENT.md`.

## Тесты и удаления данных

- База **общая** (Армада, Нечаев, МБН). **E2E, QA, массовое удаление заказов** — **только кабинет ООО «Армада»** (`spaceId` фирмы «Армада», `findArmadaLogistCompany()`).
- **Не удалять** и не «чистить» заказы **ИП Нечаев**, **МБН** и других space без **отдельного явного** указания.
- Скрипты/API: фильтр `order.spaceId === <armada>` (или `ownCompanyId` Армады). Не «все orders в payload».

## Git — одна ветка (локальный + облако)

- **Рабочая ветка:** **`cursor/dev-f6d2`** — все правки только сюда; **не** плодить `cursor/новая-задача-f6d2`.
- **Старт задачи:** `git fetch` → `checkout cursor/dev-f6d2` → `pull`.
- **Конец (если «коммить» / облако):** `commit` → `push origin cursor/dev-f6d2`.
- **`main`** — merge PR после проверки; prod деплой только по «ок на prod».
- Подробно: **`scripts/GIT_ONE_BRANCH.md`**, локальный ПК: **`scripts/SYNC_FROM_GITHUB.md`**.

## Облако

`scripts/CLOUD_AGENT_*.md`. Цикл: **правка → staging → ждём «ок» → prod**.

## Не открывать без запроса

`docs/HANDOFF.archive.md`, `docs/TASK_*.done.md`, стратегический план / O-02 / трекер.

## Модули и навигация

**Карта «тема → файл → символ»:** [`AGENT_NAVIGATION.md`](AGENT_NAVIGATION.md) — **держать актуальной** (Евгений: да). Читать перед обходом репо; после задачи с новым файлом/входом — **одна строка** в карту в той же задаче.

**Ветка:** только **`cursor/dev-f6d2`** (см. § Git выше).  
Ядро UI: `store.js`, `app.js`, `admin.js`, `driver.js`, `customer.js`, `order-public.js`, `order-documents.js`.
