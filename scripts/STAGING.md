# Staging (проверка перед продом)

**URL:** https://staging.app.armada.sx/

Отдельная копия интерфейса на том же VPS (`/var/www/armada-staging`). **API и данные — общие с продом** (тот же `armada-api`). На экране оранжевая полоса «STAGING» (все `*.html`, включая **order.html** — `patch-staging-banner.sh` при деплое).

## Первый запуск (один раз)

1. **Пароль VPS** (не в чат, не в git): одна строка в файле `.fvds-ssh-password` в корне репо (файл в `.gitignore`).
2. **Caddy:** `./scripts/build-caddyfile-fvds.sh` → `./scripts/deploy-caddy-fvds.sh`
3. **Файлы:** `./scripts/deploy-staging-fvds.sh main`

### TLS

DNS **A** `staging.app.armada.sx` → `176.12.67.35`. Caddy выдаёт **Let's Encrypt** (см. `scripts/CLOUD_AGENT_STAGING_TLS.md`).  
Строка в `hosts` на ПК **не нужна**, если DNS резолвится.

## Если с ПК SSH таймаут (WinError 10060)

1. Проверка: `powershell -File scripts/check-vps-access.ps1`
2. **GitHub Actions:** репо → **Actions** → **Deploy staging (VPS)** → Run workflow (нужен секрет `FVDS_SSH_PASSWORD` в Settings → Secrets).

## Обычный цикл (обязательный для агента)

| Шаг | Команда |
|-----|---------|
| 1. После правок в коде | **Только staging** — `./scripts/deploy-staging-fvds.sh` или `./scripts/deploy-staging-fvds.sh имя-ветки` |
| 2. Евгений проверяет | https://staging.app.armada.sx/ (оранжевая полоса) |
| 3. На прод | **Только** когда сказал «деплоим на прод» / «ок на prod» → `./scripts/deploy-fvds.sh` |
| Сравнить файлы с staging | `./scripts/verify-staging-sync.sh` |

**Запрет:** `deploy-fvds.sh` без явного разрешения после проверки на staging.

## Облачный агент

Правило: **новые правки → staging всегда; prod и merge в `main` на live** — только после проверки на staging и явного «ок» от Евгения.
