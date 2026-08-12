# AGENTS.md — АРМАДА (фаза 0–2)

Бюджет ограничен (~$10). Цель: **не читать 100k+ tok** на одну задачу.

## Источник кода
- Репо: `https://github.com/laser-erp/armada-perevozki` · ветка **`main`**
- Live: http://aptown1.fvds.ru/ → `/var/www/armada/`
- Workspace = **только это репо**

```bash
cd /agent/DriverReport && git fetch origin && git checkout main && git pull origin main
```

## Веб-модули (фаза 2)
| Файл | Что внутри |
|------|------------|
| `web-preview/index.html` | оболочка HTML (~20 KB), без логики |
| `web-preview/styles.css` | стили |
| `web-preview/store.js` | state / persist / PocketBase |
| `web-preview/driver.js` | водитель: сессия, ЕТО, заявки, история |
| `web-preview/admin.js` | админ: заявки, календарь, каталоги |
| `web-preview/app.js` | общие хелперы + boot |

**Не читать файлы целиком.** Grep → символ → Read offset/limit. В TASK указывать модуль + функцию.

## Процесс
1. План → «ок» → код. Одна задача. Без «заодно».
2. Та же тема → тот же чат. Новый чат — только смена темы.
3. Ответы коротко. В конце среза — оценка tok.

## Запреты
- Подагенты, explore «по всему репо», best-of-N
- Читать целиком любой `*.js` / старый монолит
- iOS без запроса; длинные саммари KB/HANDOFF

## Модель
Быстрая по умолчанию. Thinking — только жёсткий баг по просьбе.

## TASK
Шаблон: `TASK_TEMPLATE.md`. Новый чат: `START_NEW_CHAT.txt` только при смене темы.
