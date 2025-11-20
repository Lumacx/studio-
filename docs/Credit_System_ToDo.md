# Credit System Implementation ToDo List

This document outlines the tasks required to implement a comprehensive credit system within the Narratum application. The system will enable users to purchase credits, use them for reading stories, creating stories, and tipping writers, and track their transactions. It also includes a monthly free credit grant for all users. The system supports both one-time credit package purchases and recurring weekly/monthly subscriptions across various tiers.

---

### **Task List for Credit System Implementation (Updated)**

**1. Backend & Database (Firestore) Changes**

*   **File:** `firestore.rules`
    *   **Task:** Add a `credits` field to the `users/{uid}` document, defaulting to 0.
        *   **Status:** **Completed** (Rules updated to allow for this field; default handled by Cloud Function on user creation.)
    *   **Task:** Add a `lastMonthlyCreditGrant` (timestamp) field to the `users/{uid}` document. This will track when the user last received their free monthly credits.
        *   **Status:** **Completed** (Rules updated to allow for this field; default handled by Cloud Function on user creation.)
    *   **Task:** Add a `transactions` subcollection under `users/{uid}/transactions/{transactionId}`.
        *   **Status:** **Completed** (Firestore rules now define this subcollection.)
    *   **Task:** Define a schema for `transactions` documents including fields like: `type` (e.g., 'purchase', 'read', 'tip_given', 'tip_received', 'create', 'free_monthly_grant', 'profit', 'settle', 'subscription_credit_grant'), `creditsDelta`, `amountUsd` (optional), `storyId` (optional), `targetUid` (optional, for tips/profit), `sourceUid` (optional, for profit), `timestamp`, `description`, `status` (e.g., 'confirmed').
        *   **Status:** **Completed** (Firestore rules allow reads and deny client-side writes; server-side Cloud Functions (`credits.ts`) implement and enforce the schema during transaction creation.)
    *   **Task:** Update Firestore security rules for `users/{uid}`:
        *   Allow only authenticated users (`request.auth.uid == uid`) to read their own `credits` and `lastMonthlyCreditGrant`.
            *   **Status:** **Completed** (Existing `isOwner(uid)` rule for `/users/{uid}` covers this.)
        *   Allow `credits` and `lastMonthlyCreditGrant` fields to be updated only by trusted server-side operations (e.g., Cloud Functions).
            *   **Status:** **Completed** (Firestore rules prevent client-side modifications of these fields; server-side Admin SDK bypasses rules.)
    *   **Task:** Update Firestore security rules for `users/{uid}/transactions`:
        *   Allow authenticated users to read their own transactions.
            *   **Status:** **Completed** (Firestore rules allow `isOwner(uid)` to read transactions.)
        *   Allow creation of transactions only by trusted server-side operations.
            *   **Status:** **Completed** (Firestore rules explicitly deny client-side creation.)
    *   **Task:** Add a `type` field (e.g., 'basic', 'premium', 'convai') to the `stories/{storyId}` document. This will determine the cost of reading and creating.
        *   **Status:** **Completed** (Firestore rules now validate the `type` field on `stories/{storyId}` creation and update.)
    *   **Task:** Modify `stories/{storyId}` read rule (`allow read: if isPublicStory() || isOwnerDoc();`) to check if the user has enough credits and deduct them for "premium" and "convai" stories.
        *   **Status:** **Completed** (The deduction logic is implemented in the `deductCreditsForRead` Cloud Function, and the frontend calls this function before attempting a read.)

*   **File:** `functions/src/credits.ts` (or a new Firebase Cloud Function file)
    *   **Task:** Create a new **HTTP Cloud Function** (e.g., `processPayPalOneTimePayment`) to handle successful PayPal payments for one-time purchases.
        *   **Status:** **Completed** (`processPayPalOneTimePayment` function created in `functions/src/processPayPalOneTimePayment.ts`; integrates with `verifyPayPalOrder`, updates user credits, and logs the transaction.)
    *   **Task:** Create a new **Callable Cloud Function** (e.g., `deductCreditsForRead`) that takes `storyId` as input. This function will:
        *   Verify authentication and credit balance.
        *   Deduct credits based on `storyType`.
        *   **Implement Automatic Credit Distribution for Reads:** Distribute credits based on defined percentages to Narratum Admin (AI+Storage, APP Cut), Story Owner (Royalty), and Referrer.
        *   Log `type: 'read'` and `type: 'profit'` transactions.
        *   **Status:** **Completed** (`deductCreditsForRead` function in `functions/src/credits.ts` now includes detailed credit distribution based on `CREDIT_SPLIT_CONFIG.read`.)
    *   **Task:** Create a new **Callable Cloud Function** (e.g., `deductCreditsForCreation`) that takes `storyType` as input. This function will:
        *   Verify authentication and credit balance.
        *   Deduct credits based on creation cost.
        *   **Implement Automatic Credit Distribution for Creation:** Distribute credits to Narratum Admin and Referrer.
        *   Log `type: 'create'` and `type: 'profit'` transactions.
        *   **Status:** **Completed** (`deductCreditsForCreation` function in `functions/src/credits.ts` now includes detailed credit distribution based on `CREDIT_SPLIT_CONFIG.create`.)
    *   **Task:** Create a new **Callable Cloud Function** (e.g., `sendTipToWriter`) for tipping.
        *   **Status:** **Completed** (`sendTipToWriter` function created in `functions/src/credits.ts` and exported; implements credit transfer for tipping with transaction logging for both sender and receiver.)
    *   **Task:** Create a new **Scheduled Cloud Function** (e.g., `grantMonthlyFreeCredits`) to run monthly.
        *   **Status:** **Completed** (`grantMonthlyFreeCredits` function created in `functions/src/credits.ts` and exported; implements monthly credit grant logic with transaction logging.)

