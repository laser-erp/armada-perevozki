# S3-2.7 · Контур.Логистика (ЭПД / ЭТрН)

Статус: **в работе** — документация API получена от оператора, ключи разработчика ещё не прописаны на VPS.

Документация оператора: [Контур.Логистика API](https://developer.kontur.ru/doc/logistics.api)  
Инструкция по ЭТрН (Диадoc API): [Работа с ЭТрН](https://developer.kontur.ru/doc/diadoc-api/instructions/documents/formal/waybill.html)

---

## Что уже есть

| Слой | Состояние |
|------|-----------|
| **UI** (`etrn.js`) | Создание ЭТрН, T1–T4, QR, печать, подпись грузоотправителя по ссылке |
| **armada-api** (VPS `/opt/armada-api`) | `POST/GET /orders/:id/etrn`, `POST /epd/webhook`, `/health` с блоком `epd` |
| **Админ → Активность → ЭПД** | Выбор оператора, webhook token, статус сервера (`paintEpdServerStatus`) |
| **Прод health** | `operator: kontur`, `sandbox: true`, **`configured: false`** |

Проверка:

```bash
curl -sS https://app.armada.sx/armada-api/health | jq .
```

---

## Что прислал оператор

Ссылка на **Logistics API** — это публичная документация интеграции через **Diadoc API** (`diadoc-api.kontur.ru`):

1. Авторизация (ключ разработчика → access token).
2. `GenerateTitleXml` — генерация титула из UserDataXml.
3. Подписание и отправка: `PostMessage` (V3), ответные титулы — `PostMessagePatch` (V4).
4. Webhook / опрос статуса подписей.

Параметры ЭТрН для генерации титулов:

| Параметр | Значение |
|----------|----------|
| `documentTypeNamedId` | `LogisticsWaybill` |
| `documentFunction` | `reception` (погрузка) / `delivery` (выгрузка) |
| `documentVersion` | `kl_trn_mt_05_01` |
| `titleIndex` | `0` = T1, `1` = T2, … (см. доку) |

---

## Соответствие титулов АРМАДА ↔ Контур

В приложении упрощённая модель **T1–T4** (MVP):

| АРМАДА | Когда | Контур (полный ДО) |
|--------|-------|---------------------|
| **T1** грузоотправитель | погрузка | T1 грузоотправителя |
| **T2** перевозчик | погрузка | T2 перевозчика (приём) |
| **T3** водитель (приём) | погрузка | часть сценария T2/T3 |
| **T4** водитель (выдача) | выгрузка | T4 перевозчика (выдача) |

T5–T8 (стоимость, переадресация, эстафета) — **не в MVP**; добавить после первого боевого обмена.

---

## Шаги на VPS (когда придут ключи)

Файл: `/opt/armada-api/.env`  
Шаблон в репозитории: `scripts/armada-api.env.example`

1. Получить у Контура **ключ разработчика** (client_id / api key) и **boxId** организации ООО «Армада».
2. Прописать переменные (см. example), `EPD_SANDBOX=true` для тестового контура.
3. Перезапуск: `systemctl restart armada-api`
4. Проверка: в `/health` должно быть `"configured": true`.
5. В админке **Активность → ЭПД** — строка «ключи на сервере есть».

Smoke webhook (ожидаем `etrn_not_found`, не 404):

```bash
curl -sS -X POST https://app.armada.sx/armada-api/epd/webhook \
  -H 'Content-Type: application/json' -d '{"externalId":"smoke"}'
```

---

## Серверная интеграция (armada-api, вне git)

Код на VPS: `/opt/armada-api/src/`. Репозиторий не содержит armada-api — правки только по SSH.

### POST `/orders/:id/etrn`

1. Собрать UserDataXml из заказа (маршрут, ТС, водитель, контрагенты).
2. `GenerateTitleXml` → T1 (titleIndex=0).
3. Сохранить `externalId`, `letterId`, `documentId` в заказе.
4. Вернуть `{ etrn: { operatorId, externalId, tituls, sandbox, signUrl? } }`.

### Подписи T1–T4

- T1: ссылка грузоотправителю (уже в UI) → armada-api инициирует подпись в Контуре или принимает callback.
- T2–T4: webhook `POST /epd/webhook` обновляет `tituls` в state.

### Webhook token

В админке задаётся `epdWebhookToken`; armada-api проверяет заголовок/поле при вызове от Контура.

---

## Проверка из браузера

После деплоя web и настройки ключей:

1. Админ → заказ с водителем и ТС → «Создать ЭТрН».
2. `configured: true` — запрос уходит в API, не в local-stub.
3. `/armada-api/orders/:id/etrn` возвращает реальный `externalId`.

---

## Блокеры

| Блокер | Кто |
|--------|-----|
| SSH на VPS (прописать `.env`) | пароль `FVDS_SSH_PASSWORD` или ключ |
| Ключ разработчика + boxId | ответ Контура на письмо (`operator-letters.js` → `etrnKontur`) |
| Исходники armada-api в git | опционально, для CI |

---

## Связанные файлы

- `web-preview/etrn.js` — UI и клиент API
- `web-preview/admin.js` — секция ЭПД, `paintEpdServerStatus`
- `web-preview/store.js` — `fetchArmadaApiHealth`, `API_BASE`
- `scripts/armada-api.env.example` — шаблон env
- `scripts/smoke-strategic-plan.sh` — smoke S3
