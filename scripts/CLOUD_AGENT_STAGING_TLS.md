# Задание облачному агенту: Let's Encrypt для staging

**От Евгения.** Прочитай этот файл и **выполни по шагам**. Не спрашивай «продолжать?» — сделай и отчитайся фактами.

## Жёстко

- **Только TLS/Caddy для staging.** Прод **не** деплоить (`deploy-fvds.sh` с `/var/www/armada` — **запрещён**).
- **Не** выкладывать файлы в `/var/www/armada-staging` (это `CLOUD_AGENT_DEPLOY_STAGING.md`).
- Пароль VPS: `FVDS_SSH_PASSWORD` или секрет **`root`** в Cloud Agent.

## Условие

Запись **A** `staging.app.armada.sx` → `176.12.67.35`.

## Цель

Убрать **`tls internal`** у `staging.app.armada.sx` → HTTPS как у `app.armada.sx` (Let's Encrypt).

## Шаги (из корня репозитория)

```bash
git fetch origin
git checkout main
git pull origin main

chmod +x scripts/*.sh scripts/build-caddyfile-fvds.sh

./scripts/build-caddyfile-fvds.sh
./scripts/deploy-caddy-fvds.sh
```

В `build-caddyfile-fvds.sh` у блока staging **нет** `tls internal`.

Если **403**: `chmod -R a+rX /var/www/armada-staging` (только staging).

При ошибке сертификата: `journalctl -u caddy -n 80 --no-pager`.

## Отчёт (обязательно)

1. SSH на VPS — ок / ошибка.
2. `Caddy reloaded OK` — да / нет.
3. `curl -sI https://staging.app.armada.sx/` **без `-k`** — код; issuer (Let's Encrypt / R3).
4. Прод не менялся: `grep APP_BUILD /var/www/armada/store.js` = https://app.armada.sx/store.js.
5. Вторая проверка: повтор `curl` или с VPS.

Не писать «готово» без пунктов 1–3.
