import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiKey = process.env.GEMINI_API_KEY;
const out = join(root, 'public', 'assets', 'img', 'hero-mark.png');
const reference = join(root, 'public', 'assets', 'img', 'profile-img.jpg');

if (!apiKey) {
  console.error('Set GEMINI_API_KEY in the environment. Do not commit the key.');
  process.exit(1);
}

const prompt = [
  'Create a square graphic design mark inspired by the attached photo. Do not reproduce the photograph.',
  'Style: flat vector mosaic built from a regular grid of colored squares, like a designed pixel icon or quilt, not a filtered photo.',
  'Subject: a simplified person — glasses, green beanie, tan jacket — standing in a horseshoe canyon.',
  'Background: stacked squares in terracotta, sand, rust, and muted sky gray. No photographic texture, no gradients that look like camera blur, no skin pores, no realistic fabric.',
  'Hard-edged squares with a thin dark gap between tiles. Readable at 200px.',
  'No text, no letters, no watermark, no logo, no frame, no circle crop.',
  '1:1 square composition, centered, bold, poster-like.',
].join(' ');

const models = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview', 'gemini-3.1-flash-image'];
const photo = await readFile(reference);

async function generateWithModel(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: photo.toString('base64'),
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '1:1' },
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
    model,
    text,
  };
}

let lastError;
for (const model of models) {
  try {
    const result = await generateWithModel(model);
    await writeFile(out, result.bytes);
    console.log(`Saved hero-mark.png via ${result.model} (${result.bytes.length} bytes)`);
    if (result.text) {
      console.log(`Model notes: ${result.text.slice(0, 300)}`);
    }
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.warn(error.message);
  }
}

throw lastError;
