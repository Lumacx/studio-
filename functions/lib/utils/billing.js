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
exports.chargeUserForCreation = chargeUserForCreation;
// functions/src/utils/billing.ts
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const firebaseAdmin_1 = require("../firebaseAdmin");
/**
 * Deducts credits for a generic "creation" action.
 * Implements a "Freemium" model: First 10 are free, then costs 0.1 credits.
 */
async function chargeUserForCreation(uid, quantity, metadata) {
    const userRef = firebaseAdmin_1.db.collection('users').doc(uid);
    const FREE_LIMIT = 10;
    const UNIT_PRICE = 0.1;
    return await firebaseAdmin_1.db.runTransaction(async (tx) => {
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
            throw new functions.https.HttpsError('failed-precondition', `Not enough credits. Need ${cost.toFixed(1)}, have ${currentCredits.toFixed(1)}. (Free allowance exceeded)`);
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
//# sourceMappingURL=billing.js.map