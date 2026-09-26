# Картинки к постам — как получить PNG

**Что это:** готовые **инфо-карточки 1080×1080** (макет + текст + схема интерфейса).  
**Не замена:** скринам **реального** prod с вашими данными — их можно подменить позже.

---

## Таблица: пост → картинка

| Ротация / тема | HTML (открыть или PNG) | Контур |
|----------------|------------------------|--------|
| Заявка online | `01-uslugi-order` | Услуги |
| Кабинет логиста | `02-platform-logist` | Платформа |
| Миф: не ATI | `03-myth-not-ati` | Платформа |
| Шаланда | `04-uslugi-shalanda` | Услуги |
| Портал заказчика | `05-platform-portal` | Платформа |
| ЭТрН обзор | `06-platform-etrn` | Платформа |
| Пилот 30 дней | `07-pilot-cta` | Платформа |
| Манипулятор | `08-uslugi-manipulator` | Услуги |

Файлы: `web-preview/marketing-cards/NN-*.html`  
Готовые PNG (после экспорта): `web-preview/marketing-cards/png/NN-*.png`

---

## Как сделать PNG у себя (1 команда)

```bash
chmod +x scripts/export-marketing-cards.sh
./scripts/export-marketing-cards.sh
```

Нужен Chrome/Chromium. Картинки появятся в `web-preview/marketing-cards/png/`.

**С телефона:** откройте HTML на проде после деплоя  
`https://app.armada.sx/marketing-cards/01-uslugi-order.html` → скриншот экрана (или используйте PNG из репо).

---

## Связка с недельным батчем Cursor

В промпте [CURSOR_WEEKLY_BATCH.prompt.md](./templates/CURSOR_WEEKLY_BATCH.prompt.md) Cursor пишет «какой скрин» — подставляйте **номер карточки** из таблицы выше.

| Cursor suggest | Карточка |
|----------------|----------|
| order | 01 или 04/08 |
| logist | 02 |
| portal | 05 |
| etrn | 06 |
| none / myth | 03 или 07 |

---

## Когда нужны «настоящие» скрины

- Кейс клиента, доверие «это наш живой кабинет».  
- Снимите **один раз** 5 PNG с app.armada.sx (демо-данные, blur ИНН/телефоны).  
- Карточки из HTML — для **регулярных** постов, когда нет времени снимать.

---

## Править текст на карточке

Откройте соответствующий `.html` в `marketing-cards/`, измените заголовок/URL, снова `./scripts/export-marketing-cards.sh`.

*Cursor может править HTML по вашему FACTS — попросите «обнови карточку 04 под мой город».*
