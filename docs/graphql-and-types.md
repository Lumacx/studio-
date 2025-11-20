### GraphQL Schema and TypeScript Types Documentation

**Note:** The project's data architecture has evolved. While `src/lib/types.ts` (or specifically `src/lib/story-types.ts`) remains the central source of truth for TypeScript interfaces, the reliance on a manually built GraphQL API via Pothos (`src/graphql/*`) has been largely superseded or complemented by direct Firestore interactions and Firebase Data Connect usage. The `src/graphql` folder and its contents may be deprecated or used only for specific legacy or administrative functions.

#### Overview

Currently, the application primarily interacts with data through two methods:
1.  **Direct Firestore Access:** Using the Firebase Client SDK (`src/lib/firebase.ts`) and custom hooks (e.g., `useCreateStory`, `useListStoriesByUser`) to read/write documents directly to Cloud Firestore.
2.  **Firebase Data Connect:** Leveraging the generated SDKs in `dataconnect-generated/` to interact with the PostgreSQL database for relational data needs, defined by the schema in `dataconnect/schema/schema.gql`.

#### Key TypeScript Type Definitions

The core data models are defined in TypeScript interfaces to ensure type safety across the application (components, hooks, and API routes).

*   **`src/lib/story-types.ts`**: Defines the structure for `StoryView` (published/read-ready story), `Draft` (story in progress), and `ReaderPage` (individual page content). This is the primary file for story-related types.
*   **`src/lib/types.ts`** (and `src/lib/types.shared.ts`): Defines broader application types, including `User` profiles, `Comment`, `Reaction`, and potentially shared interfaces for API responses.

#### Legacy GraphQL (Pothos) Integration

*   **Status:** The files in `src/graphql/` (including `builder.ts`, `schema/story.ts`, etc.) represent a code-first GraphQL schema built with Pothos.
*   **Usage:** If active, this layer wraps the underlying data sources (Firestore/PostgreSQL) to provide a GraphQL endpoint (`/api/graphql`).
*   **Type Safety:** Pothos uses the TypeScript interfaces from `src/lib/types.ts` to enforce type safety in resolvers, ensuring that the GraphQL schema matches the application's internal data models.

#### Current Data Flow

Most active features (Story Reader, Story Creator, Discover Page) now fetch data as follows:
*   **Fetching a Story:** The `StoryReader` component uses direct Firestore fetches (via `getDoc` and `getDocs` on `storyContents` subcollection) to construct a `StoryView` object conforming to the interface in `src/lib/story-types.ts`.
*   **Saving a Story:** The Creation flow (`/create/*`) constructs a `Draft` object and saves it to Firestore using `setDoc` or `updateDoc`, ensuring fields match the expected schema.

This documentation reflects the current state where direct Firestore interaction is the dominant pattern for user-facing features, while the GraphQL definitions serve as a potential alternative or legacy layer.
