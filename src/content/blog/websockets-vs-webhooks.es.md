---
title: "WebSockets vs webhooks: empuja los datos de la forma correcta"
description: "Cuando un pago, un mensaje de WhatsApp o un tablero en vivo necesitan actualizarse, casi siempre eliges WebSocket o webhook. Así es como los elijo, los escalo y cómo fallan."
pubDate: 2026-09-08
lang: es
translationKey: websockets-vs-webhooks
category: backend
tags:
  - websockets
  - webhooks
  - realtime
  - eventos
heroImage: /assets/img/blog/websockets-vs-webhooks-es.svg
heroImageAlt: Diagrama que compara una conexión persistente de WebSocket con callbacks HTTP de webhook
---

Las dos herramientas "empujan" eventos. Ahí se acaba el parecido. Un **WebSocket** es una conexión larga y full-duplex. Un **webhook** es un HTTP normal que tu sistema envía (o recibe) cuando pasa algo. Si los tratas como si fueran lo mismo, vas a armar un stack de chat para un evento de Stripe, o vas a estar haciendo poll a un inbox de webhooks para animar un mapa en vivo.

Mi regla: **si el navegador o un cliente conectado tiene que ver el cambio en los siguientes 100 ms, empieza con WebSockets. Si otro servidor tiene que reaccionar a un evento de negocio, empieza con webhooks.**

## Qué es cada uno

### WebSockets

El cliente abre HTTP y luego hace upgrade (`101 Switching Protocols`). Después, cualquiera de los dos lados puede mandar frames cuando quiera. No hay request/response a menos que tú lo inventes.

Te da baja latencia, mensajes en ambos sentidos, presencia ("el usuario está en línea") y menos overhead que un poll cada segundo. También te da dolor operativo: sticky sessions, timeouts de idle, tormentas de reconnect y un proceso que tiene que quedarse en memoria sosteniendo sockets.

### Webhooks

Un webhook es "HTTP como bus de eventos". El proveedor A hace POST de JSON a una URL tuya. Tú verificas la firma, guardas el evento y regresas `2xx` rápido.

Te da bajo acoplamiento, cero conexiones abiertas, reintentos, dead-letter queues y una bitácora fácil. El modelo ya lo conoce cualquier backend: recibir HTTP, escribir en DB, encolar trabajo.

En la vida real es **at-least-once**. Timeouts, reintentos y "regresé 200 pero crasheé después" son normales. Diseña para duplicados.

## Un ejemplo de producto que sí sacaría

Imagina un inbox de soporte que habla con WhatsApp y también le muestra a los agentes un tablero en vivo.

1. **Meta/WhatsApp -> tu API** es webhook. WhatsApp no te va a mantener un socket a tu caja de Laravel. Hace POST a `https://api.tusitio.com/webhooks/whatsapp`. Verificas `X-Hub-Signature-256`, guardas el payload, encolas `ProcessWhatsAppMessage` y regresas `200` en menos de un segundo.
2. **Tu API -> la UI del agente** es WebSocket. El agente tiene el inbox abierto. Cuando el job termina, publicas `conversation.updated` en un canal `inbox.{agentId}`. El navegador pinta el globo sin refresh.
3. **Tu API -> billing** otra vez es webhook. Si Finanzas corre otro servicio, haz POST de `conversation.closed` a su URL. No abras un socket hacia el VPC de otro equipo.

Mismo producto, tres pushes, dos herramientas. Ese mix es el punto.

Los pagos se ven igual. `payment_intent.succeeded` de Stripe es webhook. La página de checkout esperando "Pago confirmado" puede ser un poll corto, un redirect o un push por WebSocket/SSE. Casi nunca le abro WebSocket a Stripe.

## Comparación

| | WebSockets | Webhooks |
| --- | --- | --- |
| Dirección | Ambos lados, mientras haya conexión | Un HTTP por evento |
| Transporte | TCP persistente después del upgrade | HTTP sin estado |
| Cliente típico | Navegador, app móvil | Otro servidor |
| Entrega | Best-effort mientras está conectado | El proveedor reintenta; tú lo haces idempotente |
| Dolor al escalar | Conexiones, fan-out, routing sticky | Ráfagas de POST, firmas, handlers lentos |
| Auth | Ticket/JWT al conectar | Firma HMAC, mTLS, allowlist de IPs |
| Encaja en | Chat, cursores, dashboards en vivo | Pagos, sync de CRM, CI, WhatsApp |

## Pros y contras

### WebSockets

**Pros:** realtime de verdad; el cliente también puede enviar barato; una conexión carga muchos tipos de evento.

**Contras:** cada socket es memoria y un file descriptor. El load balancer necesita timeouts de idle y **sticky sessions** (o un pub/sub como Redis atrás de cada nodo). Las redes móviles se caen: heartbeat, resume y backoff. Algunos proxies corporativos matan el upgrade. Y si el webhook lo atendió el nodo B, el emit in-process en el nodo A no le llega a nadie.

### Webhooks

**Pros:** operación simple. Nginx + PHP-FPM o una Lambda los aguantan. Bitácora natural: guarda el body crudo y reprocesa. Los proveedores ya traen reintentos. Fácil de firmar.

**Contras:** no es interactivo. La latencia a veces es de minutos si el proveedor hace backoff. Necesitas una URL HTTPS pública. Los eventos duplicados van a pasar. Un handler lento (`llamar a otra API dentro del controller`) provoca reintentos y doble proceso.

## Cómo los implemento

### Webhook

```js
export async function stripeWebhook(req, res) {
  const event = verifyStripeSignature(req);
  const inserted = await db.events.putIfAbsent(event.id, event);
  if (!inserted) return res.status(200).send('duplicate');
  await queue.add('stripe-event', { id: event.id });
  return res.status(200).send('ok');
}
```

En review me importan: **idempotency key**, **firma**, **raw body**, **ack rápido**, **trabajo async**. No mandes email ni generes un PDF en el request.

### WebSocket

```js
io.use(async (socket, next) => {
  const user = await authFromTicket(socket.handshake.auth.token);
  if (!user) return next(new Error('unauthorized'));
  socket.data.userId = user.id;
  next();
});
```

Lo importante no es Socket.IO. Es **auth al conectar**, **rooms** y **un bus entre servidores**.

## Errores comunes

1. Usar el WebSocket como base de datos. La fuente de verdad es Postgres.
2. Confiar un webhook sin firma.
3. Parsear el JSON antes de verificar el HMAC.
4. Abrir un WebSocket de servidor a servidor para eventos de negocio.
5. Olvidar los timeouts del proveedor.

## Cómo elijo

- **Stripe, PayPal, GitHub, Meta, Mercado Pago:** webhook.
- **Inbox de agentes, mapa en vivo, subasta, editor colaborativo:** WebSocket (o SSE si el cliente solo escucha).
- **Necesitas los dos:** webhook de entrada, fan-out a sockets de salida.
- **Avisar a alguien que puede estar offline:** job + push + email. Un socket no despierta una laptop cerrada.

Si te quedas con una frase: **los WebSockets son una conversación. Los webhooks son una carta certificada.** Usa la carta para el dinero y las integraciones. Usa la conversación para la gente que está viendo una pantalla.
