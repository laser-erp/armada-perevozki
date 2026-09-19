# Staging (проверка перед продом)

**URL:** https://staging.app.armada.sx/

Отдельная копия интерфейса на том же VPS (`/var/www/armada-staging`). **API и данные — общие с продом** (тот же `armada-api`). На экране оранжевая полоса «STAGING».

## Первый запуск (один раз)

1. **Пароль VPS** (не в чат, не в git): одна строка в файле `.fvds-ssh-password` в корне репо (файл в `.gitignore`).
2. **Caddy:** `./scripts/build-caddyfile-fvds.sh` → `./scripts/deploy-caddy-fvds.sh`
3. **Файлы:** `./scripts/deploy-staging-fvds.sh main`

### TLS

DNS **A** `staging.app.armada.sx` → VPS. Caddy выдаёт **Let's Encrypt** (см. `scripts/CLOUD_AGENT_STAGING_TLS.md`).  
Строка в `hosts` на ПК **не нужна**, если DNS резолвится.

## Если с ПК SSH таймаут (WinError 10060)

1. Проверка: `powershell -File scripts/check-vps-access.ps1`
2. **GitHub Actions:** репо → **Actions** → **Deploy staging (VPS)** → Run workflow (нужен секрет `FVDS_SSH_PASSWORD` в Settings → Secrets).

## Обычный цикл

| Шаг | Команда |
|-----|---------|
| Выложить ветку на staging | `./scripts/deploy-staging-fvds.sh имя-ветки` |
| Выложить то, что в папке сейчас | `./scripts/deploy-staging-fvds.sh` |
| Сравнить файлы с staging | `./scripts/verify-staging-sync.sh` |
| На прод (только после «ок») | `./scripts/deploy-fvds.sh` |

## Облачный агент

Правило: **merge в `main` и прод** — только после проверки на staging и явного «ок» от Евгения.
