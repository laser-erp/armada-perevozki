# Облачный агент: одна ветка с локальным Cursor

**Единственная рабочая ветка:** **`cursor/dev-f6d2`**.

## При старте задания в Cloud

1. В настройках агента / выборе ветки укажите **`cursor/dev-f6d2`** (не создавайте новую `cursor/задача-f6d2`).
2. В начале работы:

```bash
git fetch origin
git checkout cursor/dev-f6d2
git pull origin cursor/dev-f6d2
```

3. После правок (если нужен push): `git push origin cursor/dev-f6d2`.

## PR

Один общий черновик **`cursor/dev-f6d2` → `main`** (обновляется push в ту же ветку). **Не** открывать отдельный PR на каждую мелкую задачу.

## Запрещено без просьбы Евгения

- `git checkout -b cursor/…-f6d2`
- Пуш в `main` напрямую
- Работа на старых feature-ветках

Локальный ПК: **`scripts/SYNC_FROM_GITHUB.md`**. Общие правила: **`scripts/GIT_ONE_BRANCH.md`**, **`AGENTS.md`**.
