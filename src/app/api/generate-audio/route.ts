// src/app/api/generate-audio/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// ✅ admin-only
import { getAdminDb, getAdminBucket, getAdminApp, FieldValue } from '@/lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type Body = {
  text: string;
  voice?: 'Kore' | 'Puck' | 'Zephyr' | 'Achird' | 'Leda' | 'Sadachbia' | string;
  tone?: string;        // e.g. 'a cheerful', 'an excited'
  language?: string;    // 'en' | 'es' | ...
  model?: string;       // default below
  format?: 'wav' | 'mp3' | 'both' | 'auto';

  // NEW: where to save
  userId?: string;      // required to save to Storage
  storyId?: string;     // required to save to Storage
  sceneIndex?: number;  // optional; helps build the filename
};

const DEFAULT_MODEL = 'gemini-2.5-pro-preview-tts' //'gemini-2.5-flash-preview-tts';
const VOICES = new Set(['Kore', 'Puck', 'Zephyr', 'Achird', 'Leda', 'Sadachbia']);

/* ------------------------- Helper: Billing ------------------------- */
async function chargeUserForCreation(
  uid: string, 
  quantity: number,
  metadata: { type: string; description?: string; resourceType: 'image' | 'audio' }
) {
  const db = getAdminDb();
  const userRef = db.collection('users').doc(uid);
  const FREE_LIMIT = 10;
  const UNIT_PRICE = 0.1;

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new Error('User not found.');
    
    const data = snap.data();
    const currentCredits = Number(data?.credits ?? 0);
    const usage = data?.usage || {};
    const currentUsageCount = Number(usage[metadata.resourceType] || 0);

    let cost = 0;
    
    // Calculate cost based on remaining free quota
    let paidCount = 0;
    
    for (let i = 0; i < quantity; i++) {
      if ((currentUsageCount + i) >= FREE_LIMIT) {
        paidCount++;
      }
    }
    
    cost = paidCount * UNIT_PRICE;

    // Check balance
    if (currentCredits < cost) {
      throw new Error(`Insufficient credits. Need ${cost.toFixed(1)}, have ${currentCredits.toFixed(1)}. (Free allowance exceeded)`);
    }

    const newBalance = currentCredits - cost;

    // 1. Update counters and balance
    tx.update(userRef, {
      credits: newBalance,
      [`usage.${metadata.resourceType}`]: FieldValue.increment(quantity),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 2. Log transaction (only if there was a cost)
    if (cost > 0) {
      const txRef = userRef.collection('transactions').doc();
      tx.set(txRef, {
        type: metadata.type,
        creditsDelta: -cost,
        timestamp: FieldValue.serverTimestamp(),
        description: metadata.description || `Charged ${cost.toFixed(1)} credits for ${paidCount} items (freemium exceeded).`,
        status: 'confirmed',
        resourceType: metadata.resourceType
      });
    }

    return newBalance;
  });
}

/* ------------------------- Helpers PCM -> WAV ------------------------- */
function pcm16ToWav(pcm: Uint8Array, sampleRate = 24000, channels = 1) {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(buffer);

  const writeStr = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);      // chunk size
  view.setUint16(20, 1, true);       // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeStr(36, 'data');
  view.setUint32(40, pcm.byteLength, true);

  new Uint8Array(buffer, 44).set(pcm);
  return new Uint8Array(buffer);
}

/* ----------------------------- Prompts ------------------------------- */
function buildPrompt(text: string, language: string, tone?: string | null) {
  if (language === 'es') {
    return `Idioma: español. Lee de manera natural como narrador${tone ? `, ${tone}` : ''}.\n\nTexto:\n${text}`;
  }
  return `Language: ${language}. Read naturally as a narrator${tone ? `, ${tone}` : ''}.\n\nText:\n${text}`;
}

/* ----------- Option 1: SDK -> PCM -> WAV (data URL) ----------- */
async function generateWithSDKWav(opts: {
  apiKey: string;
  modelId: string;
  prompt: string;
  voiceName: string;
}) {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });
  const res = await ai.models.generateContent({
    model: opts.modelId,
    contents: [{ parts: [{ text: opts.prompt }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voiceName } } },
    },
  });

  const b64 = res?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error('No audio returned by SDK.');
  const pcm = Buffer.from(b64, 'base64');
  const wav = pcm16ToWav(new Uint8Array(pcm), 24000, 1);
  const wavB64 = Buffer.from(wav).toString('base64');
  return {
    ok: true as const,
    mimeType: 'audio/wav',
    audioUrl: `data:audio/wav;base64,${wavB64}`,
  };
}

