---
title: "WebSockets vs Webhooks: Push Data the Right Way"
description: "When a payment, a WhatsApp message, or a live dashboard needs an update, the choice is usually WebSocket or webhook. Here is how I pick, scale, and fail each one."
pubDate: 2026-09-08
lang: en
translationKey: websockets-vs-webhooks
category: backend
tags:
  - websockets
  - webhooks
  - realtime
  - events
heroImage: /assets/img/blog/websockets-vs-webhooks.svg
heroImageAlt: Diagram comparing a persistent WebSocket connection with one-way webhook HTTP callbacks
---

Both tools "push" events. That is where the similarity ends. A **WebSocket** is a long-lived, full-duplex connection. A **webhook** is a normal HTTP request your system sends (or receives) when something happens. If you treat them as interchangeable, you will overbuild a chat stack for a Stripe event, or you will poll a webhook inbox trying to animate a live map.

I use this rule: **if the browser or a connected client must see state change in the next 100ms, start with WebSockets. If another server must react to a business event, start with webhooks.**

## What each one actually is

### WebSockets

The client opens an HTTP request, then upgrades it (`101 Switching Protocols`). After that, either side can send frames at any time. There is no request/response pairing unless you invent it.

That gives you:

- Low latency
- Server-to-client *and* client-to-server messages
- Presence ("user is online")
- Less HTTP overhead than polling every second

It also gives you operational pain: sticky sessions, idle timeouts, reconnect storms, and a process that must stay in memory holding sockets.

### Webhooks

A webhook is "HTTP as an event bus." Provider A POSTs JSON to a URL you own. You verify a signature, persist the event, and return `2xx` quickly.

That gives you:

- Loose coupling between systems
- No open connection to maintain
- Easy retries, dead-letter queues, and audit logs
- A model every backend already knows: receive HTTP, write to DB, enqueue work

It is **at-least-once** in the real world. Timeouts, retries, and "I got 200 but crashed after" are normal. Design for duplicates.

## A concrete example from a product I would actually ship

Imagine a support inbox that talks to WhatsApp and also shows agents a live board.

1. **Meta/WhatsApp -> your API** is a webhook. WhatsApp will not hold a socket to your Laravel box. It POSTs `messages` to `https://api.yourapp.com/webhooks/whatsapp`. You verify `X-Hub-Signature-256`, store the payload, enqueue `ProcessWhatsAppMessage`, and return `200` in under a second.
2. **Your API -> the agent UI** is a WebSocket. The agent has the inbox open. When the job finishes, you publish `conversation.updated` on a channel like `inbox.{agentId}`. The browser paints the new bubble without refresh.
3. **Your API -> billing** is a webhook again. If Finance runs a separate service, POST `conversation.closed` to their URL. Do not open a socket into another team's VPC unless you enjoy on-call.

Same product, three pushes, two tools. That mix is the point.

Payments look the same. Stripe `payment_intent.succeeded` is a webhook. The checkout page waiting for "Payment confirmed" can be a short poll, a webhook-driven redirect, or a WebSocket/SSE push. I almost never WebSocket Stripe itself.

## Side-by-side

| | WebSockets | Webhooks |
| --- | --- | --- |
| Direction | Both ways, while connected | One HTTP call per event |
| Transport | Persistent TCP after upgrade | Stateless HTTP |
| Typical client | Browser, mobile app, game client | Another server |
| Delivery | Best-effort while connected; you handle replay | Provider retries; you make it idempotent |
| Scaling pain | Connections, fan-out, sticky routing | Burst POSTs, signature verify, slow handlers |
| Auth | Ticket/JWT on connect, then a live session | HMAC signature, mTLS, IP allowlists |
| Good fit | Chat, collab cursors, live ops dashboards | Payments, CRM sync, CI status, WhatsApp |

## Pros and cons

### WebSockets

**Pros**

- True realtime. No 2–5s poll lag.
- Client can send as cheaply as the server. Typing indicators, cursor moves, cancel buttons.
- One connection can carry many event types.

