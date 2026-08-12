# Правила агента — АРМАДА

> **Агенту сначала:** `AGENTS.md`. Этот файл — дополнение.

## Источник правды (фаза 1)
- Репо: `https://github.com/laser-erp/armada-perevozki`
- **Код и доки: ветка `main`**
- Live: http://aptown1.fvds.ru/ → `/var/www/armada/` (деплой с `main`)
- GitHub CLI: `laser-erp`

```bash
gh auth status || true
cd /agent/DriverReport && git fetch origin && git checkout main && git pull origin main
```

Новые фичи: `git checkout -b cursor/<имя>-4317` от `main` → PR **в `main`**.

## Фаза 0 (стоп-кран)
См. `AGENTS.md`: тот же чат на мелочи; не читать весь `index.html`; без подагентов; план → «ок» → код; ~$10.

## База знаний
- Для пользователя: `KNOWLEDGE_BASE.md`
- Агент не обновляет KB на каждый микрофикс — только по просьбе или крупный сценарий

## Бэкап
После блока: push + при необходимости zip `/agent/backups/DriverReport-backup-latest.zip`

## Задания
- `TASK_TEMPLATE.md` · `START_NEW_CHAT.txt` (новая тема)

## URL
- GitHub: https://github.com/laser-erp/armada-perevozki
- Live: http://aptown1.fvds.ru/
