---
title: "API Gateway vs load balancer: no son intercambiables"
description: "Un ALB reparte tráfico. Un API gateway hace cumplir el contrato de una API. Cuándo uso CloudFront, API Gateway, ALB y NLB — y cuándo apilarlos todos es desperdicio."
pubDate: 2026-09-18
lang: es
translationKey: api-gateway-vs-load-balancer
category: aws
tags:
  - api-gateway
  - load-balancer
  - alb
  - nlb
heroImage: /assets/img/blog/api-gateway-vs-load-balancer-es.svg
heroImageAlt: Diagrama que contrasta un load balancer repartiendo conexiones con un API gateway manejando rutas, auth y rate limits
---

Un **load balancer** responde: *¿qué instancia sana debe atender esta conexión?* Un **API gateway** responde: *¿este request tiene permiso de convertirse en una llamada a ese backend, y en qué forma?*

En AWS las palabras se nublan porque **API Gateway**, **ALB**, **NLB** y **CloudFront** pueden sentarse a la izquierda del diagrama. He visto equipos poner API Gateway frente a un ALB frente a un solo servicio de ECS y luego preguntarse por qué crecieron la cuenta y la latencia. A veces ese stack está bien. Muchas veces el ALB alcanzaba.

## Primero el load balancer

### NLB (capa 4)

TCP/UDP. No lee tu path HTTP. Es rápido, amigo de IPs estáticas, y el tool correcto para MQTT, game servers, TCP custom, Elastic IPs / PrivateLink. Si necesitas "rutea `/v1/users` al servicio A", el NLB no lo va a hacer.

### ALB (capa 7)

HTTP/HTTPS. Reglas de host y path, gRPC, WebSockets, OIDC en el balancer, redirects y target groups (ECS, EC2, Lambda, IPs).

Es la puerta pública default para un sitio en contenedores o una API JSON clásica en ECS/EC2.

```text
Usuario -> ALB (TLS) -> target group: ECS "api"
                     -> target group: ECS "admin" (host admin.example.com)
```

Los health checks sacan tasks malas de rotación. Eso es load balancing.

## Primero el API gateway

Un API gateway es un **proxy HTTP de aplicación con cabeza de producto de API**:

- Rutas y métodos (`POST /payments`)
- AuthN/Z: IAM, JWT de Cognito, API keys, Lambda authorizers
- Rate limits y usage plans
- Mapping y validación
- Versiones (`/v1`, `/v2`)
- Canaries
- Integración directa con Lambda, HTTP o servicios AWS (SQS, Kinesis, Step Functions)

**Amazon API Gateway** es ese producto. Kong, Tyk y Nginx con mucha Lua son la misma idea fuera de AWS.

No intenta ser el mejor spreader L4 entre 80 EC2. *Puedes* apuntar API Gateway a un ALB/NLB. Eso es composición, no un sinónimo.

## Una elección concreta en AWS

**Caso 1 — Laravel en ECS, browser + móvil, una API:** **ALB -> ECS.** API Gateway aporta poco si ya checas Sanctum/JWT en Laravel y no vendes API keys a terceros.

**Caso 2 — Muchas Lambdas, developers de terceros, cuotas por key:** **API Gateway -> Lambda**. Usage plans, API keys, throttle, un SDK generado.

**Caso 3 — WebSockets a escala:** API Gateway tiene WebSocket API. El ALB también reenvía WebSockets a ECS. Si ya corres un proceso de sockets, el ALB es más simple.

**Caso 4 — TLS passthrough a un proxy de DB o MQTT:** **NLB.**

## Comparación

| | ALB / LB típico | API Gateway |
| --- | --- | --- |
| Trabajo | Repartir y health-check | Frente de un producto de API |
| Capa | L4 (NLB) o L7 (ALB) | L7 + política |
| Auth | OIDC opcional en ALB; normalmente en la app | De primera (JWT, IAM, keys) |
| Rate limit | WAF / app / CloudFront | Usage plans nativos |
| WebSockets | Sí (ALB -> app) | Sí (WS API administrada) |
| Requests largos | Bien (cuida idle timeout) | Timeout de integración ~29s |
| Costo | Horas + LCU | Por request |
| Mejor backend | ECS, EC2, procesos largos | Lambda, HTTP, servicios AWS |

Ese timeout de **29 segundos** muerde a quien pone API Gateway frente a un "genera un PDF de 40 páginas" en Laravel. Para trabajo largo: 202, job en SQS, poll o webhook del resultado.

## Pros y contras

**ALB/NLB.** Pros: modelo simple; barato y predecible para ECS/EC2 estable; WebSockets, uploads largos, HTTP/2, gRPC; un ALB hospeda muchos hostnames. Contras: no es un developer portal; no hay usage plans para partners; CORS, validación y versionado siguen en la app.

**API Gateway.** Pros: auth, throttle y routing sin meter ese código en cada Lambda; pareja limpia con serverless; HTTP API es más barata/rápida para JWT + proxy simple; puede poner SQS atrás para que el cliente haga POST sin ver la cola. Contras: latencia y costo por request frente a un monolito ocupado; los mapping templates de REST son un idioma que vas a olvidar; límites de payload; usarlo solo como reverse proxy tonto es un Nginx caro.

## CloudFront se sienta arriba de los dos

CloudFront es un **CDN + reverse proxy**. Puede servir este CV desde S3, cachear `GET /api/public-stats`, terminar TLS en el edge y poner WAF frente a un ALB o a API Gateway.

Un patrón que me gusta para sitio + API:

```text
Usuario -> Route 53 -> CloudFront
                         /        -> S3 (este blog)
                         /api/*   -> ALB -> ECS
```

CloudFront no sustituye los health checks del ALB. Es el edge.

## Errores comunes

1. API Gateway frente a un solo ECS que ya tiene ALB, sin APIs de partners ni Lambdas: hop extra y cuenta extra.
2. Solo ALB cuando vendes una API con keys y cuotas. Vas a reconstruir un gateway en PHP.
3. Olvidar el idle timeout del ALB (60s por default) para uploads o SSE.
4. Poner NLB frente a HTTP solo para verse low-level.
5. Usar mapping templates de REST para "arreglar" un contrato malo para siempre.

## Cómo elijo

- **Sitio o API de vida larga en ECS/EC2:** ALB. CloudFront si te importa TLS en el edge, WAF o estáticos.
- **APIs serverless, keys de partners, throttle por ruta:** API Gateway.
- **TCP, IP estática, PrivateLink:** NLB.
- **Los dos mundos:** CloudFront o Gateway enfrente, ALB en subnet privada, ECS atrás. Dibuja el hop y escribe *por qué existe*.

Un load balancer es plomería. Un gateway es superficie de producto. **Si no estás exponiendo una API productizada, empieza con un load balancer.** El gateway lo puedes poner después. Al revés es cómo un blog y un formulario de contacto heredan un timeout de 29 segundos y un impuesto por request.
