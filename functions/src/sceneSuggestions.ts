// functions/src/sceneSuggestions.ts
import * as functions from 'firebase-functions';
import type { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const suggestScene = functions
  .region('us-central1')
  .runWith({ secrets: ['GEMINI_API_KEY'], timeoutSeconds: 60, memory: '256MB' })
  .https.onRequest(async (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      const b = (req.body ?? {}) as any;
      const language = String(b.language || 'en').slice(0, 5);
      const title    = String(b.title || 'Untitled').slice(0, 120);
      const synopsis = String(b.synopsis || '').slice(0, 2000);
      const genres   = Array.isArray(b.genres) ? b.genres.map((g: any) => String(g)).slice(0, 8) : [];
      const idx      = Number.isFinite(b.sceneIndex) ? Number(b.sceneIndex) : 1;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'Secret GEMINI_API_KEY not found at runtime' });
        return;
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = buildPrompt({ language, title, synopsis, genres, idx });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
        },
      });

      const text = result?.response?.text?.() || '';
      if (!text) throw new Error('Model returned empty response');

      const cleaned = text.replace(/```json|```/gi, '').trim();
      let json: any;
      try {
        json = JSON.parse(cleaned);
      } catch {
        const m = cleaned.match(/\{[\s\S]*\}$/);
        if (!m) throw new Error('Invalid JSON from model');
        json = JSON.parse(m[0]);
      }

      const out = {
        storyText: String(json?.storyText || '').trim(),
        imagePrompt: String(json?.imagePrompt || '').trim(),
      };
      if (!out.storyText || !out.imagePrompt) {
        throw new Error('Incomplete model response (expected storyText & imagePrompt)');
      }

      res.status(200).json(out);
    } catch (e: any) {
      console.error('[suggestScene] error:', e?.stack || e);
      res.status(500).json({ error: e?.message || 'Internal error' });
    }
  });

function buildPrompt({
  language, title, synopsis, genres, idx,
}: { language: string; title: string; synopsis: string; genres: string[]; idx: number; }) {
  const langName = language.startsWith('es') ? 'Spanish' : 'English';
  const genresStr = genres.length ? genres.join(', ') : 'Any';
  return `
You are a professional story developer and visual director.

Write the output strictly in ${langName}.
Return JSON ONLY. No commentary, no Markdown, no code fences.

Story context:
- Title: ${title}
- Genres: ${genresStr}
- Synopsis: ${synopsis || '(none)'}

Task for SCENE #${idx}:
1) "storyText": one vivid paragraph (70–120 words), self-contained, suitable for narration.
2) "imagePrompt": a single concise illustration prompt (no text overlay).

Return exactly:
{
  "storyText": "<paragraph>",
  "imagePrompt": "<one-sentence prompt>"
}
`.trim();
}
