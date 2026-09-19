# Задание облачному агенту: staging на VPS (DNS готово)

**От Евгения.** Прочитай этот файл и **выполни по шагам**. Не спрашивай «продолжать?» — сделай и отчитайся фактами.

## Жёстко

- **Только staging.** Прод **не** деплоить (`deploy-fvds.sh`, каталог `/var/www/armada` — **запрещён**).
- **Не** мержить PR и **не** пушить в `main` без отдельной просьбы Евгения.
- Пароль VPS: переменная **`FVDS_SSH_PASSWORD`** или секрет **`root`** в Cloud Agent (как на прошлых деплоях).

## Контекст

- **DNS:** A `staging.app.armada.sx` → `176.12.67.35` (тот же IP, что `app.armada.sx`).
- В Caddy для staging **нет** `tls internal` — нужен **Let's Encrypt** через обычный блок `staging.app.armada.sx { import armada_staging }` в `scripts/build-caddyfile-fvds.sh`.
- Если в `main` ещё есть `tls internal` у staging — убери, пересобери `caddyfile.fvds.prod`, закоммить на русском **только если Евгений просил пуш**; иначе деплой с текущей ветки после правки локально на runner.

## Цель

1. Caddy отдаёт **https://staging.app.armada.sx** из `/var/www/armada-staging` с **валидным HTTPS** (не self-signed).
2. В `/var/www/armada-staging` — свежий `web-preview` с **ветки `main`** + оранжевая полоса STAGING.

Подробности: `scripts/STAGING.md`.

## Шаги (из корня репозитория)

```bash
git fetch origin
git checkout main
git pull origin main

chmod +x scripts/*.sh scripts/build-caddyfile-fvds.sh

./scripts/build-caddyfile-fvds.sh
./scripts/deploy-caddy-fvds.sh
./scripts/deploy-staging-fvds.sh main
```

Если `deploy-caddy-fvds.sh` падает на Python — установи `paramiko` и повтори.

## Отчёт пользователю (обязательно)

1. SSH на `176.12.67.35` — ок / ошибка (текст).
2. `Caddy reloaded OK` — да / нет.
3. `curl -sI https://staging.app.armada.sx/` — код ответа; сертификат не self-signed (issuer Let's Encrypt или аналог).
4. `grep APP_BUILD /var/www/armada-staging/store.js` на сервере — **точная строка**.
5. Прод **не трогали:** `grep APP_BUILD /var/www/armada/store.js` совпадает с https://app.armada.sx/store.js?v=… (или тот же build, что до задачи).
6. Вторая проверка: повтор `curl` или `caddy validate` на сервере.

Не писать «готово» без пунктов 1–4.

## Если SSH не работает

- Прод не трогать.
- Сообщить Евгению: добавить секрет **`FVDS_SSH_PASSWORD`** в GitHub → Actions → **Deploy staging (VPS)** → Run workflow (ветка `main`).
