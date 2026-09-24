# Обновить локальную папку с GitHub

Windows · PowerShell · **локальный Cursor**.

## Всегда одна рабочая ветка

**`cursor/dev-f6d2`** — здесь и облачный, и локальный агент. Новую ветку на каждую правку **не** создаём.

```powershell
cd C:\путь\к\armada-perevozki
git fetch origin
git checkout cursor/dev-f6d2
git pull origin cursor/dev-f6d2
```

Проверка: `git branch --show-current` → `cursor/dev-f6d2`.

## main

Только стабильное / уже принятое. Обновить main:

```powershell
git fetch origin
git checkout main
git pull origin main
```

Перед работой снова переключитесь на **`cursor/dev-f6d2`**.

## Не использовать

- **`cursor/customer-draft-fix-f6d2`** — удалена; fix в **main** (PR #131).
- Старые **`cursor/*-f6d2`** feature-ветки — только если вы сами попросите.

## Задача локальному агенту

«`git fetch`, **`git checkout cursor/dev-f6d2`**, **`git pull`**, правки, **`git push origin cursor/dev-f6d2`**. Не создавать новую ветку. См. `scripts/GIT_ONE_BRANCH.md`.»

## Карта кода

**`AGENT_NAVIGATION.md`**
