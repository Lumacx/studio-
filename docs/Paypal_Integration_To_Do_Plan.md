# PayPal Integration To Do Plan

This document outlines the remaining tasks and next steps specifically for fully integrating PayPal payments, with a focus on subscriptions and consolidating payment flows.

---

### Checklist for PayPal Integration

**Current Status Summary:**
*   **One-time Purchases:** Functional. `src/app/buy-credits/page.tsx` uses `functions/src/processPayPalOneTimePayment.ts` (exposed via `processPayPalOneTimePayment` Cloud Function) to handle credit package purchases.
*   **Subscription UI:** `src/app/subscription/page.tsx` and `SubscriptionClient.tsx` provide the interface for selecting plans.
*   **Subscription Backend:**
    *   `createPayPalOrder` Cloud Function (`functions/src/createPayPalOrder.ts`) is used to initiate orders (currently focused on one-time, needs to be adapted or complemented for subscriptions if not using direct Plan IDs).
    *   `paypalWebhook` Cloud Function (`functions/src/paypalWebhook.ts`) is implemented to handle `PAYMENT.SALE.COMPLETED` and `BILLING.SUBSCRIPTION.*` events, updating user claims and credits.
    *   `src/app/api/paypal-verify-subscription/route.ts` exists to verify subscription status against PayPal's API.
*   **Core Utilities:** `functions/src/utils/paypal.ts` contains `getPayPalAccessToken` and `verifyPayPalOrder`.

---

### **Phase 1: Implement PayPal Subscriptions (Backend Focus)**

*   **Task 1.1: Create Backend API for Subscription Creation**
    *   **Description:** Develop a new Firebase Cloud Function (e.g., `createPayPalSubscription`) or API route to handle initiating a PayPal subscription.
    *   **Details:**
        *   Receive PayPal Plan ID and user details from the frontend.
        *   Call `getPayPalAccessToken()` from `functions/src/utils/paypal.ts`.
        *   Make a `POST` request to `https://api-m.sandbox.paypal.com/v1/billing/subscriptions` with the Plan ID.
        *   Handle PayPal's response (e.g., approval URL).
        *   Store the PayPal `subscriptionID` and initial status in the user's Firestore document.
    *   **Estimated Location:** `functions/src/paypalSubscriptions.ts` (new file) or extending `functions/src/credits.ts`.
    *   **Status:** Pending / In Progress (Need to confirm if `createPayPalOrder` covers this or if a dedicated subscription creation function is preferred).

*   **Task 1.2: Implement Subscription Verification & Status Update Endpoint**
    *   **Description:** Enhance `src/app/api/paypal-verify-subscription/route.ts` to actively query PayPal for a subscription's current status and update Firestore.
    *   **Details:**
        *   Receive `subscriptionID` from frontend or internal calls.
        *   Call `getPayPalAccessToken()`.
        *   Make a `GET` request to `https://api-m.sandbox.paypal.com/v1/billing/subscriptions/{subscriptionID}`.
        *   Parse the response to get the subscription status (e.g., `ACTIVE`, `CANCELLED`, `PENDING`).
        *   Update the user's `subscriptionStatus` field in Firestore (`users/{uid}`).
    *   **Estimated Location:** `src/app/api/paypal-verify-subscription/route.ts` and associated helper functions in `functions/src/paypalSubscriptions.ts`.
    *   **Status:** Partially Complete (`src/app/api/paypal-verify-subscription/route.ts` exists, needs verification of logic).

