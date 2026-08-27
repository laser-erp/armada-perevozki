# ARMADA — стратегический план 2026

Ветка работы: `cursor/compliance-p0-4317`

Продакшен: https://aptown1.fvds.ru · API: https://aptown1.fvds.ru/armada-api

## §4 Статус этапов (трекер)

| Этап | Статус | Примечание |
|------|--------|------------|
| S0 HTTPS + armada-api | ✅ done | LE, API v0.4.3-etrn-tariff |
| S1 driverInvites | ✅ done | invite.html, 7 дней TTL |
| S2 пилот 2–3 space | 🔄 in_progress | kp.html, ждут партнёров |
| S3 ETRN MVP | 🔄 in_progress | код на проде; оператор и 5 живых ЭТрН — пауза |
| S3-1.2 письма операторам | ⏸ paused | docs/PISMO_OPERATORAM_ETRN.md |
| S3-2.7 5 живых ЭТрН | ⏸ paused | после подключения оператора |
| S4–S7 | ⏸ paused | только по явному «Делай» |
| O-02 Push GitHub | ⏸ blocked | нужен GITHUB_TOKEN |

JSON-трекер: `.cursor/stores/self/strategic-plan-tracker.json`

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
