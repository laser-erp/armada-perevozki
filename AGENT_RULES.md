# Правила агента — АРМАДА

## Источник правды (главное)
- **Брать код:** `https://github.com/laser-erp/armada-perevozki` (ветка `main`)
- **Сохранять код:** туда же — `git add && git commit && git push origin main` после каждого блока работ
- Аккаунт GitHub CLI в среде: `laser-erp`

При старте сессии, если `/agent/DriverReport` пуст или устарел:
```bash
gh auth status || true
git clone https://github.com/laser-erp/armada-perevozki.git /agent/DriverReport
# или: cd /agent/DriverReport && git pull origin main
```

## Обязательный бэкап (дополнительно к GitHub)
1. После каждого блока: push в GitHub **и** zip в `/agent/backups/DriverReport-backup-latest.zip`
2. В бэкап: `/agent/DriverReport/`, `HANDOFF.md`, `AGENT_RULES.md`, `PREVIEW_URL.txt`, `GITHUB_URL.txt`
3. Перед рискованными правками — commit/push заранее

## Процесс с пользователем
- Сначала план → ждать «ок» / «ок, делай» → код
- Не оценивать сроки в днях/неделях
- При прощании — push + zip + актуальный `HANDOFF.md`

## URL
- GitHub: https://github.com/laser-erp/armada-perevozki
- Записано также в `/agent/backups/GITHUB_URL.txt`
