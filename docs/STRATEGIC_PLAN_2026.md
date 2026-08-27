# ARMADA — стратегический план 2026

Ветка работы: `cursor/compliance-p0-4317` (локальный HEAD `238cd84`, 7 коммитов ahead of `main`)

Продакшен: https://aptown1.fvds.ru · API: https://aptown1.fvds.ru/armada-api

Контекст S3: `docs/COMPETITIVE_ANALYSIS_2026.md`

## §4 Статус этапов (трекер)

| Этап | Статус | Примечание |
|------|--------|------------|
| S0 HTTPS + armada-api | ✅ done | LE до 2026-11-22, smoke + ssh-verify OK |
| S1 driverInvites | ✅ done | invite.html, KEY в store.js, smoke OK |
| S2 пилот 2–3 space | 🔄 in_progress | kp.html, **онбординг + help.html на проде**, ждут партнёров |
| S3 ETRN MVP (код 2 спринта) | ✅ done | UI + API + webhook; smoke OK |
| S3-1.2 письма операторам | 📤 ready_to_send | PDF на проде, `docs/PISMO_OPERATORAM_ETRN.md` |
| S3-2.7 5 живых ЭТрН | ⏸ paused | `epd.configured: false`, нужны ключи оператора |
| S4–S7 | ⏸ paused | только по явному «Делай» |
| O-02 Push GitHub | ⏸ blocked | `docs/PUSH_COMPLIANCE_BRANCH.md`, нужен `GITHUB_TOKEN` |

JSON-трекер: `.cursor/stores/self/strategic-plan-tracker.json`

Проверка продакшена:

```bash
chmod +x scripts/run-strategic-verification.sh scripts/check-github-remote-branch.sh scripts/ssh-verify-fvds.sh
BASE_URL=https://aptown1.fvds.ru ./scripts/run-strategic-verification.sh
./scripts/check-github-remote-branch.sh cursor/compliance-p0-4317
./scripts/ssh-verify-fvds.sh
```

Деплой ветки на VPS: `scripts/deploy-fvds.sh` (пароль: секрет `root` или `FVDS_SSH_PASSWORD`; fallback `python3+paramiko`).

## §5 Аудит цели (objective)

| Требование | Evidence | Статус |
|------------|----------|--------|
| S0 HTTPS + armada-api | `run-strategic-verification.sh` PASS + ssh-verify | ✅ |
| S1 driverInvites | smoke + verify-prod-web-sync | ✅ |
| S3 ETRN MVP 2 спринта | `COMPETITIVE_ANALYSIS_2026.md` чеклист + smoke | ✅ |
| Деплой ветки на aptown1 | verify-prod-web-sync 16 файлов MATCH | ✅ |
| Ветка `cursor/compliance-p0-4317` на GitHub | `check-github-remote-branch.sh` → HTTP 404 | ❌ |
| Трекер §4 + JSON | этот файл + `.cursor/stores/self/` | ✅ |

Цель **не закрыта** до push ветки на `origin` (O-02). S2 партнёры и S3-2.7 живые ЭТрН — вне текущего objective-кода.


| План | ₽/мес | Биржа | ЭТрН |
|------|-------|-------|------|
| Старт | 2 990 | нет | нет |
| Бизнес | 7 990 | да | да |
| Профи | 14 990 | да | да |
| Биржа Lite | 1 990 | да | нет |

Пилот: 30 дней trial на каждый space. Лендинг kp.html — ориентир для клиентов.

## Сборка на проде

- `APP_BUILD`: `2026-08-27-onboard1`
- Service Worker: `armada-shell-v26`, network-first для JS/CSS
- Онбординг: welcome + туры по ролям, `help.html`
