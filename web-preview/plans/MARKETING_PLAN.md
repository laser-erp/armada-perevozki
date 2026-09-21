# Маркетинг и продвижение АРМАДА

**Статус:** 🟡 в работе (контент и процессы) · **Не путать с** [LANDING_PLAN.md](LANDING_PLAN.md) (верстка лендингов).  
**Staging:** https://staging.app.armada.sx · **Prod:** https://app.armada.sx  
**Обновлено:** 2026-09-21

---

## Как открыть этот план

| Способ | Где |
|--------|-----|
| **В приложении** | Супер-админ → **Планы** → **Маркетинг** |
| **Файлы на сервере** | `/plans/MARKETING_PLAN.md` и папка `/plans/marketing/` |
| **Презентация** | [/presentation/app-deck.html](/presentation/app-deck.html) |
| **Картинки к постам** | [/marketing-cards/01-uslugi-order.html](/marketing-cards/01-uslugi-order.html) … `08` |

Подробные разделы (копии): [marketing/README.md](marketing/README.md)

---

## 1. Два бизнеса — две воронки

| | **Услуги** | **Платформа (SaaS)** |
|---|------------|----------------------|
| Продукт | Шаланда, манипулятор… | Кабинет логиста / перевозчика / портал |
| Клиент | «Нужна машина» | Логист 1–15 ТС |
| URL | [order.html](/order.html) | [pilot.html](/pilot.html), [kp-logist.html](/kp-logist.html) |
| Лиды | Админ → **Активность** → заявки armada.sx | Активность → пилот / портал |
| Соцсети | VK чаще | Telegram чаще |

**Правило:** один пост = одна кнопка (order **или** pilot).

---

## 2. Воронка A — заявка на транспорт

1. **Увидел** — armada.sx, VK, пост [Услуги]  
2. **Клик** — `order.html?vtype=…&source=armada.sx` (таблица: [ARMADA_SX_ORDER_LINKS.md](ARMADA_SX_ORDER_LINKS.md))  
3. **Отправил** — лид в админке  
4. **Перезвон в тот же рабочий день** ← главное  
5. **Рейс** → повтор  

**Учёт (блокнот / таблица):** неделя | заявки | перезвоны ≤24ч | рейсов  

---

## 3. Воронка B — пилот кабинета

1. Пост / [kp-logist](/kp-logist.html) / [deck](/presentation/app-deck.html)  
2. [pilot.html?role=logist](/pilot.html?role=logist)  
3. Лид в **Активность**  
4. **Созвон 15–20 мин** (чеклист в [marketing/VORONKA_SOLO.md](marketing/VORONKA_SOLO.md))  
5. **30 дней пилота**  
6. Оплата или пауза (день 25–28 — звонок)  

---

## 4. Один человек: 45 минут в неделю (контент)

### Подготовка один раз (30–40 мин)

1. Скопировать [marketing/templates/ARMADA_FACTS_TEMPLATE.md](marketing/templates/ARMADA_FACTS_TEMPLATE.md) → `marketing/my/ARMADA_FACTS.md` (локально, можно не в git).  
2. Заполнить: телефон, типы техники, **что реально в prod**, запреты.  
3. Снять или экспортировать **5 карточек** PNG: `./scripts/export-marketing-cards.sh` → `marketing-cards/png/` (нужен Chrome).  
4. Создать **Telegram-канал**, закреп: ссылки order + pilot ([marketing/SOCIAL_TELEGRAM.md](marketing/SOCIAL_TELEGRAM.md)).  

### Каждую неделю

1. Открыть [marketing/templates/CURSOR_WEEKLY_BATCH.prompt.md](marketing/templates/CURSOR_WEEKLY_BATCH.prompt.md), вставить FACTS, получить **2 поста TG + 1 VK**.  
2. К посту приложить PNG: см. [marketing/KARTINKI_K_POSTAM.md](marketing/KARTINKI_K_POSTAM.md) (01–08).  
3. **Telegram** → отложить на Пн и Чт; **VK** → Ср (короче на 30%).  
4. Два раза в день **5 мин** — проверить **Активность**, перезвонить по order.  

**Ротация тем:** чётная неделя — заявка online + скрин кабинета; нечётная — миф «не ATI» + тип техники.

---

## 5. Соцсети: TG, VK, MAX

| Сеть | Старт | Частота | Файл плана |
|------|-------|---------|------------|
| Telegram | нед. 2 | 2–3 поста/нед | [marketing/SOCIAL_TELEGRAM.md](marketing/SOCIAL_TELEGRAM.md) |
| VK | мес. 2 | 2 поста/нед | [marketing/SOCIAL_VK.md](marketing/SOCIAL_VK.md) |
| MAX | с каналом | как TG | API: dev.max.ru, бот-админ канала |
| YouTube/Rutube | мес. 3 | 2 видео/мес | [marketing/SOCIAL_YOUTUBE_RUTUBE.md](marketing/SOCIAL_YOUTUBE_RUTUBE.md) |
| Дзен | мес. 4 | 2 статьи/мес | [marketing/SOCIAL_DZEN.md](marketing/SOCIAL_DZEN.md) |

