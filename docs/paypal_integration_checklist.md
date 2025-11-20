# PayPal Integration To-Do Checklist

This checklist outlines the successful completion and remaining tasks for the PayPal integration, which now features a standardized flow for both one-time payments and subscriptions.

---

## I. Frontend - Restructuring One-Time Payments and Referrals/Promo Codes

*   **1. Migrate One-Time Payment Components to `src/app/buy-credits/page.tsx`:**
    *   **STATUS: DONE.** `PayButtonsOneTime` and `HostedPayPalButtonRenderer` (with provider logic) are now in `src/app/buy-credits/page.tsx`. `src/app/subscription/page.tsx` focuses on subscription management.
*   **2. Standardize One-Time Payment Flow on `src/app/buy-credits/page.tsx`:**
    *   **STATUS: DONE.** Removed redirect logic. Implemented `onApproveOneTime` handler to call `processPayPalOneTimePayment` Cloud Function.
*   **3. Add Referrer Input to Both Pages:**
    *   **STATUS: DONE.** Referrer input field and logic implemented in both `subscription` and `buy-credits` pages. `referredBy` is passed to backend functions.
*   **4. Add Promo Code Functionality to `src/app/subscription/page.tsx`:**
    *   **STATUS: DONE.** Promo code logic migrated and implemented in `subscription/page.tsx`.
*   **5. Standardize Firebase Functions Import:**
    *   **STATUS: DONE.** Consistent use of `@/lib/firebase` imports.
*   **6. Improve Hosted Buttons Type Safety:**
    *   **STATUS: DONE.** `window.paypal` type augmentation resolved.

---

## II. Backend - Firebase Cloud Functions

### **`functions/src/processPayPalOneTimePayment.ts` (Callable Function for One-Time Payments)**

*   **1. REPLACE MOCK PAYPAL API (CRITICAL & URGENT):**
    *   **STATUS: DONE.** Real PayPal API calls are used for order capture.
*   **2. Implement Credit Granting and Transaction Recording:**
    *   **STATUS: DONE.** Credits updated, detailed transaction records created in Firestore.
*   **3. Implement Idempotency for Credit Grants:**
    *   **STATUS: DONE.** `processedOneTimePayments` collection prevents double-crediting.
*   **4. Fix TypeScript Errors for `captureResult`:**
    *   **STATUS: DONE.** Explicit casting to `PayPalOrderCaptureResponse`.

### **`functions/src/paypalWebhook.ts` (HTTP Cloud Function for Webhooks)**

*   **1. IMPLEMENT WEBHOOK VERIFICATION (CRITICAL & URGENT):**
    *   **STATUS: DONE.** Full signature verification implemented using `verifyPayPalWebhookSignature` and `PAYPAL_WEBHOOK_ID`.
*   **2. PROCESS SUBSCRIPTION EVENTS (CRITICAL & URGENT):**
    *   **STATUS: DONE.** Handles `BILLING.SUBSCRIPTION.ACTIVATED`, `RENEWED`, `CANCELLED`, `SUSPENDED`, and `PAYMENT_FAILED`.
*   **3. Implement Idempotency for ALL Webhook Events:**
    *   **STATUS: DONE.** `processedWebhookEvents` collection prevents duplicate processing.
*   **4. Ensure `paypalOrderId` in Transaction Records:**
    *   **STATUS: DONE.** `paypalOrderId` stored in transaction logs.
*   **5. Fix TypeScript Errors/Typos:**
    *   **STATUS: DONE.** Typo fixes and type corrections applied.

### **`functions/src/utils/paypal.ts` (PayPal Utilities)**

*   **1. Export PayPal API Response Interfaces:**
    *   **STATUS: DONE.** Interfaces for AccessToken, WebhookVerification, OrderCapture, and SubscriptionDetails exported.
*   **2. Fix TypeScript Errors for `unknown` type assignments:**
    *   **STATUS: DONE.** Explicit casting applied.
*   **3. Add `getPayPalOrderDetails` function:**
    *   **STATUS: DONE.** Function added to fetch order details.

### **`functions/src/credits.ts` (Callable Function for One-Time Payments)**

*   **1. Update `processPayPalOneTimePayment` to use `getPayPalOrderDetails`:**
    *   **STATUS: DONE.** Function updated to use the utility.

---

## III. Backend - Next.js API Routes

*   **`src/app/api/paypal-webhook/route.ts`:**
    *   **STATUS: DONE.** Removed. Webhooks handled by `functions/src/paypalWebhook.ts`.
*   **`src/app/api/paypal-verify-subscription/route.ts`:**
    *   **STATUS: RETAINED.** Used for client-side status checks.
*   **`src/app/api/paypal-config/route.ts`:**
    *   **STATUS: DONE.** Removed in favor of direct environment variable usage on frontend.

---

## IV. General

*   **Environment Variable Consistency:** Verified. `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET_KEY`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENV`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID` are configured.
*   **PayPal API Response Interfaces:** Verified. Type safety improved.
*   **Comprehensive Testing:** Testing of one-time and subscription flows (success, failure, cancellation) is ongoing.
*   **Security Review:** Security review of payment flow, data integrity, and secret handling is complete.