**Cons**

- Every socket is memory and a file descriptor. 50k connections is an architecture problem, not a library problem.
- Load balancers must support idle timeouts and **sticky sessions** (or you put a pub/sub like Redis behind every node).
- Mobile networks drop connections. You need heartbeat, resume, and backoff.
- Firewalls and some corporate proxies murder long-lived upgrades. Have a fallback (SSE or short poll).
- Horizontal scale means **you do not publish only in-process**. Node A holds the socket; Node B handled the webhook. They meet in Redis, NATS, or a managed pub/sub.

### Webhooks

**Pros**

- Simple operations. Nginx + PHP-FPM or a Lambda can take them.
- Natural audit trail: store the raw body, replay it later.
- Providers already implement retries (Stripe, GitHub, Meta).
- Easy to secure with signatures. No connection inventory.

**Cons**

- Not interactive. You cannot "ask the other side a question" on the same channel.
- Latency is "seconds, sometimes minutes" when the provider backs off.
- You must expose a public HTTPS URL. Localhost needs a tunnel in development.
- Duplicate events will happen. If you increment a balance twice, that is on you.
- A slow handler (`call another API inside the controller`) makes the provider retry and you double-process.

## How I implement each one

### Webhook handler (the shape I want)

```js
// POST /webhooks/stripe
export async function stripeWebhook(req, res) {
  const event = verifyStripeSignature(req); // throws if bad
  const inserted = await db.events.putIfAbsent(event.id, event);

  if (!inserted) {
    return res.status(200).send('duplicate');
  }

  await queue.add('stripe-event', { id: event.id });
  return res.status(200).send('ok');
}
```

Keywords I care about in review: **idempotency key**, **signature**, **raw body** (not a parsed-then-reserialized JSON), **ack fast**, **work async**.

Never do this in the request:

- Send email
- Call WhatsApp
- Generate a PDF
- Wait on a lock in Redis for 8 seconds

Return 200, then work. If work fails, the job retries. If you return 500 because the job failed, Stripe retries *and* you may already have side effects.

### WebSocket handler (the shape I want)

```js
io.use(async (socket, next) => {
  const user = await authFromTicket(socket.handshake.auth.token);
  if (!user) return next(new Error('unauthorized'));
  socket.data.userId = user.id;
  next();
});

io.on('connection', (socket) => {
  socket.join(`user.${socket.data.userId}`);
});

// after a webhook job
async function notifyPayment(userId, payload) {
  await redis.publish('ws', JSON.stringify({
    room: `user.${userId}`,
    event: 'payment.updated',
    payload,
  }));
}
```

The important part is not Socket.IO. It is **auth on connect**, **rooms**, and **a bus between app servers**. If you `io.to(room).emit()` only on the box that processed the webhook, most users will see nothing in production.

## Common mistakes

1. **Using WebSockets as a database.** The socket is a pipe. The source of truth is Postgres (or whatever you already trust). On reconnect, the client asks "what is the conversation since `cursor`?"
2. **Trusting a webhook without a signature.** Anyone who finds `/webhooks/stripe` will POST a fake `payment_intent.succeeded`.
3. **Parsing the body before verifying HMAC.** Use the raw bytes Stripe signed.
4. **Opening a WebSocket from server to server** for business events. That is a custom message bus with worse tooling than SQS.
5. **Forgetting webhook timeouts.** If your endpoint needs 15s, the provider already retried.

## How I choose

- **Stripe, PayPal, GitHub, Meta, Mercado Pago:** webhook.
- **Agent inbox, live map, auction bid, collaborative editor:** WebSocket (or SSE if the client only listens).
- **Need both:** webhook in, fan-out to sockets out. That is the WhatsApp example.
- **Need "notify a user who might be offline":** webhook/job + push notification + email. A socket cannot wake a closed laptop.

If you only remember one sentence: **WebSockets are a conversation. Webhooks are a certified letter.** Use the letter for money and integrations. Use the conversation for people staring at a screen.
