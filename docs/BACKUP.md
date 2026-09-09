# Бэкапы АРМАДА

## Что сохраняется

Каждый запуск создаёт каталог `/var/backups/armada/YYYY-MM-DD_HHMMSS/`:

| Файл | Содержимое |
|------|------------|
| `app_state_api.json` | дамп коллекции `app_state` (заказы, компании, …) |
| `data.db` | SQLite backup основной БД (если есть `sqlite3`) |
| `auxiliary.db` | SQLite backup вспомогательной БД |
| `pb_data.tar.gz` | полный каталог PocketBase |
| `web-preview.tar.gz` | статика `/var/www/armada` |
| `manifest.txt` | метка времени |

Ссылка **`/var/backups/armada/latest`** → последний бэкап.

Ротация: **14 дней** (`ARMADA_BACKUP_KEEP_DAYS`).

## Расписание

Cron на VPS: **03:15** каждый день.  
Лог: `/var/log/armada-backup.log`

## Установка / обновление

```bash
cd DriverReport
FVDS_SSH_PASSWORD='…' bash scripts/install-backup-cron.sh
```

Или вместе с деплоем — `deploy-fvds.sh` копирует скрипт на сервер.

## Ручной бэкап на сервере

```bash
ssh root@176.12.67.35
/opt/armada/scripts/backup-armada.sh
ls -la /var/backups/armada/latest/
```

## Восстановление (осторожно)

### Из JSON (логический)

1. Остановить записи с клиента.
2. Через PocketBase admin (SSH tunnel) или API загрузить payload из `app_state_api.json` в записи `key=main`.

### Из pb_data (полный)

```bash
systemctl stop pocketbase armada-api
cd /opt/pocketbase
mv pb_data pb_data.bak
tar xzf /var/backups/armada/latest/pb_data.tar.gz
systemctl start pocketbase armada-api
```

Проверить сайт. Если ок — удалить `pb_data.bak` позже.

### Из SQLite

```bash
systemctl stop pocketbase
cp /var/backups/armada/latest/data.db /opt/pocketbase/pb_data/data.db
systemctl start pocketbase
```

## Скачать бэкап на свой ПК

```bash
scp -r root@176.12.67.35:/var/backups/armada/latest ./armada-backup-local
```

## Переменные окружения (опционально)

| Var | Default |
|-----|---------|
| `ARMADA_BACKUP_DIR` | `/var/backups/armada` |
| `ARMADA_BACKUP_KEEP_DAYS` | `14` |
| `ARMADA_PB_ROOT` | `/opt/pocketbase` |
| `ARMADA_WEB_ROOT` | `/var/www/armada` |

JSON-экспорт использует `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` из `/etc/armada/api.env`.
