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

## Облако

Одна строка + `scripts/CLOUD_AGENT_*.md`. Цикл: **правка → staging → ждём «ок» → prod**.

## Не открывать без запроса

`docs/HANDOFF.archive.md`, `docs/TASK_*.done.md`, стратегический план / O-02 / трекер.

## Модули

`web-preview/`: `store.js`, `admin.js`, `app.js`, `driver.js`, `index.html`, `styles.css`.
