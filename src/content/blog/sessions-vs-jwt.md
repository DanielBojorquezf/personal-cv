---
title: "Sessions vs JWT: Where Authentication State Should Live"
description: "Server sessions and JWTs both keep a user logged in. The difference is who remembers the login, how you revoke it, and what breaks when you add a second API server."
pubDate: 2026-09-10
lang: en
translationKey: sessions-vs-jwt
category: backend
tags:
  - jwt
  - sessions
  - authentication
  - cookies
heroImage: /assets/img/blog/sessions-vs-jwt.svg
heroImageAlt: Diagram comparing a server-side session store with a self-contained JWT
---

"Should we use JWT?" is the wrong first question. The first question is: **who stores the fact that this browser is allowed to act as user 42, and how fast can you take that fact back?**

A **session** stores that fact on the server (or in Redis). The browser only keeps a random id. A **JWT** stores that fact *inside the token*. The server only needs a signing key to believe it.

I have shipped both: Laravel session cookies on classic apps, Sanctum for first-party SPAs, and signed tokens for mobile and service-to-service calls. The failures I see are rarely "JWT is insecure." They are "we cannot log this user out" and "we put the access token in `localStorage` and then celebrated XSS."

## How a session works

1. User POSTs email/password.
2. Server checks the hash, creates `sid = random(32)`, stores `{ userId, expires }` in Redis or the `sessions` table.
3. Server sets an **HttpOnly**, **Secure**, **SameSite** cookie: `session=sid`.
4. Every request sends the cookie. Server loads the record. If it is gone, the user is logged out.

The cookie is a pointer. **Revocation is `DEL session:sid`.** Change password, revoke all devices, ban an account — delete rows.

Laravel does this out of the box. Scale it by pointing `SESSION_DRIVER=redis` so PHP-FPM or multiple EC2 boxes share the same store.

## How a JWT works