*   **Task 1.3: Set Up PayPal Webhook Endpoint for Subscriptions**
    *   **Description:** Create a dedicated API route or Cloud Function to receive and process PayPal webhook notifications.
    *   **Details:**
        *   Configure webhooks in your PayPal developer account for relevant events (e.g., `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `PAYMENT.SALE.COMPLETED` for recurring payments, `BILLING.SUBSCRIPTION.EXPIRED`).
        *   Implement endpoint to:
            *   Verify the webhook signature (for security).
            *   Parse the webhook payload.
            *   Update the user's subscription status in Firestore based on the event.
            *   If a recurring payment is confirmed (`PAYMENT.SALE.COMPLETED`), trigger credit granting logic for subscribers.
    *   **Estimated Location:** `functions/src/paypalWebhook.ts` (Existing file).
    *   **Status:** Partially Complete (File exists, logic for `BILLING.SUBSCRIPTION.*` events is present but needs rigorous testing).

---

### **Phase 2: Frontend Integration and Consolidation**

*   **Task 2.1: Connect `src/app/subscription/page.tsx` to Backend Subscription Logic**
    *   **Description:** Replace placeholder PayPal integration in `src/app/subscription/page.tsx` with calls to the new backend subscription creation API (`createPayPalSubscription`).
    *   **Details:**
        *   When a user selects a subscription plan and clicks "Subscribe," initiate the PayPal client-side flow.
        *   On PayPal approval, send the necessary information (e.g., order ID, plan ID) to `createPayPalSubscription`.
        *   Handle success/failure feedback for the user.
    *   **Estimated Location:** `src/app/subscription/page.tsx`.
    *   **Status:** Pending

*   **Task 2.2: Migrate/Consolidate One-time Purchase Flow**
    *   **Description:** Integrate the one-time credit purchase logic from `src/app/buy-credits/page.tsx` directly into `src/app/subscription/page.tsx` for a unified payment experience.
    *   **Details:**
        *   Ensure the "One-time Purchase" tab/section within `src/app/subscription/page.tsx` correctly triggers the existing `processPayPalPayment` Cloud Function on successful payment.
        *   Deprecate or redirect `src/app/buy-credits/page.tsx` if fully migrated.
    *   **Estimated Location:** `src/app/subscription/page.tsx`.
    *   **Status:** Pending (UI is there, but full consolidation of logic needs verification).

---

### **Phase 3: Ongoing Maintenance & Enhancements**

*   **Task 3.1: Implement Recurring Credit Granting for Subscriptions**
    *   **Description:** Add logic to grant recurring credits to users who have an active PayPal subscription.
    *   **Details:**
        *   This should ideally be triggered by the PayPal webhook for `PAYMENT.SALE.COMPLETED` events for subscription payments.
        *   Update the user's `credits` balance in Firestore.
        *   Log a `type: 'subscription_credit_grant'` transaction in `users/{uid}/transactions`.
    *   **Estimated Location:** `functions/src/paypalWebhook.ts`.
    *   **Status:** Pending (Logic likely needs to be added/verified in `paypalWebhook.ts`).

*   **Task 3.2: Subscription Cancellation/Downgrade Handling**
    *   **Description:** Implement backend logic to handle subscription cancellations, suspensions, or downgrades reported by PayPal (via webhooks or direct API calls).
    *   **Details:**
        *   Update user's Firestore `subscriptionStatus` and potentially revoke premium features.
        *   Log relevant transactions.
    *   **Estimated Location:** `functions/src/paypalWebhook.ts`.
    *   **Status:** Pending (Logic likely needs to be added/verified in `paypalWebhook.ts`).

*   **Task 3.3: Error Handling and Logging for PayPal Transactions**
    *   **Description:** Ensure comprehensive error handling and logging are in place for all PayPal-related API calls and webhook processing.
    *   **Details:**
        *   Log detailed error messages to Firebase logs or a monitoring service.
        *   Implement retry mechanisms where appropriate.
    *   **Estimated Location:** All PayPal-related backend functions and API routes.
    *   **Status:** Ongoing (review existing error handling).

---

### PayPal Integration Quick Checklist

- [x] Backend: `functions/src/utils/paypal.ts` (`getPayPalAccessToken`, `verifyPayPalOrder`)
- [x] Backend: `functions/src/processPayPalOneTimePayment.ts` (Logic for one-time purchases)
- [ ] Backend: New Cloud Function/API for PayPal Subscription Creation (e.g., `createPayPalSubscription`) or verify adaptation of `createPayPalOrder`.
- [x] Backend: Enhanced `src/app/api/paypal-verify-subscription/route.ts` for active subscription status query.
- [x] Backend: Dedicated endpoint for PayPal Webhooks (`functions/src/paypalWebhook.ts`).
- [x] Frontend: `src/app/buy-credits/page.tsx` (one-time purchases)
- [x] Frontend: `src/app/api/paypal-config/route.ts` (providing Client ID, if applicable, or env var usage)
- [x] Frontend: `src/app/subscription/page.tsx` (UI for subscriptions/one-time).
- [ ] Frontend: `src/app/subscription/page.tsx` connected to backend subscription creation logic.
- [ ] Frontend: `src/app/subscription/page.tsx` fully consolidates one-time purchase logic (migration from `buy-credits`).
- [ ] Backend: Logic for recurring credit granting for subscriptions (via webhooks).
- [ ] Backend: Logic for subscription cancellation/downgrade handling (via webhooks/API).
- [ ] Overall: Comprehensive error handling and logging for all PayPal transactions.
