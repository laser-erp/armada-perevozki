# Подготовка к прогону ORDER_LIFECYCLE_QA

**План:** [ORDER_LIFECYCLE_QA_PLAN.md](ORDER_LIFECYCLE_QA_PLAN.md)  
**Автопроверка:** из корня репо  
`./scripts/preflight-order-lifecycle-qa.sh`  
(staging: `BASE_URL=https://staging.app.armada.sx ./scripts/preflight-order-lifecycle-qa.sh`)

---

## Ссылки для сценария 1

| Роль | URL |
|------|-----|
| Заказчик (форма без PIN) | https://app.armada.sx/order.html?source=qa-lifecycle |
| Заказчик (портал) | https://app.armada.sx/z/ |
| Логист | https://app.armada.sx/a/ |
| Водитель | https://app.armada.sx/v/ |

Заявка с **order.html** попадает в кабинет **ООО «Армада»** → канбан **«Входящие»** ([ARMADA_SX_ORDER_LINKS.md](ARMADA_SX_ORDER_LINKS.md)).

---

## Preflight 24.09.2026 (с Cloud Agent)

| Проверка | Prod | Staging |
|----------|------|---------|
| `/order.html`, `/z`, `/a`, `/v` | 200 | (тот же API) |
| `GET /armada-api/health` | ok, epd configured, sandbox | то же |
| `smoke-strategic-plan.sh` | PASS кроме legacy aptown1 | — |
| APP_BUILD (F12 / store.js) | `2026-09-22-max-save-ux` | `2026-09-22-max-token-ascii` |

**Staging и prod делят одни данные** — тестовую заявку помечайте в протоколе (телефон/комментарий «QA lifecycle»).

---

## Готово / не готово

### Уже можно

- Сайт и API на prod отвечают; ЭПД на сервере **подключён** (sandbox).
- Канбан, водитель, портал, публичная форма — файлы и маршруты на месте.
- Сценарий 1 **без ЭТrН** (шаг 4 = **N/A**) — основной путь проверки для **ООО «Армада»** (тариф «Старт», модуль ЭТrН обычно выключен).

### Не хватает с вашей стороны

1. **PIN** для `/z`, `/a`, `/v` — в репозитории нет; нужны ваши тестовые коды.
2. **Шаг 4 (ЭТrН T1–T4)** для кабинета **Армада**: включить **ЭТrН в тарифе** (Business+) *или* гонять ЭТrН на кабинете **МБН** (там etrnEnabled), *или* явно пометить **N/A** в протоколе.
3. **Чистый рейс до конца**: водитель и машина без «висящих» открытых заявок (иначе канбан/закрытие путают проверку).
4. **Два браузера** (заказчик + логист/водитель) — организационно.
5. **Грузоотправитель ≠ заказчик** — заполнить вручную в карточке для будущей проверки T1.
6. **Prod vs staging**: для lifecycle QA достаточно **prod**; staging — если нужны последние правки UI (MAX и т.д.), не отдельная база.

### Не входит в этот чеклист

- Входящая ЭТrН снаружи → автозаявка ([KONTUR_EPD_PLAN.md](KONTUR_EPD_PLAN.md) этап 3b).
- Боевой (не sandbox) обмен с Контуром.
- Счёт-фактура / УПД.

---

## Перед стартом (галочки)

- [ ] `./scripts/preflight-order-lifecycle-qa.sh` → PREFLIGHT PASS  
- [ ] Выбрано окружение: prod **или** staging (осознанно)  
- [ ] PIN трёх ролей под рукой  
- [ ] Решение по ЭТrН: N/A / МБН / включить модуль у Армады  
- [ ] Пустой протокол в конце [ORDER_LIFECYCLE_QA_PLAN.md](ORDER_LIFECYCLE_QA_PLAN.md) открыт для записи  

---

## Быстрый smoke (опционально)

```bash
BASE_URL=https://app.armada.sx ./scripts/smoke-strategic-plan.sh
```

Legacy-хост `aptown1.fvds.ru` в smoke может падать — на app.armada.sx не влияет.
