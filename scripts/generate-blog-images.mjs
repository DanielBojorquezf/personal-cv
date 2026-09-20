import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'assets', 'img', 'blog');
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('Set GEMINI_API_KEY in the environment. Do not commit the key.');
  process.exit(1);
}

const style = [
  'Clean technical architecture diagram for a developer blog.',
  'Flat vector, high contrast, generous spacing, crisp readable labels in English.',
  'Color palette: navy #0B1B33, deep blue #173B6C, cyan #149DDD, off-white #F5F8FD, muted gray boxes.',
  'No photorealistic people, no 3D clay, no watermark, no fake logos that look trademarked.',
  'Short labels only. No paragraphs of text. 16:9 widescreen.',
].join(' ');

const images = [
  {
    file: 'websockets-vs-webhooks.png',
    prompt: `${style}
Split composition. Left title: WebSockets. Show a browser and a server with a persistent two-way arrow labeled Full-duplex. Right title: Webhooks. Show Service A sending a one-way HTTP POST to Service B labeled Event callback. Bottom caption: Push models.`,
  },
  {
    file: 'sessions-vs-jwt.png',
    prompt: `${style}
Split composition. Left title: Session. Browser cookie box labeled sid pointing to a Redis/server store that holds user 42. Right title: JWT. Browser holds a token card labeled header.payload.signature and the server only has a key icon. Arrow notes: revoke vs self-contained.`,
  },
  {
    file: 'forward-vs-reverse-proxy.png',
    prompt: `${style}
Two horizontal flows. Top: Clients -> Forward proxy -> Internet. Bottom: Users -> Reverse proxy -> App servers. Label Forward hides clients and Reverse hides origins. Simple boxes and arrows.`,
  },
  {
    file: 'kafka-rabbitmq-sqs.png',
    prompt: `${style}
Three columns. Kafka: partitioned log tape with offsets and two consumer groups. RabbitMQ: producer to exchange to two queues. SQS: producer to one queue to a worker, visibility timeout note. Title: Message backbones.`,
  },
  {
    file: 'oauth-2.png',
    prompt: `${style}
OAuth 2.0 authorization code flow as numbered boxes: User, Client app, Authorization server, Resource API. Arrows: 1 login, 2 consent, 3 code, 4 token swap, 5 API call with access token. Keep numbers large and readable.`,
  },
  {
    file: 'api-gateway-vs-load-balancer.png',
    prompt: `${style}
Split composition. Left title: Load balancer. Users to ALB to three healthy app instances. Right title: API gateway. Users to gateway with small badges Auth, Rate limit, Routes, then to Lambda or HTTP API. Make the jobs visually different.`,
  },
  {
    file: 'aws-architecture.png',
    prompt: `${style}
Left-to-right AWS request path with labeled boxes: User -> Route 53 -> CloudFront -> S3 static on one branch, and API Gateway or ALB on the other branch -> ECS / EC2 / Lambda. Private VPC note under compute. Title: From edge to compute.`,
  },
];

const models = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview', 'gemini-3.1-flash-image'];

async function generateWithModel(model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '16:9' },
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload.error?.message || JSON.stringify(payload);
    throw new Error(`${model}: ${message}`);
  }

  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data);
  const text = parts.map((part) => part.text).filter(Boolean).join('\n');

  if (!imagePart) {
    throw new Error(`${model}: no image in response. ${text || JSON.stringify(payload).slice(0, 400)}`);
  }

  return {
    bytes: Buffer.from(imagePart.inlineData.data, 'base64'),
    mime: imagePart.inlineData.mimeType || 'image/png',
    text,
  };
}

async function generate(prompt) {
  let lastError;

  for (const model of models) {
    try {
      const result = await generateWithModel(model, prompt);
      return { ...result, model };
    } catch (error) {
      lastError = error;
      console.warn(error.message);
    }
  }

  throw lastError;
}

await mkdir(outDir, { recursive: true });

for (const image of images) {
  console.log(`Generating ${image.file}...`);
  const result = await generate(image.prompt);
  const target = join(outDir, image.file);
  await writeFile(target, result.bytes);
  console.log(`Saved ${image.file} via ${result.model} (${result.bytes.length} bytes)`);
  if (result.text) {
    console.log(`Model notes: ${result.text.slice(0, 300)}`);
  }
}

console.log('Done.');
