# Push ветки cursor/compliance-p0-4317

Ветка содержит S0–S3 (web-preview + трекер + smoke). Продакшен **совпадает** с `web-preview` (см. `scripts/verify-prod-web-sync.sh`).

## Вариант 1 — GITHUB_TOKEN (рекомендуется)

1. GitHub → Settings → Developer settings → Personal access tokens → fine-grained или classic с `repo`.
2. В Cursor Cloud Environment добавьте секрет `GITHUB_TOKEN`.
3. В репозитории:

```bash
export GITHUB_TOKEN='…'
./scripts/git-push-branch.sh cursor/compliance-p0-4317
```

## Вариант 2 — gh CLI

```bash
gh auth login
git push -u origin cursor/compliance-p0-4317
```

## Вариант 3 — git bundle (без сети с агента)

На машине с клоном, где есть ветка:

```bash
git bundle create armada-compliance-4317.bundle cursor/compliance-p0-4317
```

На вашем ПК:

```bash
git fetch ./armada-compliance-4317.bundle cursor/compliance-p0-4317:cursor/compliance-p0-4317
git push -u origin cursor/compliance-p0-4317
```

## После push

GitHub Actions `strategic-plan-smoke.yml` проверит smoke и sync с aptown1.fvds.ru.