/* ----------- Option 2: REST MP3/WAV (if available) ----------- */
async function generateViaREST(opts: {
  apiKey: string;
  modelId: string;
  prompt: string;
  voiceName: string;
  responseMime: 'audio/mp3' | 'audio/wav';
}) {
  const { apiKey, modelId, prompt, voiceName, responseMime } = opts;
  const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { response_mime_type: responseMime },
    voiceConfig: { prebuiltVoiceConfig: { voiceName } },
  };

  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  if (!r.ok) {
    const msg = await r.text();
    return { ok: false as const, status: r.status, error: msg };
  }

  const json = await r.json();
  const part =
    json?.candidates?.[0]?.content?.parts?.find(
      (p: any) => p?.inlineData?.data && typeof p?.inlineData?.mimeType === 'string'
    ) ?? null;

  if (!part) return { ok: false as const, status: 502, error: 'No inlineData audio part' };

  const mime: string = String(part.inlineData.mimeType);
  const b64: string = String(part.inlineData.data);
  return { ok: true as const, mimeType: mime, audioUrl: `data:${mime};base64,${b64}` };
}

/* ------------------------- Upload helpers ------------------------- */
function dataUrlToParts(dataUrl: string) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return { mime: 'application/octet-stream', base64: '', ext: 'bin' as const };
  const mime = m[1];
  const base64 = m[2];
  const ext = mime.includes('wav') ? 'wav' : mime.includes('mp3') ? 'mp3' : 'bin';
  return { mime, base64, ext: ext as 'mp3'|'wav'|'bin' };
}

