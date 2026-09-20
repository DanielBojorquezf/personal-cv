---
title: "Sesiones vs JWT: dónde debe vivir el estado de autenticación"
description: "Las sesiones de servidor y los JWT mantienen a un usuario logueado. La diferencia es quién recuerda el login, qué tan rápido lo revocas y qué se rompe cuando agregas un segundo servidor."
pubDate: 2026-09-10
lang: es
translationKey: sessions-vs-jwt
category: backend
tags:
  - jwt
  - sesiones
  - autenticacion
  - cookies
heroImage: /assets/img/blog/sessions-vs-jwt-es.svg
heroImageAlt: Diagrama que compara un store de sesión en el servidor con un JWT autocontenido
---

"¿Usamos JWT?" es la pregunta equivocada. La primera es: **quién guarda el hecho de que este navegador puede actuar como el usuario 42, y qué tan rápido puedes quitar ese hecho.**

Una **sesión** guarda eso en el servidor (o en Redis). El navegador solo tiene un id aleatorio. Un **JWT** guarda eso *dentro del token*. Al servidor le basta una llave para creerle.

He sacado las dos: cookies de sesión de Laravel en apps clásicas, Sanctum para SPAs de primer partido, y tokens firmados para móvil y llamadas entre servicios. Los fallos que veo casi nunca son "JWT es inseguro". Son "no podemos sacar a este usuario" y "pusimos el access token en `localStorage` y luego celebramos un XSS".

## Cómo funciona una sesión

1. El usuario manda email/password.
2. El servidor crea `sid = random(32)` y guarda `{ userId, expires }` en Redis o en `sessions`.
3. Pone una cookie **HttpOnly**, **Secure**, **SameSite**: `session=sid`.
4. Cada request manda la cookie. Si el registro ya no está, el usuario está fuera.

La cookie es un apuntador. **Revocar es `DEL session:sid`.** Cambiar password, cerrar todos los dispositivos, banear una cuenta: borras filas.

Laravel ya hace esto. Para escalar: `SESSION_DRIVER=redis` para que varias cajas compartan el store.

## Cómo funciona un JWT

Tres partes en Base64url: `header.payload.signature`. El payload puede ser `{ "sub": "42", "role": "admin", "exp": ... }`. HMAC o RSA prueban que nadie lo editó. El servidor **no** necesita buscar la sesión si confía en la llave.

Esa es la feature y la trampa. El token vale hasta `exp` salvo que agregues maquinaria extra (blocklist, TTL corto + refresh, claim de versión).

## Una SPA de primer partido (Angular o Svelte + Laravel)

UI en `app.example.com`, API en `api.example.com`.

### Opción A — cookie de sesión (mi default)

Sanctum, CSRF cookie + cookie de sesión, `credentials: 'include'`. El logout es un DELETE en el servidor. Un XSS igual puede *usar* la cookie en tu origen, pero JavaScript no lee tan fácil una cookie HttpOnly para llevársela a `evil.com`.

### Opción B — JWT en memoria + cookie HttpOnly de refresh

Access token de 5–15 minutos en una variable JS (no en `localStorage`). Refresh rotado en cookie HttpOnly. Tiene sentido para móvil o cuando varias APIs deben aceptar el mismo access token sin compartir store.

### Opción C — JWT solo en localStorage

Lo trato como smell en apps de navegador. Cualquier XSS se vuelve robo de token. Y no puedes revocar hasta que expire.

## Comparación

| | Sesión de servidor | JWT |
| --- | --- | --- |
| El servidor guarda | El registro de sesión | Llaves, tal vez un blocklist |
| El navegador guarda | Un id opaco | Los claims |
| Revocar ahora | Borras el registro | Difícil, salvo TTL corto o blocklist de `jti` |
| Escalar | Store compartido (Redis) | Fácil si te saltas el blocklist |
| Tamaño | Cookie chica | Cientos de bytes en cada request |
| Mejor en | Webs que controlas | APIs, móvil, microservicios |
| Peor en | Hosting estático sin store | "Cerrar sesión en todos lados" con tokens de 30 días |

## Pros y contras

**Sesiones.** Pros: logout instantáneo, roles y flags sin filtrarlos al cliente, SameSite bien puesto es una buena historia de CSRF, encaja en Laravel/Rails/Django. Contras: necesitas store; las sticky sessions en un solo EC2 te muerden en el segundo; las SPAs cross-domain piden diseño de CSRF y dominio.

**JWT.** Pros: APIs sin estado; móvil manda `Authorization` fácil; unos cuantos claims evitan un hit a DB. Contras: **revocar no es gratis**; la gente mete de más en los claims; `alg=none` sigue apareciendo en verifiers caseros; XSS + `localStorage` es el clásico; el clock skew rompe `exp`.

## Patrones que sí uso

1. **Web clásica (Blade, la mayoría de CRMs):** sesión + Redis. No agregues JWT porque un blog dijo que escala más.
2. **SPA de primer partido:** sesión tipo Sanctum, o JWT corto + refresh rotado.
3. **App móvil:** access JWT corto + refresh en el **keychain** del OS, con rotación.
4. **Servicio a servicio:** no inventes una sesión de usuario. Usa **client credentials** de OAuth 2.0, mTLS o un JWT interno de 60 segundos.

## Una revocación que no miente

Si el producto dice "cerrar sesión en todos los dispositivos", necesitas un bit en servidor:

```text
users.token_version = 8
JWT: { sub: 42, ver: 8, exp: ... }
```

Al cambiar password, `ver++`. Los tokens viejos siguen verificando la firma y fallan la versión. Eso es un campo de sesión — y está bien. **JWT 100% stateless y logout global instantáneo no pueden ser verdad al mismo tiempo.**

## Errores comunes

1. Guardar JWT en `localStorage` y decir que es "más seguro que las sesiones".
2. Meter secretos o PII en claims. Un JWT está encoded, no encrypted, salvo que uses JWE.
3. Aceptar tokens sin checar `aud` e `iss`.
4. Access tokens de 30 días "para no molestar". Usa refresh.
5. Mezclar cookie de sesión y JWT hasta que nadie sabe cuál gana.

## Cómo elijo

- **Un sitio, un backend, las cookies ya funcionan:** sesión.
- **Necesitas revocar, banear o subir a 2FA:** sesión o JWT + versión/blocklist.
- **Varias APIs, clientes móviles, OAuth:** JWT de vida corta.
- **Cero estado en servidor y logout instantáneo:** elige una. No puedes tener las dos.

Una sesión es un token opaco. Un JWT es un token que se describe solo. **Default: sesión de servidor para navegadores que yo controlé, JWT cortos cuando el cliente no es un jar de cookies de primer partido.**
