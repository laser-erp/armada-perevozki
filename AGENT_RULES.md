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

## База знаний (обязательно вести)
- Файл для пользователя и агента: **`KNOWLEDGE_BASE.md`**
- После **каждого** блока работ, если менялось поведение или UI:
  1. Обновить соответствующие разделы `KNOWLEDGE_BASE.md`
  2. Дописать строку в «История обновлений базы знаний»
  3. Поправить дату «Обновлено» в шапке
- Не оставлять в базе знаний устаревшие шаги («как добавить», если кнопки уже нет/есть иначе)
- Пользовательские инструкции и FAQ — в первую очередь сюда, не только в чат

## Обязательный бэкап (дополнительно к GitHub)
1. После каждого блока: push в GitHub **и** zip в `/agent/backups/DriverReport-backup-latest.zip`
2. В бэкап: `/agent/DriverReport/` (включая `KNOWLEDGE_BASE.md`), `HANDOFF.md`, `AGENT_RULES.md`, `PREVIEW_URL.txt`, `GITHUB_URL.txt`
3. Перед рискованными правками — commit/push заранее

## Процесс с пользователем
- Сначала план → ждать «ок» / «ок, делай» → код
- Не оценивать сроки в днях/неделях
- При прощании — push + zip + актуальный `HANDOFF.md` + актуальный `KNOWLEDGE_BASE.md`

## URL
- GitHub: https://github.com/laser-erp/armada-perevozki
- База знаний: `KNOWLEDGE_BASE.md` в корне репо
- Записано также в `/agent/backups/GITHUB_URL.txt`
