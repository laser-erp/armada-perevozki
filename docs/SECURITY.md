# Безопасность АРМАДА

## Фаза 0 (внедрено)

- PocketBase **не проксируется** снаружи (`/api/*`, `/_/*` убраны из Caddy).
- Клиент работает через **`/armada-api/*`** с JWT после входа.
- Сервис `armada-api` на `127.0.0.1:8091`, конфиг `/etc/armada/api.env`.

## После деплия — вручную на сервере

1. Задать `PB_ADMIN_PASSWORD` в `/etc/armada/api.env` (пароль superuser PocketBase).
2. `systemctl restart armada-api`
3. **Сменить PIN** всех админов и водителей (старые могли быть в открытой базе).
4. Сменить пароль PocketBase superuser, если API был открыт.
5. HTTPS: когда Let's Encrypt для fvds.ru доступен — раскомментировать блок в `scripts/caddyfile.armada`.

## Проверка

```bash
# Должен быть 404 (не 200):
curl -sS -o /dev/null -w '%{http_code}\n' http://aptown1.fvds.ru/api/collections/app_state/records

# Должен быть 200:
curl -sS http://aptown1.fvds.ru/armada-api/health

# State без токена — 401:
curl -sS -o /dev/null -w '%{http_code}\n' http://aptown1.fvds.ru/armada-api/state
```

## Скелет фазы 1 (в коде)

- `POST /armada-api/auth/admin` — PIN → JWT
- `POST /armada-api/auth/driver` — телефон + PIN → JWT
- `GET /armada-api/state` — только с JWT
- `PUT /armada-api/state` — только админ с JWT
- `GET /armada-api/bootstrap` — список админов без PIN (для формы входа)

Дальше: фильтрация payload по `spaceId`, PIN-hash, HTTPS, ключи DaData только на сервере.