A JWT is three Base64url parts: `header.payload.signature`.

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiI0MiIsImV4cCI6MTcyNjc4ODAwMH0.
signature
```

The payload might be `{ "sub": "42", "role": "admin", "exp": 1726788000 }`. HMAC or RSA proves nobody edited it. The server does **not** need to look up the session if it trusts the key.

That is the feature and the trap. The token is valid until `exp` unless you add extra machinery (blocklist, short TTL + refresh, version claim).

## A first-party SPA example (Angular or Svelte + Laravel)

This is the case I see most: the UI is on `app.example.com`, the API is on `api.example.com`.

### Option A — session cookie (my default for first-party)

- Laravel Sanctum CSRF cookie + session cookie
- `SameSite=Lax` or `None`+`Secure` if the sites are truly cross-site
- Axios/fetch with `credentials: 'include'`
- Auth state lives in Redis

Logout is a server DELETE. XSS can still *use* the cookie on your origin (that is how cookies work), but JavaScript cannot *read* an HttpOnly cookie and exfiltrate it to `evil.com` as easily as a bearer token in `localStorage`.

### Option B — JWT in memory + HttpOnly refresh cookie

- Access token lives in a JS variable (not `localStorage`), 5–15 minutes
- Refresh token is an HttpOnly cookie, rotated on use
- API sends `Authorization: Bearer ...` or the access token also stays in a cookie

This is reasonable for mobile or when several APIs must accept the same access token without sharing a session store. It is more code. If you skip rotation and put a 7-day JWT in `localStorage`, you have built a stolen-key problem.

### Option C — JWT only, stored in localStorage

I treat this as a smell for browser apps. Any XSS becomes a token theft. You also cannot revoke until expiry. People still do it because it is one `localStorage.setItem` and it "works" on localhost.

## Comparison

| | Server session | JWT access token |
| --- | --- | --- |
| Server stores | Session record | Signing keys, maybe a blocklist |
| Browser stores | Opaque cookie id | The claims themselves |
| Revoke now | Delete the record | Hard, unless TTL is tiny or you blocklist `jti` |
| Horizontal scale | Shared store (Redis) | Easy if you skip blocklist |
| Payload size | Cookie ~30–80 bytes | Hundreds of bytes on every request |
| Lookup cost | Redis GET | CPU verify; no GET if stateless |
| Best at | Web apps you own | APIs, mobile, microservices |
| Worst at | Super-dumb static hosting with no store | "Log out everywhere" with 30-day tokens |

## Pros and cons

### Sessions

**Pros**

- Instant logout and "sign out all devices."
- You can store roles, cart ids, 2FA-pending flags without leaking them to the client.
- Cookie + SameSite is a solid CSRF story if you set it on purpose.
- Fits Laravel, Rails, Django, and most admin panels.

**Cons**

- You need a session store. Sticky sessions on one EC2 instance will bite you on the second instance.
- Cross-domain SPAs need CSRF and cookie domain design.
- Server-side rendering + API on another origin is fiddly.
- A huge session blob in the cookie (encrypted Laravel cookie driver) makes every request fat. Prefer Redis.

### JWT

**Pros**

- APIs stay stateless. Any instance can verify.
- Mobile and third-party clients send `Authorization` easily.
- You can embed a few claims (`org_id`, `scope`) and avoid a DB hit on hot paths.
- Works well as a **short-lived access token** in an OAuth 2.0 / OIDC flow.

**Cons**

- **Revocation is not free.** A stolen 24h access token is a 24h incident unless you check a denylist (which makes it a session).
- Tokens get too fat. People stuff profile photos and permissions into claims, then wonder why every request is 4KB.
- `alg=none` and key-confusion bugs still show up in homemade verifiers. Use a library.
- XSS + `localStorage` is a classic leak.
- Clock skew: `exp` and `nbf` fail in surprising ways if boxes disagree on time.

## Patterns I actually use

### 1. Classic web (Blade, Livewire, most CRMs)

Session cookie. Redis. Done. Do not add JWT because a blog said it is more scalable.

### 2. First-party SPA

Sanctum-style cookie session, or access JWT (5–15 min) + rotating refresh cookie. Never a week-long JWT in `localStorage`.

### 3. Mobile app

Short JWT access + refresh token stored in the **OS keychain**, not in random shared preferences if you can avoid it. Refresh rotation: reuse of an old refresh token kills the family.

### 4. Service to service

Do not invent a user session. Use **OAuth 2.0 client credentials**, mTLS, or a signed internal JWT with a 60-second TTL and a small audience (`aud`).

## A revocation design that does not lie

If product says "log out all devices," you need a server-side bit:

```text
users.token_version = 8
JWT claims: { sub: 42, ver: 8, exp: ... }
```

On password change, `ver++`. Old tokens still verify the signature, then fail the version check. That is a session field you look up — and that is fine. **Pure stateless JWT and instant global logout cannot both be true.**

A blocklist of `jti` until `exp` is the other honest option. At that point you are running a session store with extra steps. Use it when most requests can stay stateless and logout is rare.

## Common mistakes

1. Storing JWT in `localStorage` and calling it "more secure than sessions."
2. Putting secrets or PII in claims. JWTs are encoded, not encrypted, unless you use JWE (you probably do not).
3. Accepting tokens without checking `aud` and `iss`. A token minted for the blog API should not open the payroll API.
4. 30-day access tokens "so users are not annoyed." Use refresh tokens.
5. Mixing session cookies and JWT on the same response until nobody knows which one wins.

## How I choose

- **One website, one backend, cookies already work:** session.
- **Need to revoke, ban, or step-up auth (2FA):** session or JWT + server version/blocklist.
- **Many APIs, mobile clients, OAuth:** short JWT access tokens.
- **You want zero server state and instant logout:** pick one. You cannot have both.

Sessions and JWTs are not rival religions. A session id is an opaque token. A JWT is a self-describing token. **I default to a server-side session for browsers I own, and to short JWTs when the client is not a first-party cookie jar.**
