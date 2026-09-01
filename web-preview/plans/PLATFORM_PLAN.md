# План: платформа (супер-админ)

## Доступ и роли

- ✅ Супер-админ: Активность, Тарифы
- ✅ Супер-админ: **Планы** (`admin-plans.js` → `docs/plans/*.md`)
- ✅ Восстановление PIN супер-админа
- ✅ Space на фирму, лимиты по тарифу
- ⬜ Аудит изменений настроек space

## Биллинг

- ✅ Тарифы, trial, баланс, комиссия биржи
- ✅ Guard API (лимиты водителей / ТС / ЕТрН)
- 📋 План M1–M3: [BILLING_SUBSCRIPTION_PLAN.md](BILLING_SUBSCRIPTION_PLAN.md)
- ⬜ Онлайн-оплата (ЮKassa / счёт)
- ⬜ Автопродление подписки

## API и инфра

- ✅ armada-api на VPS, HTTPS
- ✅ PocketBase sync, ETRN webhook
- ✅ Деплой web-preview через `deploy-fvds.sh`
- 🟡 GitHub push (репо публичный — закрыть)
- ⬜ Staging-контур отдельно от prod

## Юридическое SaaS

- ✅ `legal.html` (оферта, конфиденциальность)
- ✅ Вкладка **«Юридические»** в админке → Документы
- ⬜ 7 PDF от юристов на проде (`legal-pdf/` — файлы часто отсутствуют)

## Наблюдаемость

- ✅ Журнал входов админов, presence онлайн
- ✅ opsLog для ETRN/API
- ⬜ Алерты в Telegram при падении API

## Связанные разделы

- Лендинги и КП по ролям → [LANDING_PLAN.md](LANDING_PLAN.md)
- Документы платформы и перевозчиков → [DOCUMENTS_PLAN.md](DOCUMENTS_PLAN.md)
- Кабинет диспетчера → [ADMIN_PLAN.md](ADMIN_PLAN.md)

Обновлено: 30.08.2026
