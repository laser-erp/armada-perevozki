# Отчёт для локального агента — staging (2026-09-19)

**Репо:** [laser-erp/armada-perevozki](https://github.com/laser-erp/armada-perevozki)  
**Прод:** https://app.armada.sx/ — **не трогали** в этой серии задач (только Caddy/staging и `/var/www/armada-staging`).  
**Staging:** https://staging.app.armada.sx/ — общий API/данные с продом, оранжевая полоса STAGING.

---

## Что сделано (облачный агент)

| Задача | Результат |
|--------|-----------|
| Включить staging на VPS | `scripts/CLOUD_AGENT_DEPLOY_STAGING.md` — Caddy + `deploy-staging-fvds.sh main` |
| Права после tar (403) | PR **#140** в `main`: `deploy-fvds.sh` → chmod 755 / a+r после распаковки |
| TLS Let's Encrypt | PR ветка `cursor/staging-tls-le-f6d2`: убран `tls internal`, LE на staging |
| UI (ранее на проде) | Канбан по умолчанию, кабинет супера в меню, T2 на карточке — `APP_BUILD=2026-09-19-admin-kanban-ux` |

**Текущий APP_BUILD (prod и staging):** `2026-09-19-admin-kanban-ux`

---

## VPS

| Параметр | Значение |
|----------|----------|
| Host | `176.12.67.35` |
| Prod web | `/var/www/armada` |
| Staging web | `/var/www/armada-staging` |
| DNS | `staging.app.armada.sx` → **A** → `176.12.67.35` |
| TLS staging | **Let's Encrypt** (с 2026-09-19, без `tls internal`) |
| SSH | `FVDS_SSH_PASSWORD` или секрет `root` в Cloud Agent; локально — `.fvds-ssh-password` (gitignore) |

**Проверки:**

```bash
curl -sI https://staging.app.armada.sx/          # ожидается HTTP/2 200, без -k
curl -sI https://app.armada.sx/store.js | head -1 # прод жив
./scripts/deploy-staging-fvds.sh main            # только staging
# ./scripts/deploy-fvds.sh                       # ПРОД — только по явному «ок» Евгения
```

---

## Инструкции агенту (файлы в репо)

1. **Деплой staging (файлы):** `scripts/CLOUD_AGENT_DEPLOY_STAGING.md`  
2. **TLS staging (только Caddy):** `scripts/CLOUD_AGENT_STAGING_TLS.md`  
3. **Справка людям:** `scripts/STAGING.md` (после мержа TLS-PR обновить абзац про `tls internal` — он устарел)

---

## Git / PR

- **#140** — chmod после deploy — **смержен в main**
- **Staging TLS + этот отчёт** — ветка `cursor/staging-tls-le-f6d2` (смержить в `main`, если ещё не смержено)

Локальному агенту: после `git pull origin main` — `chmod +x scripts/*.sh`, при необходимости только `./scripts/deploy-staging-fvds.sh <ветка>`.

---

## Запреты (из AGENTS.md)

- Прод `deploy-fvds.sh` без явной просьбы  
- Push/merge в `main` без просьбы  
- Не крутить strategic verification / sync / deploy «на всякий случай»

---

## Контекст для следующих задач

- Заявки с портала → inbox логиста: правки в `main` (portal space, immediate push, kanban inbox).  
- Проверка UX: staging → затем «ок» → прод.

*Файл создан облачным агентом для передачи в локальный чат.*
