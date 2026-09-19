# Задание облачному агенту: включить staging на VPS

**От Евгения.** Прочитай этот файл и **выполни по шагам**. Не спрашивай «продолжать?» — сделай и отчитайся фактами.

## Жёстко

- **Только staging.** Прод **не** деплоить (`deploy-fvds.sh` с `/var/www/armada` — **запрещён**).
- **Не** мержить PR и **не** пушить в `main` без отдельной просьбы.
- Пароль VPS: `FVDS_SSH_PASSWORD` или секрет **`root`** в Cloud Agent (как для прошлых деплоев на прод).

## Цель

1. Caddy отдаёт **https://staging.app.armada.sx** из `/var/www/armada-staging`.
2. В каталоге лежит свежий `web-preview` с **ветки `main`** + оранжевая полоса STAGING.

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

Если `deploy-caddy-fvds.sh` падает на Python — установи `paramiko` или `sshpass` и повтори.

## DNS

Запись **A** для `staging.app.armada.sx` может **ещё не быть**. Caddy настроен с **`tls internal`** — для проверки без DNS пользователь добавит в `hosts` на ПК:

`176.12.67.35 staging.app.armada.sx`

Это не блокер для деплоя на сервер.

## Отчёт пользователю (обязательно)

Напиши по пунктам:

1. SSH на `176.12.67.35` — ок / ошибка (текст).
2. `Caddy reloaded OK` — да / нет.
3. `grep APP_BUILD /var/www/armada-staging/store.js` на сервере — **точная строка**.
4. Прод `/var/www/armada/store.js` **не менялся** (тот же APP_BUILD, что до задачи, или сравнение с https://app.armada.sx/store.js).
5. Что проверено вторым способом (повтор SSH, `curl -kI https://staging.app.armada.sx/` с сервера или с runner).

Не писать «готово» без пунктов 1–3.

## Если SSH не работает

- Не трогать прод.
- Предложить пользователю: GitHub Actions **Deploy staging (VPS)** после добавления секрета `FVDS_SSH_PASSWORD` в репозиторий.
