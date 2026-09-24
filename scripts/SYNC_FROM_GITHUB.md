# Обновить локальную папку с GitHub

Для **локального Cursor** на вашем компьютере (Windows, PowerShell).

## Обычно — только main

```powershell
cd C:\путь\к\armada-perevozki
git fetch origin
git checkout main
git pull origin main
```

Последний коммит: `git log -1 --oneline` — должен совпадать с GitHub → ветка **main**.

## Если нужны правки формы order / QA (ещё не в main)

```powershell
git fetch origin
git checkout cursor/order-public-sync-f6d2
git pull origin cursor/order-public-sync-f6d2
```

## Не использовать

- **`cursor/customer-draft-fix-f6d2`** — ветки на GitHub **нет** (PR #128 закрыт, fix уже в **main** через PR #131).

## Задача локальному агенту

«`git fetch origin`, перейди на **main**, `git pull origin main`. Для order — ветка **cursor/order-public-sync-f6d2**. Не checkout customer-draft-fix.»

## Карта кода

Корень репо: **`AGENT_NAVIGATION.md`**.
