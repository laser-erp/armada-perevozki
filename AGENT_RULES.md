# Правила агента — АРМАДА

## Обязательный бэкап
1. **После каждого завершённого блока работ** — сразу zip в `/agent/backups/`.
2. Имя: `DriverReport-backup-YYYYMMDD-HHMM.zip` + копия `DriverReport-backup-latest.zip`.
3. В бэкап класть: весь `/agent/DriverReport/`, `HANDOFF.md`, `PREVIEW_URL.txt`, этот файл `AGENT_RULES.md`.
4. **Перед рискованными правками** (перепись большого файла, смена моделей) — бэкап заранее.
5. При старте сессии: если `/agent/DriverReport` пуст — **сначала** восстановить из `DriverReport-backup-latest.zip`, не собирать по транскрипту.

## Процесс с пользователем
- Сначала план → ждать «ок» / «ок, делай» → код.
- Не оценивать сроки в днях/неделях; говорить объём работ по сути.
- При прощании — бэкап + актуальный `HANDOFF.md`.

## Восстановление
```bash
mkdir -p /agent && unzip -o /agent/backups/DriverReport-backup-latest.zip -d /
# или, если zip с абсолютными путями уже разложился корректно:
unzip -l /agent/backups/DriverReport-backup-latest.zip | head
```
