---
title: "API Gateway vs Load Balancer: They Are Not Interchangeable"
description: "An ALB spreads traffic. An API gateway enforces the contract of an API. Here is when I use CloudFront, API Gateway, ALB, and NLB — and when stacking all of them is waste."
pubDate: 2026-09-18
lang: en
translationKey: api-gateway-vs-load-balancer
category: aws
tags:
  - api-gateway
  - load-balancer
  - alb
  - nlb
heroImage: /assets/img/blog/api-gateway-vs-load-balancer.svg
heroImageAlt: Diagram contrasting a load balancer distributing connections with an API gateway handling routes, auth, and rate limits
---

A **load balancer** answers: *which healthy instance should handle this connection?* An **API gateway** answers: *is this request allowed to become a call to that backend, and in what shape?*

On AWS the words get muddy because **API Gateway**, **Application Load Balancer (ALB)**, **Network Load Balancer (NLB)**, and **CloudFront** can all sit on the left side of a diagram. I have seen teams put API Gateway in front of an ALB in front of one ECS service and then wonder why the bill and the latency grew. Sometimes that stack is correct. Often the ALB was enough.

## Load balancer first

### NLB (Layer 4)

TCP/UDP. It does not read your HTTP path. It is fast, static-IP friendly, and the right tool for:

- MQTT, game servers, custom TCP
- Bringing Elastic IPs / PrivateLink to a service
- Extreme throughput with almost no features

If you need "route `/v1/users` to service A," NLB will not do that.

### ALB (Layer 7)

HTTP/HTTPS. Host rules, path rules, gRPC, WebSockets, OIDC authenticate *at the balancer*, redirects, and target groups (ECS, EC2, Lambda, IPs).

This is the default public front door for a containerized website or a classic JSON API on ECS/EC2.

```text
User -> ALB (TLS) -> target group: ECS service "api" (port 8000)
                  -> target group: ECS service "admin" (host admin.example.com)
```

Health checks take bad tasks out of rotation. That is load balancing.

## API gateway first

An API gateway is an **HTTP application proxy with an API product mindset**:

- Routes and methods (`POST /payments`)
- AuthN/Z: IAM, Cognito JWT, API keys, custom Lambda authorizers
- Rate limits and usage plans
- Request/response mapping and validation
- API versions (`/v1`, `/v2`)
- Canary releases
- Direct integration with Lambda, HTTP, or AWS services (SQS, Kinesis, Step Functions)

**Amazon API Gateway** is that product. Kong, Gravitee, Tyk, and Nginx plus a lot of Lua are the same idea off-AWS.

It is not trying to be the best L4 spreader across 80 EC2 boxes. You *can* point API Gateway at an ALB/NLB (HTTP integration or VPC link). That is a composition, not a synonym.

## A concrete AWS choice

### Case 1 — Laravel on ECS, browser + mobile, one API

**ALB -> ECS.**  
ACM certificate on the ALB (or on CloudFront). Path `/` can even go to another target if you still serve a monolith.

API Gateway adds little if you already check Sanctum/JWT in Laravel and you do not sell API keys to third parties.

### Case 2 — Many Lambdas, third-party developers, per-key quotas

**API Gateway -> Lambda** (or -> SQS).  
Usage plans, API keys, throttling, a generated SDK, and a stage per environment. This is the product AWS built API Gateway for.

### Case 3 — WebSockets at scale

API Gateway has a **WebSocket API**. ALB also forwards WebSockets to ECS. If you already run a socket process (Node, Swoole, Reverb), ALB is simpler. If you want connection handling as a managed service and Lambdas on `$connect` / messages, API Gateway WebSocket is the managed path.

### Case 4 — TLS passthrough to a database proxy or MQTT

**NLB.** Neither API Gateway nor ALB is the star.

## Comparison

