# Ссылки «Заказать» с armada.sx → app.armada.sx

Публичная форма заявки: **https://app.armada.sx/order.html**

Диспетчер видит заявки в **Админ → Активность → «Заявки на транспорт · armada.sx»**.

---

## Кнопки на WordPress (armada.sx)

Вставьте ссылку на нужный тип транспорта:

| Услуга на сайте | Ссылка |
|-----------------|--------|
| **Шаланда** | `https://app.armada.sx/order.html?vtype=shalanda&source=armada.sx` |
| **Манипулятор** | `https://app.armada.sx/order.html?vtype=manipulator&source=armada.sx` |
| **Тент / перевозки** | `https://app.armada.sx/order.html?vtype=tent&source=armada.sx` |
| **Самосвал** | `https://app.armada.sx/order.html?vtype=dump&source=armada.sx` |
| **Трал** | `https://app.armada.sx/order.html?vtype=tral&source=armada.sx` |
| **Общая кнопка** | `https://app.armada.sx/order.html?source=armada.sx` |

Пример HTML для блока «Заказать шаланду»:

```html
<a class="btn btn-primary" href="https://app.armada.sx/order.html?vtype=shalanda&source=armada.sx">
  Заказать шаланду онлайн
</a>
```

Параметры:

- `vtype` — тип ТС (slug из справочника ATI: `shalanda`, `manipulator`, …)
- `source` — откуда пришёл клиент (для журнала; по умолчанию `armada.sx`)

---

## Клиенты с PIN (портал /z)

Если заказчик уже в портале, можно вести сразу на форму с выбранным типом:

`https://app.armada.sx/z/?vtype=shalanda&source=armada.sx`

После входа по PIN тип «шаланда» будет выбран автоматически.

---

## Что происходит после отправки

1. Заявка сохраняется в облаке.
2. **Логист — ООО «Армада»**: заказ создаётся в её кабинете (режим «логисту» / диспетчер).
3. **Заказчик закрепляется** в справочнике ООО «Армада» по телефону (повторные заявки — тот же контрагент).
4. Супер-админ видит lead в **Активность** и может открыть заявку по кнопке.
5. Цену уточняет диспетчер (`pricePending`).

---

## Разработка

- Страница: `web-preview/order.html`, логика: `order-public.js`
- URL-хелперы: `armadaPublicOrderUrl()`, `armadaCustomerPortalOrderUrl()` в `store.js`
- Типы для кнопок: `ARMADA_SX_ORDER_VTYPES` в `store.js`
