# АРМАДА — iOS / Android

**Это та же веб-версия**, только в оболочке приложения.

Приложение открывает `http://aptown1.fvds.ru/` — все экраны, PIN, sync, тарифы, ЕТО работают как в браузере. Отдельной логики нет.

## Сейчас без сборки (как ярлык)

| Платформа | Как поставить |
|-----------|----------------|
| **iPhone** | Safari → сайт → Поделиться → **На экран «Домой»** |
| **Android** | Chrome → сайт → ⋮ → **Установить приложение** |

## Сборка APK / Xcode (иконка как у обычных программ)

```bash
cd mobile
npm install
npx cap sync
```

### Android
Нужен Android Studio.

```bash
npx cap open android
# Run на телефоне или Build → APK
```

В манифесте уже разрешён HTTP (cleartext) к `aptown1.fvds.ru`.

### iOS
Нужен **Mac + Xcode**.

```bash
npx cap add ios   # один раз
npx cap sync
npx cap open ios
```

В Xcode: Team → Run на iPhone.  
Для HTTP в Info.plist должно быть `NSAppTransportSecurity` → `NSAllowsArbitraryLoads` (Capacitor ставит при `cleartext: true`).

## Обновления
Правите веб на сервере — в приложении сразу та же версия (подгружается с сайта). Пересобирать APK/IPA нужно только при смене иконки, имени или адреса сервера.