| | ALB / typical LB | API Gateway |
| --- | --- | --- |
| Main job | Spread and health-check | Front an API product |
| Layer | L4 (NLB) or L7 (ALB) | L7 + policy |
| Auth | Optional OIDC at ALB; usually in the app | First-class (JWT, IAM, keys, Lambda auth) |
| Rate limit | WAF / app / CloudFront | Native usage plans, throttles |
| Transforms | Limited | Mapping templates, validators |
| WebSockets | Yes (ALB -> app) | Yes (managed WS API) |
| Long requests | Fine (watch idle timeout) | REST has integration timeouts (~29s on HTTP APIs/REST) |
| Cost model | Hours + LCU | Per request (+ cache) |
| Best backend | ECS, EC2, long-lived processes | Lambda, HTTP backends, AWS services |
| Cold start | No | If the integration is Lambda, yes |

That **29-second** integration timeout is the one that bites people who put API Gateway in front of a "generate a 40-page PDF" Laravel route. For long work: return 202, put a job on SQS, poll or webhook the result.

## Pros and cons

### Load balancer (ALB/NLB)

**Pros**

- Simple mental model. Healthy targets get traffic.
- Cheap and predictable for steady ECS/EC2.
- Native WebSockets, long uploads, HTTP/2, gRPC (ALB).
- One ALB can host many hostnames and path rules.
- Private ALBs for internal microservices.

**Cons**

- Not a developer portal. No usage plans for partners.
- JWT validation is not its core product (ALB OIDC is for *login*, not fine-grained API keys).
- You still write CORS, validation, and versioning in the app or in CloudFront/WAF.
- NLB will happily forward garbage TCP. Features are not protection.

### API Gateway

**Pros**

- Auth, throttle, and routing without putting that code in every Lambda.
- Clean pairing with serverless.
- REST and HTTP APIs: HTTP API is cheaper/faster for JWT + simple proxy.
- Can front SQS so clients POST and you do not expose the queue.
- Central access logs for an API estate.

**Cons**

- Latency and cost per request add up in front of a busy monolith.
- REST API mapping templates are a language you will forget.
- Timeouts and payload limits (10 MB order of magnitude) are not "unlimited PHP."
- VPC links and private integrations have a learning tax.
- Using it only as a dumb reverse proxy is an expensive Nginx.

## CloudFront sits above both

CloudFront is a **CDN + reverse proxy**. It can:

- Serve the Astro CV from S3
- Cache `GET /api/public-stats`
- Terminate TLS at the edge
- Put WAF in front of **either** an ALB or API Gateway

A pattern I like for a marketing site + API:

```text
User -> Route 53 -> CloudFront
                      /        -> S3 (this blog)
                      /api/*   -> ALB -> ECS
```

or `/api/*` -> API Gateway -> Lambda.

CloudFront is not a substitute for ALB health checks. It is the edge.

## Common mistakes

1. API Gateway in front of one ECS service that already has an ALB, no partner APIs, no Lambdas — just extra hop and extra bill.
2. ALB-only when you are selling an API with keys and quotas. You will rebuild a gateway in PHP.
3. Forgetting ALB idle timeout (default 60s) for file uploads or SSE.
4. Putting NLB in front of HTTP just to look low-level.
5. Using API Gateway REST mapping to "fix" a bad backend contract forever. Eventually the template *is* the backend.

## How I choose

- **Website or long-lived API on ECS/EC2:** ALB. Add CloudFront if you care about TLS at the edge, WAF, or static assets.
- **Serverless APIs, partner keys, per-route throttle:** API Gateway.
- **TCP, static IP, PrivateLink:** NLB.
- **Need both worlds:** CloudFront or API Gateway in front, ALB in the private subnet, ECS behind the ALB. Draw the hop and write down *why it exists*.

A load balancer is plumbing. A gateway is a product surface. **If you are not exposing a productized API, start with a load balancer.** You can always put a gateway in front later. Doing it the other way around is how a blog and a contact form inherit a 29-second timeout and a per-request tax.
