# ARMADA — стратегический план 2026

Ветка работы: `cursor/compliance-p0-4317`

Продакшен: https://aptown1.fvds.ru · API: https://aptown1.fvds.ru/armada-api

Контекст S3: `docs/COMPETITIVE_ANALYSIS_2026.md`

## §4 Статус этапов (трекер)

| Этап | Статус | Примечание |
|------|--------|------------|
| S0 HTTPS + armada-api | ✅ done | LE до 2026-11-22, smoke OK |
| S1 driverInvites | ✅ done | invite.html, KEY в store.js, smoke OK |
| S2 пилот 2–3 space | 🔄 in_progress | kp.html, ждут партнёров |
| S3 ETRN MVP (код 2 спринта) | ✅ done | UI + API + webhook; smoke OK |
| S3-1.2 письма операторам | ⏸ paused | после решения пользователя |
| S3-2.7 5 живых ЭТрН | ⏸ paused | `epd.configured: false` |
| S4–S7 | ⏸ paused | только по явному «Делай» |
| O-02 Push GitHub | ⏸ blocked | `scripts/git-push-branch.sh` + GITHUB_TOKEN |

JSON-трекер: `.cursor/stores/self/strategic-plan-tracker.json`

Проверка продакшена:

```bash
chmod +x scripts/smoke-strategic-plan.sh scripts/verify-prod-web-sync.sh
BASE_URL=https://aptown1.fvds.ru ./scripts/smoke-strategic-plan.sh
BASE_URL=https://aptown1.fvds.ru ./scripts/verify-prod-web-sync.sh
```

Деплой ветки на VPS: `scripts/deploy-fvds.sh` (нужен `FVDS_SSH_PASSWORD`).


## Тарифы в программе (billing.js)

| План | ₽/мес | Биржа | ЭТрН |
|------|-------|-------|------|
| Старт | 2 990 | нет | нет |
| Бизнес | 7 990 | да | да |
| Профи | 14 990 | да | да |
| Биржа Lite | 1 990 | да | нет |

Пилот: 30 дней trial на каждый space. Лендинг kp.html — ориентир для клиентов.

## Сборка на проде

- `APP_BUILD`: `2026-08-24-bootfix5`
- Service Worker: `armada-shell-v25`, network-first для JS/CSS
