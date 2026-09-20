---
title: "Forward proxy vs reverse proxy: la misma palabra, trabajos opuestos"
description: "Un forward proxy esconde clientes. Un reverse proxy esconde servidores. Nginx, Cloudflare, Squid y el firewall de la oficina tienen más sentido cuando esa flecha queda clara."
pubDate: 2026-09-12
lang: es
translationKey: forward-proxy-vs-reverse-proxy
category: devops
tags:
  - proxy
  - nginx
  - networking
  - tls
heroImage: /assets/img/blog/forward-vs-reverse-proxy-es.svg
heroImageAlt: Diagrama de un forward proxy frente a los clientes y un reverse proxy frente a los servidores
---

La gente dice "el proxy" como si hubiera uno. Hay dos flechas.

Un **forward proxy** se sienta frente a los **clientes**. Internet ve al proxy, no a la laptop. Un **reverse proxy** se sienta frente a los **servidores**. El cliente cree que habla con `api.example.com`; habla con Nginx, Cloudflare o un ALB, y ese elige la caja.

Si recuerdas solo la audiencia, dejas de mezclarlos: **forward protege o controla el tráfico de salida. Reverse protege o enruta los servicios de entrada.**

## Forward proxy

```text
Browser / scraper / Lambda  ->  Forward proxy  ->  target.com
```

El cliente se configura para usarlo (`HTTPS_PROXY=...`). El sitio destino no sabe que desplegaste un proxy. Solo ve una IP de egress.

Lo uso para:

- Egress de oficina o VPN: todo el HTTP pasa por una puerta revisada (Squid, Zscaler).
- Scrapers: rotar o fijar IPs de salida.
- Hablar con un partner que tiene allowlist de **tu** IP. Cinco app servers, un proxy de egress, una sola IP.
- Debug local: Charles, mitmproxy, Fiddler.

El cliente tiene que cooperar (settings, PAC o intercepto en el firewall).

## Reverse proxy

```text
Usuario  ->  Reverse proxy (Nginx / CloudFront / ALB)  ->  app:3000 / PHP-FPM / contenedor
```

El usuario nunca configura un proxy. El DNS de tu dominio apunta al proxy. El proxy termina TLS, a veces cachea, y luego manda al origin.

Esto ya lo tienes si corres Nginx frente a Laravel, Traefik frente a Docker, CloudFront frente a S3 + API, o un ALB frente a ECS.

El origin puede vivir en una subnet privada. Esa es la ganancia de seguridad.

## El mismo producto, los dos proxies

Un SaaS de scraping que yo diseñaría:

1. Los usuarios pegan a `https://app.saas.com` — **reverse proxy** (CloudFront + ALB).
2. Los workers piden `https://shop.example` — pool de **forward proxy** para que las tiendas vean una IP estable o rotativa.

Si alguien dice "ponle un proxy enfrente", pregunta **de qué lado del request**.

## Comparación

| | Forward proxy | Reverse proxy |
| --- | --- | --- |
| Se sienta frente a | Clientes | Servidores |
| Quién lo configura | El cliente o la red corporativa | Tú, con DNS y el edge |
| Esconde | IPs de usuario | IPs, puertos y topología del origin |
| Software típico | Squid, Tinyproxy, mitmproxy | Nginx, HAProxy, Traefik, CloudFront, ALB |
| TLS | Casi siempre túnel CONNECT | Normalmente termina TLS de tu dominio |
| Caché | Puede cachear GETs de salida | CDN / caché de origin |
| Si muere | Los usuarios no salen a internet | Los usuarios no llegan a tu app |

## Pros y contras

**Forward.** Pros: un solo lugar para loguear, bloquear y permitir salida; IP central para allowlists; útil para scrapers y para aislar Lambda/ECS de internet crudo. Contras: hay que configurar clientes; la inspección TLS rompe certificate pinning; el proxy se vuelve un cuello de botella; si queda abierto al mundo sin auth, eres botnet.

**Reverse.** Pros: TLS en un solo lugar; routing por path (`/` al sitio Astro, `/api` a Laravel, `/ws` a sockets); escondes `172.18.0.12:8080`; sumas gzip, HTTP/2, rate limits, WAF y canaries sin reescribir la app. Contras: si mal configuraste `X-Forwarded-For`, o logueas la IP del proxy o le crees a una IP spoofeada; WebSockets y uploads largos piden timeouts y headers `Upgrade`; cachear POST o `Set-Cookie` crea tickets de "logins fantasma".

## Nginx como reverse proxy

```nginx
server {
  listen 443 ssl http2;
  server_name api.example.com;
  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Por eso existen `URL::forceScheme('https')` y `TrustProxies` en Laravel. Sin ellos, los links de reset de password salen como `http://127.0.0.1`.

## Un forward proxy para workers

```bash
export HTTPS_PROXY=http://egress.internal:3128
curl https://partner.example/v1/orders
```

`NO_PROXY` importa. Si por accidente proxificas el metadata de AWS o tu RDS, tienes loops y timeouts raros.

## Palabras que conviene no mezclar

- **TLS termination:** el reverse proxy descifra HTTPS.
- **CONNECT:** el forward proxy hace túnel de HTTPS sin leerlo (salvo que intercepte).
- **SNI:** el proxy ve el hostname aunque el payload vaya cifrado.
- **Sticky session:** el reverse proxy pega un cliente a un origin. Sirve para sesiones en memoria y muchos WebSockets.
- **WAF:** casi siempre en el reverse proxy / CDN.
- **Egress:** territorio del forward proxy.

## Errores comunes

1. Llamarle forward proxy a CloudFront. Es reverse (más un caché).
2. Exponer Nginx en `0.0.0.0:80` en un EC2 público y decir que la app es "privada".
3. Creerle a `X-Forwarded-For` desde internet. Solo confía en la IP *de tu* proxy.
4. Olvidar los headers de upgrade de WebSocket y echarle la culpa a Socket.IO.
5. Dejar un Squid sin auth "nada más para el equipo" en una NIC pública.

## Cómo elijo

- **Usuarios pegándole a mi sitio o API:** reverse proxy. Siempre. No expongo PHP-FPM o Node al mundo.
- **Mis servidores saliendo a internet con política o IP fija:** forward proxy.
- **Debug local de la API de alguien más:** forward proxy (mitmproxy).
- **CDN, WAF, TLS, routing por path:** reverse proxy.

Si la caja finge ser el **cliente**, es forward. Si finge ser el **sitio**, es reverse. Dibuja la flecha una vez y las herramientas se vuelven aburridas — que es lo que quieres en producción.
