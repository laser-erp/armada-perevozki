# Задание облачному агенту: Let's Encrypt для staging

**От Евгения.** Прочитай этот файл и **выполни по шагам**. Не спрашивай «продолжать?» — сделай и отчитайся фактами.

## Жёстко

- **Только TLS/Caddy для staging.** Прод **не** деплоить (`deploy-fvds.sh` с `/var/www/armada` — **запрещён**).
- **Не** выкладывать файлы в `/var/www/armada-staging` (это отдельное задание `CLOUD_AGENT_DEPLOY_STAGING.md`).
- Пароль VPS: `FVDS_SSH_PASSWORD` или секрет **`root`** в Cloud Agent.

## Условие

Запись **A** `staging.app.armada.sx` → IP VPS (сейчас `176.12.67.35`). Проверка: `dig +short staging.app.armada.sx A`.

## Цель

Убрать **`tls internal`** у `staging.app.armada.sx` в Caddy → обычный HTTPS (Let's Encrypt), как у `app.armada.sx`.

## Шаги (из корня репозитория)

```bash
git fetch origin
git checkout main
git pull origin main

# В scripts/build-caddyfile-fvds.sh у блока staging.app.armada.sx удалить строки tls internal и комментарий про hosts.

chmod +x scripts/*.sh scripts/build-caddyfile-fvds.sh

./scripts/build-caddyfile-fvds.sh
./scripts/deploy-caddy-fvds.sh
```

## Отчёт пользователю (обязательно)

1. SSH на VPS — ок / ошибка.
2. `Caddy reloaded OK` — да / нет.
3. `curl -sI https://staging.app.armada.sx/` **без `-k`** — код ответа и issuer сертификата (или `openssl s_client -connect staging.app.armada.sx:443 -servername staging.app.armada.sx </dev/null 2>/dev/null | openssl x509 -noout -issuer`).
4. Прод **не менялся**: `grep APP_BUILD /var/www/armada/store.js` на сервере = https://app.armada.sx/store.js.
5. Вторая проверка: повтор `curl` или с VPS `curl -sI https://staging.app.armada.sx/store.js`.

Не писать «готово» без пунктов 1–3.
