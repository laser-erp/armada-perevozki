# Push ветки cursor/compliance-p0-4317

Ветка содержит S0–S3 (web-preview + трекер + smoke). Продакшен **совпадает** с `web-preview` (см. `scripts/verify-prod-web-sync.sh`).

## Вариант 1 — GITHUB_TOKEN (рекомендуется)

1. GitHub → Settings → Developer settings → Personal access tokens → fine-grained или classic с `repo`.
2. В Cursor Cloud Environment добавьте секрет `GITHUB_TOKEN`.
3. В репозитории:

```bash
export GITHUB_TOKEN='…'
./scripts/github-auth-and-push.sh cursor/compliance-p0-4317
```

## Вариант 2 — gh CLI

```bash
gh auth login
git push -u origin cursor/compliance-p0-4317
```

## Вариант 3 — git bundle (без токена на агенте)

Bundle на проде (обновляется `scripts/publish-compliance-bundle.sh`):

https://aptown1.fvds.ru/downloads/armada-compliance-4317.bundle

На вашем ПК с клоном `laser-erp/armada-perevozki`:

```bash
curl -fsSLO https://aptown1.fvds.ru/downloads/armada-compliance-4317.bundle
git fetch ./armada-compliance-4317.bundle cursor/compliance-p0-4317:cursor/compliance-p0-4317
git push -u origin cursor/compliance-p0-4317
```

Локально в репо:

```bash
./scripts/create-compliance-bundle.sh
./scripts/publish-compliance-bundle.sh
```

## После push

GitHub Actions `strategic-plan-smoke.yml` проверит smoke и sync с aptown1.fvds.ru.
