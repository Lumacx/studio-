// src/app/api/generate-image/route.ts
import { NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const FIREBASE_FUNCTIONS_BASE_URL = process.env.FIREBASE_FUNCTIONS_BASE_URL?.replace(/\/$/, '');

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

async function callFirebaseFunction(functionName: string, body: any, authToken: string) {
  if (!FIREBASE_FUNCTIONS_BASE_URL) {
    throw new Error("FIREBASE_FUNCTIONS_BASE_URL is not set.");
  }
  
  const url = `${FIREBASE_FUNCTIONS_BASE_URL}/${functionName}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}` // Pass the token through to the function
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Function ${functionName} failed with status ${response.status}: ${errorText}`);
  }

  return await response.json();
}

export async function POST(req: Request) {
  // 🔐 SECURE ENDPOINT: Check Auth
  const user = await verifyUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
  }

  // Extract raw token to pass downstream
  const authHeader = req.headers.get('Authorization') || '';
  const rawToken = authHeader.replace(/^Bearer\s+/, '');

  const originalBody = await req.json();
  const { storyId, userId, ...restOfBody } = originalBody; // Extract storyId

  // 🔐 VALIDATE OWNERSHIP: Ensure requester matches userId in body (if provided)
  if (userId && userId !== user.uid) {
    return NextResponse.json({ error: 'Unauthorized: User ID mismatch' }, { status: 403 });
  }

  const bodyWithAspectRatio = { ...restOfBody };
  // Explicitly inject authenticated userId into downstream call
  bodyWithAspectRatio.userId = user.uid;

  // Set default aspect ratio to 16:9 and add to the prompt
  const aspectRatio = "16:9";
  if (bodyWithAspectRatio.prompt) {
    bodyWithAspectRatio.prompt = `${bodyWithAspectRatio.prompt} --ar ${aspectRatio}`;
  } else {
    bodyWithAspectRatio.prompt = `--ar ${aspectRatio}`;
  }

  if (storyId) {
    bodyWithAspectRatio.storyId = storyId; // Add storyId to the body if present
  }

  // --- ATTEMPT 1: Try the dedicated Gemini (Nano Banana) function ---
  try {
    console.log("Attempting primary generation via generateWithGemini function...");
    const result = await callFirebaseFunction('generateWithGemini', bodyWithAspectRatio, rawToken);
    console.log("Success with generateWithGemini.");
    return NextResponse.json(result);
  } catch (e: any) {
    console.warn("generateWithGemini function failed:", e.message);
  }

  // --- ATTEMPT 2: Fallback to the dedicated Imagen function ---
  try {
    console.log("Falling back to generateWithImagen function...");
    const result = await callFirebaseFunction('generateWithImagen', bodyWithAspectRatio, rawToken);
    console.log("Success with generateWithImagen fallback.");
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("Fallback generateWithImagen function also failed:", e.message);
    return NextResponse.json(
      { error: "All image generation services failed.", details: e.message },
      { status: 503 }
    );
  }
}