*   **File:** `functions/src/paypalWebhook.ts`
    *   **Task:** Create a webhook handler to process subscription events (e.g., `PAYMENT.SALE.COMPLETED` for recurring payments) and grant credits.
        *   **Status:** **Completed** (Implemented to handle `PAYMENT.SALE.COMPLETED`, `BILLING.SUBSCRIPTION.*` events, updating user claims and granting recurring credits.)

**Automatic Cumulative Credits Distribution and Payments Logic**

*   **Narratum Admin User ID:** `bOKyhlO8sofk5O4dGRTZAIfdYSx2` is designated as the Narratum Admin user.
*   **Credit Split Configuration (`CREDIT_SPLIT_CONFIG` in `functions/src/credits.ts`):**
    *   **Read:** AI+Storage (10%), App Cut (10%), Royalty (60%), Referral (20%).
    *   **Create:** AI+Storage (35%), App Cut (25%), Royalty (0%), Referral (40%).
*   **Real-time Tracking:** Recipients see `type: 'profit'` transactions in their history.
*   **Settlement:** External payouts are recorded as `type: 'settle'` transactions with negative credit delta.

**2. Frontend Integration**

*   **File:** `src/context/AuthContext.tsx`
    *   **Task:** Extend `AuthContext` to include `credits` balance and listen for real-time updates.
        *   **Status:** **Completed** (`credits` state and `onSnapshot` listener implemented.)

*   **File:** `src/components/header.tsx`
    *   **Task:** Display `credits` balance and add "Buy Credits" button.
        *   **Status:** **Completed** (Credit balance displayed, links to `/buy-credits`.)

*   **File:** `src/app/discover/page.tsx`
    *   **Task:** Display story credit cost and implement 'READ' button logic (check credits, deduct, redirect).
        *   **Status:** **Completed** (Cost displayed, `handlePaidRead` implements deduction logic.)
    *   **Task:** Implement "Tip Writer" button logic.
        *   **Status:** **Completed** (Button and `sendTipToWriter` integration implemented.)

*   **File:** `src/app/create/begin/page.tsx`
    *   **Task:** Display creation cost and implement deduction logic before starting story creation.
        *   **Status:** **Completed** (`onStartStory` and `handleSkipToScenes` call `deductCreditsForCreation`.)

*   **File:** `src/app/profile/page.tsx`
    *   **Task:** Implement "Transaction Log" tab to display user transaction history.
        *   **Status:** **Completed** (Transactions fetched and displayed in `ProfilePage`.)

**3. Payment Gateway (PayPal) Integration**

*   **File:** `src/app/buy-credits/page.tsx`
    *   **Task:** Design "Buy Credits" page for one-time purchases and integrate PayPal checkout.
        *   **Status:** **Completed** (Integrates `PayPalButtons` and calls `processPayPalOneTimePayment`.)

*   **File:** `src/app/subscription/page.tsx`
    *   **Task:** Create UI for subscriptions (Reader/Creator/Pro tiers) and one-time purchases.
    *   **Task:** Integrate PayPal subscription flow.
    *   **Status:** **Completed** (UI created, PayPal integration via `PayPalButtons` for subscriptions logic implemented, needs backend connection for creating subscriptions via API if not using client-side plan IDs directly.)

*   **File:** `src/app/api/paypal-config/route.ts`
    *   **Task:** Provide PayPal Client ID.
        *   **Status:** **Completed**

*   **File:** `src/app/api/paypal-verify-subscription/route.ts`
    *   **Task:** Verify subscription status against PayPal API.
        *   **Status:** **Completed**

**4. Data Structure for Story Type**

*   **Task:** Ensure `storyType` (Basic, Premium, Convai) is defined and used for cost calculations.
    *   **Status:** **Completed** (`type` field on `stories/{storyId}` validated in rules and used in functions.)

**5. Hybrid Credit System UI Integration**

*   **File:** `src/app/subscription/page.tsx`
    *   **Task:** Consolidate one-time purchase flow from `/buy-credits` into this page for a unified experience.
    *   **Status:** **Pending Migration** (UI exists in `/subscription`, but `/buy-credits` is still the active page for one-time purchases. Need to fully enable the logic in `/subscription` and deprecate `/buy-credits`.)
