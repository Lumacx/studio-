// src/app/api/worldcoin/verify/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const proof = await request.json();
  
  try {
    // The app_id in the URL should match the one from the IDKitWidget
    const response = await fetch(
      `https://developer.worldcoin.org/api/v2/verify/app_f94ef81d75376893542354da9f3e83d6`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(proof),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      const { code, detail } = await response.json();
      return NextResponse.json({ error: `Error Code ${code}: ${detail}` }, { status: response.status });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
