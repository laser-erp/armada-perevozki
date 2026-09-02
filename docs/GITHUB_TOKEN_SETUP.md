# GitHub token для Cloud Agent (один раз, ~3 минуты)

После этого агент сам делает **push** и **создаёт PR** без ручных шагов.

## Шаг 1. Создать токен на GitHub

1. Откройте: https://github.com/settings/tokens?type=beta  
   (или Classic: https://github.com/settings/tokens → **Generate new token (classic)**)

2. **Fine-grained (рекомендуется):**
   - Token name: `cursor-armada-agent`
   - Expiration: 90 days (или по вашей политике)
   - Resource owner: организация **laser-erp** (или ваш user, если репо под ним)
   - Repository access: **Only select repositories** → `armada-perevozki`
   - Permissions:
     - **Contents** → Read and write
     - **Pull requests** → Read and write
   - **Generate token** → скопируйте `github_pat_…` (показывается один раз)

3. **Classic (проще, но шире права):**
   - Note: `cursor-armada-agent`
   - Scope: только **`repo`**
   - Generate → скопируйте `ghp_…`

## Шаг 2. Добавить в Cursor Environment

1. Cursor → **Dashboard** → **Cloud Agents** → **Environments**
2. Откройте environment для репозитория `armada-perevozki`
3. **Secrets** → Add secret:
   - Name: **`GITHUB_TOKEN`**
   - Value: вставьте скопированный токен
4. Save. **Новый** Cloud Agent подхватит секрет автоматически.

## Шаг 3. Проверка (в агенте)

```bash
./scripts/github-push-and-pr.sh cursor/my-branch "My PR title"
```

Или отдельно:

```bash
./scripts/github-push-branch.sh cursor/my-branch
./scripts/github-create-pr.sh cursor/my-branch main "Title"
```

## Что уже работает без токена

- **Deploy key** (`GITHUB_DEPLOY_KEY`) — только **git push** (у вас уже настроен)
- **PR через API** — нужен именно **GITHUB_TOKEN**

## Безопасность

- Не коммитьте токен в git
- Не вставляйте в чат — только в Secrets Cursor
- Отозвать: GitHub → Settings → Developer settings → удалить токен
