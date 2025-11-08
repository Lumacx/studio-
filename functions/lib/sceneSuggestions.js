"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestScene = void 0;
// functions/src/sceneSuggestions.ts
const functions = __importStar(require("firebase-functions"));
const generative_ai_1 = require("@google/generative-ai");
exports.suggestScene = functions
    .region('us-central1')
    .runWith({ secrets: ['GEMINI_API_KEY'], timeoutSeconds: 60, memory: '256MB' })
    .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    try {
        const b = (req.body ?? {});
        const language = String(b.language || 'en').slice(0, 5);
        const title = String(b.title || 'Untitled').slice(0, 120);
        const synopsis = String(b.synopsis || '').slice(0, 2000);
        const genres = Array.isArray(b.genres) ? b.genres.map((g) => String(g)).slice(0, 8) : [];
        const idx = Number.isFinite(b.sceneIndex) ? Number(b.sceneIndex) : 1;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            res.status(500).json({ error: 'Secret GEMINI_API_KEY not found at runtime' });
            return;
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
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
        if (!text)
            throw new Error('Model returned empty response');
        const cleaned = text.replace(/```json|```/gi, '').trim();
        let json;
        try {
            json = JSON.parse(cleaned);
        }
        catch {
            const m = cleaned.match(/\{[\s\S]*\}$/);
            if (!m)
                throw new Error('Invalid JSON from model');
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
    }
    catch (e) {
        console.error('[suggestScene] error:', e?.stack || e);
        res.status(500).json({ error: e?.message || 'Internal error' });
    }
});
function buildPrompt({ language, title, synopsis, genres, idx, }) {
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
//# sourceMappingURL=sceneSuggestions.js.map