# AGENTS.md — АРМАДА

## Одно слово → полный контекст

Напишите в чате агента: **АРМАДА** (или **продолжи**).

Агент сам прочитает `docs/HANDOFF.md`, `docs/SECURITY.md`, проверит git и продолжит с актуальной задачи.

---

Бюджет ~$10. Не читать 100k+ tok / целые модули.

## Код
- Репо `laser-erp/armada-perevozki` · live http://aptown1.fvds.ru/
- Модули: `web-preview/` → `styles.css` · `store.js` · `driver.js` · `admin.js` · `app.js` · `index.html`
- API: `armada-api/server.mjs` · Caddy: `scripts/caddyfile.armada`
- Grep → символ → Read **кусок**. В TASK: файл + функция + строки.

## Процесс
1. План → код. **Одна** задача. Без «заодно».
2. Та же тема → **этот чат**. Новый чат — слово **АРМАДА** или `TASK_TEMPLATE.md`.
3. Короткий ответ. После среза — обновить `docs/HANDOFF.md` (секция СТАТУС).

## Запреты
Подагенты без нужды · explore всего репо · best-of-N · iOS без запроса · пароли в git

## Доки (по триггеру «АРМАДА»)
| Файл | Когда |
|------|--------|
| `docs/HANDOFF.md` | **всегда первым** — статус, ветка, задачи |
| `docs/SECURITY.md` | безопасность, API, деплой |
| `docs/HANDOFF.archive.md` | только по явному запросу |

## Cloud agent
- Ветки: `cursor/<name>-4317`
- Деплой: `scripts/deploy-fvds.sh` (пароли через env, не в репо)