Ссылки с UTM: `utm_source=telegram|vk|max&utm_medium=post&utm_campaign=…`

---

## 6. Канал MAX (подключение)

**Сейчас:** вкладка **Канал MAX** (супер-админ) + API на сервере.  
**Инструкция:** [marketing/MAX_PODKLUCHENIE.md](marketing/MAX_PODKLUCHENIE.md) — бот, chat_id, тестовый пост.

## 7. Раздел «Маркетинг» в приложении (дорожная карта)

Сейчас: MAX во вкладке **Канал MAX**; TG/VK — вручную.  
План: исходящие посты TG + VK + MAX из одного черновика.

| Этап | Что |
|------|-----|
| **0** | Ручные посты + этот план (сейчас) |
| **1** | Админ: черновики + галерея карточек 01–08 |
| **2** | VPS `armada-api`: автопост по расписанию, токены в `.env` |

Подробно: [marketing/MARKETING_RAZDEL_APP.md](marketing/MARKETING_RAZDEL_APP.md)

---

## 7. Презентация App (созвоны)

- **9 слайдов:** [/presentation/app-deck.html](/presentation/app-deck.html)  
- Показ: шаринг экрана, стрелки ↑↓  
- **PDF:** Chrome → Печать → «Сохранить как PDF»  
- После лида pilot — отправить ссылку или PDF  

Инструкция: [marketing/PREZENTACIYA_APP.md](marketing/PREZENTACIYA_APP.md)

---

## 8. Картинки к постам (01–08)

| № | Тема | HTML |
|---|------|------|
| 01 | Заявка online | `/marketing-cards/01-uslugi-order.html` |
| 02 | Кабинет логиста | `/marketing-cards/02-platform-logist.html` |
| 03 | Не ATI | `/marketing-cards/03-myth-not-ati.html` |
| 04 | Шаланда | `/marketing-cards/04-uslugi-shalanda.html` |
| 05 | Портал заказчика | `/marketing-cards/05-platform-portal.html` |
| 06 | ЭТрН | `/marketing-cards/06-platform-etrn.html` |
| 07 | Пилот 30 дней | `/marketing-cards/07-pilot-cta.html` |
| 08 | Манипулятор | `/marketing-cards/08-uslugi-manipulator.html` |

Экспорт PNG на VPS/ПК: `scripts/export-marketing-cards.sh`

---

## 9. Связь с сайтом armada.sx

- Все кнопки «Заказать» → [ARMADA_SX_ORDER_LINKS.md](ARMADA_SX_ORDER_LINKS.md)  
- Блок «Кабинет для логистов» → [landing.html](/landing.html)  
- Доработка текстов/скринов лендингов → [LANDING_PLAN.md](LANDING_PLAN.md) L1–L2  

---

## 10. Чеклист «первая неделя на staging/prod»

- [ ] FACTS заполнен  
- [ ] TG-канал + закреп (order + pilot)  
- [ ] 2 поста запланированы + PNG из 01 или 04  
- [ ] armada.sx: CTA на order проверены  
- [ ] SLA: перезвон по order  
- [ ] Презентация открывается: `/presentation/app-deck.html`  
- [ ] План прочитан в **Админ → Планы → Маркетинг**  

---

## 11. Решения (заполнить от руки)

1. Приоритет 90 дней: услуги ___ % / пилот ___ %  
2. Geo услуг: ___________  
3. Кто пишет посты: ___________  
4. MAX + TG + VK автопост: сразу все / сначала TG: ___________  

---

## 12. Индекс файлов в `/plans/marketing/`

| Файл | Содержание |
|------|------------|
| [PLAN_DLYA_VLADELCA.md](marketing/PLAN_DLYA_VLADELCA.md) | Простым языком |
| [MASTER_PLAN.md](marketing/MASTER_PLAN.md) | KPI, 12 мес. |
| [VORONKA_SOLO.md](marketing/VORONKA_SOLO.md) | Воронки |
| [CONTENT_AUTOMATION_SOLO.md](marketing/CONTENT_AUTOMATION_SOLO.md) | Cursor + 45 мин/нед |
| [MARKETING_RAZDEL_APP.md](marketing/MARKETING_RAZDEL_APP.md) | TG/VK/MAX в app |
| SOCIAL_*.md | По сетям |

---

*Владелец бизнеса: начните с [marketing/PLAN_DLYA_VLADELCA.md](marketing/PLAN_DLYA_VLADELCA.md)*
