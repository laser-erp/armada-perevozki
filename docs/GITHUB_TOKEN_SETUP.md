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

## Шаг 2. Добавить в Cursor (Secrets — не на странице Environment)

**Важно:** вкладки «Secrets» на странице environment часто **нет**. Секреты — на главном дашборде Cloud Agents.

### Вариант A (рекомендуется)

1. Откройте: https://cursor.com/dashboard/cloud-agents
2. Вверху найдите вкладку **Secrets** (рядом с Agents / Environments / Builds)
3. **Add secret**:
   - Name: **`GITHUB_TOKEN`**
   - Type: **Runtime Secret** (токен не попадёт в чат агента)
   - Apply to / Repository: **`laser-erp/armada-perevozki`** (если есть выбор)
   - Value: вставьте `ghp_…` или `github_pat_…`
4. Save
5. **Запустите новый Cloud Agent** (текущий уже запущенный секрет не подхватит)

### Вариант B (через environment)

1. https://cursor.com/dashboard/cloud-agents → **Environments**
2. Откройте environment → блок **Runtime secrets** (не «Build secrets»)
3. Add → Name **`GITHUB_TOKEN`**, Value — токен → Save
4. Новый агент после сохранения

### Если вкладки Secrets нет

- Откройте тот же URL в **десктопном Cursor**: Settings → **Cloud Agents** → **Secrets**
- Убедитесь, что вы в **том же аккаунте**, под которым запущен агент
- Для team workspace иногда нужны права admin — тогда попросите админа добавить секрет

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
