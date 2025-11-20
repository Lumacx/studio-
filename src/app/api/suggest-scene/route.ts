// src/app/api/suggest-scene/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Optional: increase if your model call runs long
export const maxDuration = 60;

/* --------------------------------------------------------
   Types & small helpers
-------------------------------------------------------- */
type Payload = {
  title?: string;
  synopsis?: string;
  genres?: string[];
  language?: string;   // e.g., 'en' | 'es'
  sceneIndex?: number; // 1-based
  storyId?: string;
};

function asArray<T>(x: T | T[] | undefined): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function langLabel(code?: string) {
  const map: Record<string, string> = {
    en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French',
    de: 'German', it: 'Italian', ja: 'Japanese', ko: 'Korean',
    zh: 'Chinese', hi: 'Hindi', ar: 'Arabic',
  };
  return map[(code || 'en').toLowerCase()] || 'English';
}

function buildPrompt(p: Payload) {
  const gl = (asArray(p.genres).map((g) => String(g))).join(', ') || 'adventure';
  const L = langLabel(p.language);
  const sceneNo = p.sceneIndex ?? 1;

  const lines: string[] = [];
  lines.push(`You are an experienced storyteller. Write Scene ${sceneNo} as a short, vivid paragraph for a picture-book / web reader.`);
  lines.push(`Language: ${L}. Keep it concise and engaging (80–140 words).`);
  if (p.title)    lines.push(`Story Title: ${p.title}`);
  if (p.synopsis) lines.push(`Synopsis: ${p.synopsis}`);
  if (gl)         lines.push(`Genres/Tone: ${gl}`);
  lines.push(`Return JSON with fields: storyText (string) and imagePrompt (string). Do not include markdown or code fences.`);
  return lines.join('\n');
}

/* --------------------------------------------------------
   1) Preferred path: proxy to Firebase Function
-------------------------------------------------------- */
const FIREBASE_FUNCTIONS_BASE_URL = process.env.FIREBASE_FUNCTIONS_BASE_URL?.replace(/\/+$/, '');

async function callFirebaseFunction(functionName: string, body: any, timeoutMs = 55000) {
  if (!FIREBASE_FUNCTIONS_BASE_URL) {
    throw new Error('FIREBASE_FUNCTIONS_BASE_URL is not set.');
  }
  const url = `${FIREBASE_FUNCTIONS_BASE_URL}/${functionName}`;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ac.signal,
    });

    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* leave as text */ }

    if (!res.ok) {
      // Try to bubble up the CF error payload if present
      const msg = json?.error || json?.message || text || res.statusText;
      const err = new Error(`Function ${functionName} failed (${res.status}): ${msg}`);
      (err as any).status = res.status;
      (err as any).payload = json ?? text;
      throw err;
    }

    return json ?? {};
  } finally {
    clearTimeout(t);
  }
}

/* --------------------------------------------------------
   2) Fallback: direct Gemini call (if CF not available)
-------------------------------------------------------- */
async function callGeminiJSON(prompt: string, apiKey: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
    },
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Gemini ${r.status}: ${txt || r.statusText}`);
  }

  const json = await r.json();
  const candidates = json?.candidates || [];
  const text = candidates[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Empty response from model');

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch { throw new Error('Model did not return valid JSON'); }

  const storyText = String(parsed?.storyText || '').trim();
  const imagePrompt = String(parsed?.imagePrompt || '').trim();
  if (!storyText) throw new Error('Model JSON missing "storyText"');

  return { storyText, imagePrompt };
}

/* --------------------------------------------------------
   Route handler
-------------------------------------------------------- */
export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json().catch(() => ({}))) as Payload;

    // Minimal validation to avoid opaque 500s
    if (!payload?.storyId) {
      return NextResponse.json({ error: 'storyId is required' }, { status: 400 });
    }

    /* 1) Try Cloud Function first (your current architecture) */
    try {
      const cfRes = await callFirebaseFunction('suggestScene', payload);
      // Normalize shape just in case the CF returns different keys
      const storyText = String(cfRes?.storyText ?? cfRes?.text ?? '').trim();
      const imagePrompt = String(cfRes?.imagePrompt ?? cfRes?.image ?? '').trim();
      if (!storyText) {
        // If CF responded but without text, treat as error to surface clearly
        throw new Error('Cloud Function returned no "storyText".');
      }
      return NextResponse.json({ storyText, imagePrompt }, { status: 200 });
    } catch (cfErr: any) {
      // If base URL missing or CF error, we try the Gemini fallback below.
      // We only fall back for "infra" type failures; if the CF is reachable and
      // returned a 4xx with a clear message, propagate that.
      const status = Number(cfErr?.status) || 500;
      const msg = String(cfErr?.message || '');
      const infraProblem = msg.includes('FIREBASE_FUNCTIONS_BASE_URL is not set')
                        || status >= 500;

      if (!infraProblem) {
        // 4xx from CF → return as-is for transparency
        return NextResponse.json(
          { error: msg || 'suggestScene failed' },
          { status }
        );
      }

      // Otherwise, attempt fallback
      const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        // No fallback available—report the CF error message
        return NextResponse.json(
          { error: msg || 'Suggest failed (no GEMINI_API_KEY fallback).' },
          { status: 500 }
        );
      }

      const prompt = buildPrompt(payload);
      const { storyText, imagePrompt } = await callGeminiJSON(prompt, apiKey);
      return NextResponse.json({ storyText, imagePrompt }, { status: 200 });
    }
  } catch (err: any) {
    console.error('suggest-scene error:', err?.stack || err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'Internal error in suggest-scene' },
      { status: 500 }
    );
  }
}

// Optional: HEAD for uptime checks
export async function HEAD() {
  return new Response(null, { status: 200 });
}
