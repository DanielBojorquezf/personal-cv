---
title: "OAuth 2.0 sin la niebla: grants, tokens y logins de verdad"
description: "OAuth 2.0 es autorización delegada, no un login mágico. Recorro authorization code, PKCE, client credentials, refresh tokens y los errores que filtran cuentas."
pubDate: 2026-09-16
lang: es
translationKey: oauth-2
category: security
tags:
  - oauth
  - oauth2
  - oidc
  - pkce
heroImage: /assets/img/blog/oauth-2-es.svg
heroImageAlt: Flujo de authorization code de OAuth 2.0 entre usuario, cliente, authorization server y API
---

OAuth 2.0 es cómo dejas que la **App A** llame a la **API B** a nombre de un usuario (o a nombre de ella misma) **sin que el usuario le dé a A su password de Google**. Esa oración es el protocolo.

Es **autorización**: scopes, access tokens, audiences. La **autenticación** ("quién es este humano") es **OpenID Connect (OIDC)** encima de OAuth — el `id_token` y el endpoint de userinfo. Si solo implementas OAuth y luego tratas un access token como cookie de login, vas a confundir a cada reviewer futuro, incluyéndote.

OAuth 1.0a firmaba cada request con secretos HMAC. Funcionaba, y era un dolor. OAuth 2.0 movió lo difícil a **HTTPS + bearer tokens**. Más fácil de integrar. Más fácil de filtrar. La seguridad está en cómo minteas, guardas y rotas esos tokens.

## Los cuatro roles

- **Resource owner:** el usuario.
- **Client:** tu app (SPA, móvil, Laravel).
- **Authorization server:** Google, Auth0, Cognito, Keycloak o tu propio `/oauth`.
- **Resource server:** la API que acepta el access token.

"Continuar con Google" es: tu client le pide permiso a Google; Google autentica al humano; tu API después confía en un token o en una sesión que tú creas en el callback.

## Los flujos que todavía importan

### Authorization code (+ PKCE) — default para humanos

```text
1. El usuario da clic en "Continuar con Google"
2. El navegador va a Google con client_id, redirect_uri, scope, state, code_challenge
3. El usuario consiente
4. Google redirige a https://app.example.com/callback?code=...&state=...
5. Tu backend cambia el code + code_verifier por tokens
6. Creas una sesión (o guardas tokens con cuidado)
```

**PKCE** evita que un `code` robado lo intercambie alguien que no tiene el `code_verifier`. Los clientes públicos (móvil, SPA) deben usarlo. Los confidenciales (Laravel con secret) también deberían. `state` es el CSRF del redirect.

### Client credentials — máquinas

No hay usuario. El cron de nómina pide un token con `grant_type=client_credentials`. Scopes tipo `invoices:write`. Úsalo para servicio a servicio. No finjas un usuario.

### Refresh tokens — renovación silenciosa

Los access tokens deberían durar **minutos**, no días. El refresh token saca access tokens nuevos. Rótalo: cada refresh invalida el anterior. Reusar uno viejo debería matar la cadena (señal de robo).

### Implicit grant — muerto

Ponía el access token en el fragmento de la URL. No lo uses. Authorization code + PKCE lo reemplazó.

### Resource owner password — también muerto

La app recolecta el password real del usuario. Eso le enseña a la gente a escribir su password de Google en *ti*.

## OAuth vs "nada más un JWT"

OAuth 2.0 a menudo *emite* JWTs. No tiene que. El access token puede ser opaco y la API lo introspecta.

Lo que OAuth agrega encima de "firmé un JWT":

- Grants y reglas de redirect estándar
- **Scopes** (`email`, `payments:read`)
- **Audience** (`aud`)
- Pantallas de consentimiento
- Refresh y revocación
- Tipos de client (público vs confidencial)

Si minteas un JWT casero después de email/password, eso no es OAuth. Puede estar bien. No le pongas OAuth a la lámina.

## Un ejemplo Laravel + SPA

App Svelte en `app.example.com`, API en `api.example.com`, y también "Continuar con Google".

1. El usuario va a Google con PKCE.
2. El callback cae en **Laravel**, no en el JS de la SPA, si puedo evitarlo. El intercambio usa `client_secret` en el servidor.
3. Laravel encuentra o crea `users.google_id`.
4. Laravel abre una **cookie de sesión** (Sanctum) para la app de primer partido.
5. El access token de Google se queda en servidor solo si después necesito scopes de Gmail.

Si solo necesitabas identidad, **OIDC `id_token` + tu sesión** alcanza.

En móvil: el browser del sistema o una librería certificada (AppAuth). La app no embebe un WebView que pueda robar el password de Google.

## Tokens, en la práctica

| Token | Trabajo | Dónde vive | Vida |
| --- | --- | --- | --- |
| Authorization code | Cambio de una sola vez | Query string | ~30–60 segundos |
| Access token | Llamar APIs | Memoria o HttpOnly | 5–15 minutos |
| Refresh token | Nuevos access tokens | Servidor, storage seguro o cookie HttpOnly | Horas–días, rotado |
| ID token (OIDC) | Probar quién entró | Léelo una vez para crear sesión | Corto |

Un access token es un secreto **bearer**. Quien lo tiene es el usuario para esos scopes. Trátalo como un password con expiración.

## Pros y contras de hacer OAuth 2.0

**Pros:** el usuario no inventa otra password; no guardas passwords de Google; los scopes limitan el daño; las empresas esperan SSO; client credentials te dan un login de máquina estándar.

**Contras:** un `redirect_uri` con o sin slash te puede comer un día; ahora dependes de que Google/Apple/Azure estén arriba; el account linking necesita política; pedir Drive el día uno tumba la confianza; si tú te vuelves authorization server, ya eres dueño de un producto de seguridad.

## Passport vs Sanctum vs "entrar con X"

- **Sanctum:** SPA/sesión de primer partido o API tokens simples.
- **Passport / Hydra / Cognito / Auth0:** cuando *otras apps* tienen que obtener tokens con grants y scopes.
- **Socialite + sesión:** cuando solo necesitas "login con Google" para *tu* sitio.

La mayoría de CVs y CRMs necesitan Socialite + una sesión. No necesitan ser Google.

## Errores comunes

1. Llamarle a OAuth "encriptación más segura". Es un protocolo de delegación.
2. Saltar `state` y PKCE.
3. Poner el access token en la URL o en logs.
4. Usar implicit flow porque un Stack Overflow viejo dijo que las SPAs no pueden guardar secretos (no pueden — por eso existe PKCE).
5. Aceptar un token sin checar `iss`, `aud`, `exp` y las JWKs.
6. Confundir "el usuario entró" con "el usuario dio `payments:write`".
7. Implementar password grant para que la app nativa "se sienta nativa". Usa el browser del sistema.

## Cómo elijo

- **Login de mi propia web:** OIDC authorization code + PKCE, luego una **sesión**.
- **Móvil:** AppAuth / browser del sistema, PKCE, access corto + refresh rotado en el keychain.
- **Integración con partners:** yo soy el authorization server *o* uso un vendor. Authorization code para sus usuarios, client credentials para sus servidores.
- **Jobs internos:** client credentials o roles de IAM. No un usuario falso `cron@internal`.

OAuth 2.0 se ve como un laberinto porque es una familia de herramientas. **Elige un grant, mantén los tokens cortos, intercambia codes en un servidor que tú controlas y no inventes una cuarta forma de guardar un bearer token en `localStorage`.**
