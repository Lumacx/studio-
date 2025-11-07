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
const functions = __importStar(require("firebase-functions"));
const generative_ai_1 = require("@google/generative-ai");
function buildPrompt(b) {
    const lang = b.language || 'en';
    const genres = (b.genres || []).join(', ') || 'Any';
    const idx = b.sceneIndex ?? 1;
    return `
  You are a professional story developer and visual director.
  
  Language to WRITE IN: ${lang}
  
  Story context:
  - Title: ${b.title || 'Untitled'}
  - Genres: ${genres}
  - Synopsis: ${b.synopsis || '(none)'}
  
  Task for SCENE #${idx}:
  1) Write a vivid paragraph (70–120 words) of story text, self-contained, suitable for narration.
  2) Provide ONE concise illustration prompt for an image generator (no text overlays).
  
  Return JSON ONLY with exactly:
  {
    "storyText": "<paragraph>",
    "imagePrompt": "<one-sentence prompt>"
  }
  `.trim();
}
function safeParseJson(s) {
    const cleaned = s.replace(/```json|```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    }
    catch {
        const m = cleaned.match(/\{[\s\S]*\}$/);
        if (!m)
            throw new Error('Invalid JSON from model');
        return JSON.parse(m[0]);
    }
}
function extractText(resp) {
    // Newer shape
    if (resp?.response?.text && typeof resp.response.text === 'function') {
        return resp.response.text().trim();
    }
    // Helper on some versions
    if (typeof resp?.text === 'function') {
        return resp.text().trim();
    }
    // Candidates (older)
    const cand = resp?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof cand === 'string')
        return cand.trim();
    return '';
}
exports.suggestScene = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    try {
        const body = req.body;
        const apiKey = functions.config().gemini.key;
        if (!apiKey) {
            throw new functions.https.HttpsError('internal', 'Missing GEMINI_API_KEY');
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image-preview' });
        const prompt = buildPrompt(body);
        const result = await model.generateContent(prompt);
        const text = extractText(result);
        if (!text) {
            throw new functions.https.HttpsError('internal', 'Model returned no content');
        }
        const json = safeParseJson(text);
        res.json(json);
    }
    catch (e) {
        console.error('suggestScene error:', e?.stack || e);
        res.status(500).json({ error: e.message });
    }
});
//# sourceMappingURL=sceneSuggestions.js.map