async function saveAudioToStorageAndIndex(params: {
  userId: string;
  storyId: string;
  sceneIndex?: number;
  voiceName: string;
  tone?: string | null;
  language: string;
  audioDataUrl: string;
  modelUsed: string;
}) {
  const { userId, storyId, sceneIndex, voiceName, tone, language, audioDataUrl, modelUsed } = params;

  const { mime, base64, ext } = dataUrlToParts(audioDataUrl);
  if (!base64) throw new Error('Invalid audio data URL for upload.');

  const ts = Date.now();
  const indexStr = Number.isFinite(sceneIndex) ? `scene-${sceneIndex}` : 'scene';
  const filename = `${indexStr}-${ts}.${ext}`;
  const category = 'audioNarrations' as const;
  const path = `users/${userId}/assetIndex/stories/${storyId}/${category}/${filename}`;

  const bucket = getAdminBucket();
  const file = bucket.file(path);
  const token = uuidv4();

  await file.save(Buffer.from(base64, 'base64'), {
    resumable: false,
    contentType: mime,
    metadata: {
      contentType: mime,
      metadata: {
        'narratum:storyId': storyId,
        'narratum:assetCategory': category,
        'narratum:source': 'ai-generated-tts',
        'narratum:voice': voiceName,
        'narratum:tone': tone ?? '',
        'narratum:language': language,
        modelUsed,
        displayName: filename,
        createdAt: String(ts),
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  const https = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

  const db = getAdminDb();
  const docPath = `users/${userId}/assetIndex/stories/${storyId}/${category}/${filename.replace(/\.[^.]+$/, '')}`;
  await db.doc(docPath).set(
    {
      url: https,
      name: filename.replace(/\.[^.]+$/, ''),
      fileName: filename,
      contentType: mime,
      createdAt: FieldValue.serverTimestamp(),
      source: 'ai-generated-tts',
      storyId,
      voice: voiceName,
      tone: tone ?? null,
      language,
      modelUsed,
    },
    { merge: true }
  );

  return { https, fullPath: path, filename, mime };
}

/** 
 * VERIFY AUTH TOKEN 
 * Extracts Bearer token from headers and verifies via Admin SDK.
 */
async function verifyUser(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/, '');
  if (!token) return null;

  try {
    const adminAuth = getAuth(getAdminApp());
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded;
  } catch (err) {
    console.error('Auth verification failed:', err);
    return null;
  }
}

/* ------------------------------- Handler ------------------------------ */
export async function POST(req: Request) {
  try {
    // 🔐 SECURE ENDPOINT: Check Auth
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }

    const body = (await req.json()) as Body;

    // 🔐 VALIDATE OWNERSHIP: Ensure requester matches userId in body (if provided)
    if (body.userId && body.userId !== user.uid) {
      return NextResponse.json({ error: 'Unauthorized: User ID mismatch' }, { status: 403 });
    }

    // Default userId to authenticated user if missing
    if (!body.userId) {
      body.userId = user.uid;
    }

    const text = (body.text ?? '').trim();
    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing GEMINI_API_KEY / GOOGLE_API_KEY' }, { status: 500 });
    }

    // 💰 CHARGE CREDIT (Atomic Transaction)
    // Charge 1 unit per TTS generation with 'audio' type for counters
    try {
      await chargeUserForCreation(user.uid, 1, { 
        type: 'tts_generation', 
        description: 'Generated audio narration',
        resourceType: 'audio' // ✅ Correctly sets resourceType
      });
    } catch (billingErr: any) {
      console.warn('Billing failed:', billingErr);
      return NextResponse.json({ error: 'Insufficient credits or billing error.' }, { status: 402 });
    }

    const language = (body.language || 'en').trim();
    const tone = body.tone || null;
    const voiceName = VOICES.has(body.voice || '') ? String(body.voice) : 'Kore';
    const modelId = (body.model || DEFAULT_MODEL).trim();
    const format = (body.format || 'both') as Body['format'];

    const prompt = buildPrompt(text, language, tone);

    // Try MP3 via REST; WAV via SDK (fallback to REST WAV)
    let mp3: { ok: true; audioUrl: string; mimeType: string } | null = null;
    let wav: { ok: true; audioUrl: string; mimeType: string } | null = null;

    if (format === 'mp3' || format === 'both' || format === 'auto') {
      const r = await generateViaREST({
        apiKey,
        modelId,
        prompt,
        voiceName,
        responseMime: 'audio/mp3',
      });
      if (r.ok) mp3 = { ok: true, audioUrl: r.audioUrl, mimeType: r.mimeType };
    }

    if (format === 'wav' || format === 'both' || format === 'auto') {
      try {
        const s = await generateWithSDKWav({ apiKey, modelId, prompt, voiceName });
        wav = { ok: true, audioUrl: s.audioUrl, mimeType: s.mimeType };
      } catch {
        const r2 = await generateViaREST({
          apiKey,
          modelId,
          prompt,
          voiceName,
          responseMime: 'audio/wav',
        });
        if (r2.ok) wav = { ok: true, audioUrl: r2.audioUrl, mimeType: r2.mimeType };
      }
    }

    // Choose primary
    let primary: { audioUrl: string; mimeType: string } | null = null;
    if (format === 'mp3') primary = mp3;
    else if (format === 'wav') primary = wav;
    else if (format === 'auto') primary = mp3 || wav;
    else /* both */ primary = mp3 || wav;

    if (!primary) {
      return NextResponse.json({ error: 'TTS failed: neither MP3 nor WAV could be generated.' }, { status: 502 });
    }

    // NEW: Save to Firebase Storage + Firestore if storyId + userId are provided
    let persistedUrl: string | null = null;
    if (body.userId && body.storyId) {
      try {
        const saved = await saveAudioToStorageAndIndex({
          userId: body.userId,
          storyId: body.storyId,
          sceneIndex: body.sceneIndex,
          voiceName,
          tone,
          language,
          audioDataUrl: primary.audioUrl,
          modelUsed: modelId,
        });
        persistedUrl = saved.https;
      } catch (err) {
        // If saving fails, we still return the data URL so the user isn't blocked
        console.warn('Audio upload/index failed; returning data URL instead:', err);
      }
    }

    return NextResponse.json({
      audioUrl: persistedUrl || primary.audioUrl, // prefer HTTPS if uploaded
      mimeType: primary.mimeType,
      modelUsed: modelId,
      // pass-through variants when available
      audioUrlMp3: mp3?.audioUrl || null,
      audioUrlWav: wav?.audioUrl || null,
      savedToStorage: Boolean(persistedUrl),
    });
  } catch (e: any) {
    console.error('generate-audio error:', e);
    return NextResponse.json({ error: e?.message || 'TTS failed' }, { status: 500 });
  }
}
