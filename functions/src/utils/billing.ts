// functions/src/utils/billing.ts
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { db } from '../firebaseAdmin';

/**
 * Deducts credits for a generic "creation" action.
 * Implements a "Freemium" model: First 10 are free, then costs 0.1 credits.
 */
export async function chargeUserForCreation(
  uid: string, 
  quantity: number,
  metadata: { type: string; description?: string; resourceType: 'image' | 'audio' }
): Promise<number> {
  const userRef = db.collection('users').doc(uid);
  const FREE_LIMIT = 10;
  const UNIT_PRICE = 0.1;

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found.');
    }
    
    const data = snap.data();
    const currentCredits = Number(data?.credits ?? 0);
    const usage = data?.usage || {};
    const currentUsageCount = Number(usage[metadata.resourceType] || 0);

    let cost = 0;
    
    // Calculate cost based on remaining free quota
    // Example: Used 8, Requesting 3. 
    // 8 -> 9 (Free), 9 -> 10 (Free), 10 -> 11 (Paid). Total paid: 1 * 0.1
    let paidCount = 0;
    
    for (let i = 0; i < quantity; i++) {
      if ((currentUsageCount + i) >= FREE_LIMIT) {
        paidCount++;
      }
    }
    
    cost = paidCount * UNIT_PRICE;

    // Check balance
    if (currentCredits < cost) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Not enough credits. Need ${cost.toFixed(1)}, have ${currentCredits.toFixed(1)}. (Free allowance exceeded)`
      );
    }

    const newBalance = currentCredits - cost;

    // 1. Update counters and balance
    tx.update(userRef, {
      credits: newBalance,
      [`usage.${metadata.resourceType}`]: admin.firestore.FieldValue.increment(quantity),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Log transaction (only if there was a cost)
    if (cost > 0) {
      const txRef = userRef.collection('transactions').doc();
      tx.set(txRef, {
        type: metadata.type,
        creditsDelta: -cost,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        description: metadata.description || `Charged ${cost.toFixed(1)} credits for ${paidCount} items (freemium exceeded).`,
        status: 'confirmed',
        resourceType: metadata.resourceType
      });
    }

    return newBalance;
  });
}
