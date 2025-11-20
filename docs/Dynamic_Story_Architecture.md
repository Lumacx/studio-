# Dynamic Story Architecture Documentation

## 1. Overview

This document outlines a scalable, database-driven architecture for creating, storing, and reading user-generated stories. This approach replaces static, single-story structures with a dynamic system capable of handling multiple unique stories.

This architecture is designed to integrate seamlessly with the existing Next.js application, Firebase Data Connect (PostgreSQL), Cloud Firestore, and Cloud Storage.

## 2. Data Storage & Cost Model

Our strategy separates story metadata (stored in the database) from story assets (stored in cloud storage).

-   **Database (Cloud Firestore & Cloud SQL):**
    -   **Usage:** Stores all metadata, such as titles, descriptions, page order, and references to asset URLs.
    -   **Cost:** Billed based on instance size (PostgreSQL) or read/write operations and storage (Firestore). Scales automatically.
-   **File Storage (Cloud Storage for Firebase):**
    -   **Usage:** Stores all large, static assets, including images, audio files, and video files.
    -   **Cost:** Billed primarily on storage duration (GB/month) and bandwidth for user downloads. This is the most cost-effective way to handle large media files.

## 3. Proposed Data Model (Hybrid)

The application currently uses a hybrid approach with Cloud Firestore serving as the primary document store for stories and pages.

### `stories` Collection (Firestore)

Stores the high-level metadata for each story.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique document identifier for the story. |
| `title` | `string` | The title of the story. |
| `synopsis` | `string` | A brief summary of the story. |
| `coverImageUrl` | `string` | HTTPS URL to the story's cover image in Cloud Storage. |
| `ownerUid` | `string` | Firebase Auth UID of the creator. |
| `createdAt` | `timestamp` | Creation timestamp. |
| `status` | `string` | 'draft' or 'published'. |
| `visibility` | `string` | 'public' or 'private'. |
| `pageCount` | `number` | Total number of pages. |
| `genres` | `array` | List of genre strings. |
| `type` | `string` | 'basic', 'premium', or 'convai'. |

### `storyContents` Collection (Firestore)

Stores the content for each individual page within a story. Each document represents one page.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier (often `${storyId}_${pageNumber}`). |
| `storyId` | `string` | Reference to the parent story ID. |
| `pageNumber` | `number` | The order of the page (0-indexed or 1-indexed). |
| `textContent` | `string` | The narrative text for the page. |
| `imageUrl` | `string` | HTTPS URL to the page's image. |
| `audioUrl` | `string` | **(Optional)** HTTPS URL to the page's narration audio. |

## 4. File Storage Structure

All user-generated assets are stored in Firebase Cloud Storage, organized by user and story ID.

```
/users/{userId}/
    stories/
        {storyId}/
            images/
                cover.png
                page_1.png
                page_2.png
            audio/
                narration_1.mp3
                narration_2.mp3
    assets/                 <-- General reference assets
        characters/
        locations/
```

The `assetsIndex.ts` Cloud Function automatically listens to storage events and indexes metadata for these user-uploaded assets into a Firestore collection named `assetsIndex`. This serves as a searchable catalog of all user assets.

## 5. Implementation Status

1.  **Database Schema:** The Firestore schema for `stories` and `storyContents` is fully implemented and in use by the application.
2.  **Dynamic Route:** The application uses `src/app/story/[storyId]/page.tsx` to dynamically load and display stories based on the URL parameter.
3.  **Story Reader Component:** The `StoryReader` component (`src/components/StoryReader.tsx`) is fully functional. It fetches story data, handles navigation, plays audio, and renders images/text dynamically.
4.  **Create Story Flow:** The multi-step creation process (`/create/begin`, `/create/support`, `/create/scenes`) correctly creates `stories` documents, uploads assets to the structured storage paths, and creates `storyContents` documents for each page.
5.  **Discover Page:** The `src/app/discover/page.tsx` page queries the `stories` collection (filtering for public/published stories) and displays them in a grid, linking correctly to the dynamic reader route.
