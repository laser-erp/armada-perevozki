# HANDOFF — контекст для агента (читать при слове «АРМАДА»)

> Обновляй секцию **СТАТУС** после каждой завершённой задачи (ветка, сборка, что сделано, что дальше).

## СТАТУС (2026-08-13)

| | |
|---|---|
| **Live** | http://aptown1.fvds.ru/ |
| **Репо** | https://github.com/laser-erp/armada-perevozki |
| **Активная ветка** | `cursor/security-phase0-api-4317` (безопасность + API) |
| **Сборка** | `2026-08-13-security-phase0` (`web-preview/store.js` → `APP_BUILD`) |
| **Код приложения** | `DriverReport/web-preview/` |
| **Деплой** | `scripts/deploy-fvds.sh` |
| **Бэкапы** | `docs/BACKUP.md` · cron 03:15 · `/var/backups/armada/` |

### Недавно сделано
- **Автобэкапы:** `scripts/backup-armada.sh`, cron, JSON + SQLite + tar pb_data.
- Фаза 0 безопасности: PocketBase закрыт (403 на `/api`, `/_`), клиент через `/armada-api` + JWT.
- Сервис `armada-api` (`armada-api/server.mjs`), systemd `armada-api.service`, env `/etc/armada/api.env`.
- Объединены дубликаты ИП Нечаева в одну карточку.
- Договоры ТЭУ, баннер, печать через иконку в предпросмотре.
- Биржа: перевозчик не видит клиента администратора.

### Следующие задачи (приоритет)
1. **Безопасность фаза 1:** фильтрация `state` по `spaceId` на сервере (`armada-api/server.mjs`).
2. PIN-hash (не хранить в payload), ключи DaData/ФНС только на сервере.
3. HTTPS (когда LE для fvds.ru доступен — `scripts/caddyfile.armada`).
4. Пользователям: сменить PIN после открытой базы.

Подробности: `docs/SECURITY.md`.

---

## Карта кода (web-preview)

| Файл | Зона |
|------|------|
| `store.js` | state, persist, API/JWT, PocketBase-прокси, миграции spaces/fleet |
| `app.js` | заказы, смены, тарифы, договоры ТЭУ, миграции companies |
| `admin.js` | админ UI, каталоги, биржа, карточки заказов/компаний |
| `driver.js` | водитель, смена, ЕТО, заказы |
| `index.html` | оболочка, cache-bust `?v=APP_BUILD` |
| `styles.css` | стили |

Сервер API: `armada-api/server.mjs`  
Caddy: `scripts/caddyfile.armada`  
PocketBase на VPS: `127.0.0.1:8090`, только с сервера.

## API (скелет)

- `GET /armada-api/bootstrap` — админы без PIN (публично).
- `POST /armada-api/auth/admin` · `POST /armada-api/auth/driver` → JWT.
- `GET/PUT /armada-api/state` — только с `Authorization: Bearer …`.
- Проверка: `curl http://aptown1.fvds.ru/armada-api/health`

## Деплой на VPS

```bash
cd DriverReport   # корень с scripts/
FVDS_SSH_PASSWORD='…' FVDS_PB_PASSWORD='…' bash scripts/deploy-fvds.sh
```

Пароли — локально у владельца (не в git): `backups/VPS_ACCESS.txt`, `backups/ARMADA_SITES_AND_PASSWORDS.txt`.

**Бэкап:** `bash scripts/install-backup-cron.sh` (первый раз) · `docs/BACKUP.md`

После правок JS: поднять `APP_BUILD` в `store.js` + `?v=` в `index.html`, commit, push, deploy.

## Ветки агента

Шаблон: `cursor/<описание>-4317`. Суффикс `-4317` обязателен для cloud agent.

## Доменные сущности

- **space** — пространство админа; **own company** — «наша фирма» (`roles: own`).
- Супер-админ: Наволоцкий. Фирмы: ООО «Армада», ИП Нечаев А.С.
- Заказ: `ownCompanyId`, `spaceId`, биржа `onExchange`, перевозчик `carrierCompanyId`.
- Договор ТЭУ: `transportContracts` в state.

## Что делать при слове «АРМАДА»

1. Прочитать этот файл и `docs/SECURITY.md`.
2. `git branch --show-current` · `git log -5 --oneline` · `grep APP_BUILD web-preview/store.js`.
3. При необходимости live: health/bootstrap, 403 на `/api/`.
4. Продолжить с **Следующие задачи** или последний запрос пользователя в чате.
5. После работы — обновить **СТАТУС** в этом файле и закоммитить.
