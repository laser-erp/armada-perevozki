# Одна рабочая ветка (локальный + облачный агент)

## Ветка

**`cursor/dev-f6d2`** — единственная ветка для текущих правок.

**`main`** — только после вашего «ок на prod» / merge PR; **не** коммитить туда агентам напрямую.

## Cursor Cloud

При запуске агента выберите ветку **`cursor/dev-f6d2`**. При старте окружения `.cursor/dev/start.sh` подтягивает эту ветку, если агент оказался на другой. Подробно: **`scripts/CLOUD_AGENT_GIT.md`**.

## Перед каждой задачей (оба агента)

```bash
git fetch origin
git checkout cursor/dev-f6d2
git pull origin cursor/dev-f6d2
```

## После правок

```bash
git add …
git commit -m "…"
git push origin cursor/dev-f6d2
```

## Запрещено без вашей просьбы

- Создавать новые ветки `cursor/что-то-f6d2` на каждое изменение.
- Checkout на старые feature-ветки (`order-public-sync`, `customer-draft-fix`, …).

## Локальный Windows

Тот же порядок в PowerShell — см. **`SYNC_FROM_GITHUB.md`**.

## PR

Один черновик PR с **`cursor/dev-f6d2` → `main`**; обновляется push в ту же ветку.
