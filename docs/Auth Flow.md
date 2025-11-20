# Authentication Flow & Security Analysis

## Executive Summary
The authentication flow in Narratum is robust, leveraging Firebase Authentication as the primary identity provider with a supplementary Starknet integration for wallet connectivity. The system enforces security through a combination of client-side checks (via `AuthContext` and page-level logic) and server-side Firebase Security Rules for Firestore and Storage.

The most critical finding is a potential privacy gap in **Firebase Storage rules for story assets**, where draft images and audio are publicly readable even if the story document is private.

---

## 1. Authentication Architecture

### Core Components
*   **`AuthContext.tsx`**: The central hub for auth state.
    *   **Provider**: Wraps the app, exposing `user` (Firebase User), `loading` status, and `starknetAddress`.
    *   **Listener**: Uses `onAuthStateChanged` to sync with Firebase Auth in real-time.
    *   **Starknet**: Manages a separate wallet connection state alongside the user identity.
*   **`useAuth` Hook**: Consumed by components to access auth state and enforce access control.

### User Journey & Gates

#### A. Story Creation (`/create/begin`)
1.  **Gate**: `useAuth()` retrieves the user. Functions like `ensureStoryId` and `handleCoverImageSaved` explicitly throw errors if `user` is null.
2.  **Action**:
    *   **Draft**: Local state persisted to `localStorage`.
    *   **Persistence**: On providing a cover/title, `ensureStoryId` creates a `stories` document in Firestore with `ownerUid == user.uid`.
    *   **Assets**: Cover images are uploaded to `users/{uid}/stories/{storyId}/images/cover.png`.

#### B. Asset & Reference Management (`/create/support`)
1.  **Gate**: Strict page-level check. Unauthenticated users are immediately redirected to `/login`.
2.  **Action**: authenticated users upload reference assets (chars, locations, audio) to `users/{uid}/assets/...`.

#### C. Scene Composition & Publishing (`/create/scenes`)
1.  **Gate**: `publishStory` prevents execution if no user is present.
2.  **Action**:
    *   **Draft Loading**: Hydrates from `localStorage`.
    *   **Asset Finalization**: Uploads scene-specific images/audio (blobs) to canonical Storage paths (`users/{uid}/stories/{storyId}/...`).
    *   **Content Persistence**: Creates/Updates `storyContents` documents linked to the story.
    *   **Metadata Update**: Finalizes `stories` document fields (page count, URLs).
    *   **Completion**: Redirects to the public/private reader view `/story/{storyId}`.

---

## 2. Security Rules Analysis

### Firestore Rules (`firestore.rules`)
*   **Users (`/users/{uid}`)**: Strict owner-only access. **Secure.**
*   **Stories (`/stories/{storyId}`)**:
    *   **Read**: Public if `status == 'published' && visibility == 'public'`, otherwise owner-only. **Secure.**
    *   **Write**: Owner-only. **Secure.**
*   **Story Contents (`/storyContents/{id}`)**:
    *   **Read**: Inherits permissions from the parent story (public if story is public). **Secure.**
    *   **Write**: Owner-only. **Secure.**

### Storage Rules (`storage.rules`)
*   **Avatars (`/avatars/...`)**: Public read, owner write. **Acceptable.**
*   **Reference Assets (`/users/{uid}/assets/...`)**: Owner-only read/write. **Secure.**
*   **Story Assets (`/users/{uid}/stories/{storyId}/...`)**:
    *   **Write**: Owner-only. **Secure.**
    *   **Read**: `allow read: if true;` **CRITICAL PRIVACY GAP.**
        *   *Impact*: Images and audio for **private/draft** stories are publicly accessible if the URL is guessed or known. This contradicts the Firestore privacy model.
*   **Public Folder (`/public/...`)**:
    *   **Write**: `allow write: if isSignedIn();` **POTENTIAL RISK.**
        *   *Impact*: Any logged-in user can overwrite or add files to the public assets folder. If this folder hosts static app assets (templates, default avatars), this is a vulnerability.

---

## 3. Recommendations

### Critical Fixes
1.  **Secure Draft Assets**: Modify `storage.rules` for story assets.
    *   *Option A (Strict)*: `allow read: if request.auth.uid == userId;`. This requires moving assets to a public path upon publication.
    *   *Option B (Dynamic)*: `allow read: if resource.metadata.visibility == 'public' || request.auth.uid == userId;`. This requires setting metadata on objects during upload or publication.
2.  **Lock Down Public Folder**: Change write access on `/public/` to admin-only or specific service accounts if these are static assets.

### Enhancements
*   **Starknet-Firebase Linking**: Consider a mechanism to cryptographically link the Starknet wallet to the Firebase User ID (e.g., storing the address in the user's Firestore profile and verifying a signature) to prevent wallet spoofing.
