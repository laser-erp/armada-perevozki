# Staging (проверка перед продом)

**URL:** https://staging.app.armada.sx/

Отдельная копия интерфейса на том же VPS (`/var/www/armada-staging`). **API и данные — общие с продом** (тот же `armada-api`). На экране оранжевая полоса «STAGING».

## Первый запуск (один раз)

1. **Пароль VPS** (не в чат, не в git): одна строка в файле `.fvds-ssh-password` в корне репо (файл в `.gitignore`).
2. **Caddy:** `./scripts/build-caddyfile-fvds.sh` → `./scripts/deploy-caddy-fvds.sh`
3. **Файлы:** `./scripts/deploy-staging-fvds.sh main`

### Без DNS (пока)

Caddy для staging использует **`tls internal`** (самоподписанный сертификат).

На **своём ПК** в `C:\Windows\System32\drivers\etc\hosts` (от администратора):

```
176.12.67.35 staging.app.armada.sx
```

Открыть https://staging.app.armada.sx/ — браузер предупредит о сертификате, для проверки это нормально.

Когда будет готова запись **A** в DNS — убрать `tls internal` из `build-caddyfile-fvds.sh` (или попросить агента), снова `deploy-caddy-fvds.sh`, строку из `hosts` можно удалить.

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
