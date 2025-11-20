# Narratum Documentation

## 1. Introduction

Narratum is a modern storytelling application that empowers creators to craft and share interactive and engaging narratives. The platform provides tools for building stories with rich multimedia content, guided by templates and enhanced by AI-powered writing assistance. This document provides a comprehensive overview of the Narratum project, its structure, and its core functionalities.

## 2. Project Structure

The Narratum project is organized into several key directories, each serving a specific purpose. This structure promotes a clean and maintainable codebase.

- **`src/`**: This is the main source code directory for the Next.js application.
  - **`app/`**: Contains the pages and routes of the application. Each subdirectory corresponds to a route (e.g., `/`, `/about`, `/create`).
    - **`page.tsx`**: The main landing page of the application.
    - **`create/`**: Directory for the multi-step story creation flow.
        - **`begin/page.tsx`**: Initial step: Metadata, template selection, and cover design.
        - **`support/page.tsx`**: Second step: Building a gallery of reference assets (characters, locations) and generating AI images.
        - **`scenes/page.tsx`**: Final step: Composing the story scenes (text, images, audio) and publishing.
    - **`discover/page.tsx`**: The page for discovering stories created by other users.
    - **`profile/page.tsx`**: The user's profile page.
    - **`ereader/page.tsx`**: The dedicated page for reading stories (`StoryReader` component wrapper).
    - **`subscription/page.tsx`**: Page for managing user subscriptions and purchasing credits.
  - **`components/`**: Holds the reusable React components used throughout the application. This includes both UI elements (e.g., buttons, cards) and higher-level components (e.g., header, footer).
  - **`context/`**: Contains the React context providers, such as the `AuthContext` for managing user authentication and credit status.
  - **`hooks/`**: Stores custom React hooks that encapsulate reusable logic (e.g., `useCreateStory`, `useAuth`).
  - **`lib/`**: Includes utility functions and libraries, such as the Firebase configuration (`firebase.ts`).
  - **`ai/`**: This directory contains the AI-related code, including Genkit flows and functions.
    - **`genkit.ts`**: The configuration file for the Genkit AI plugin.
    - **`flows/generate-writing-prompts.ts`**: The Genkit flow for generating AI-suggested writing prompts.
- **`public/`**: Stores static assets like images, fonts, and other files that are publicly accessible.
- **`docs/`**: Contains project documentation, including this file and the project blueprint.
- **`dataconnect/`**: This directory holds the configuration and schema for the DataConnect service, which manages the application's database.
- **`functions/`**: This directory contains the Firebase Cloud Functions that serve as the backend for certain operations, such as image generation and authentication triggers. It is a separate Node.js project managed by `npm`.
  - **`assetsIndex.ts`**: Indexes uploaded assets in Firestore for efficient querying.
  - **`authTriggers.ts`**: Creates user profile documents in Firestore upon new user registration.
  - **`commentCounter.ts`**: Firestore trigger to track comment counts on stories.
  - **`deductCreditsForRead.ts`**: Manages credit deduction when users read paid stories.
  - **`sendTipToWriter.ts`**: Facilitates tipping credits from readers to writers.
  - **`processPayPalOneTimePayment.ts`**: Logic for verifying and processing one-time credit purchases via PayPal.
  - **`paypalWebhook.ts`**: Handles PayPal webhooks for subscription updates and payment confirmations.

## 3. Core Features

Narratum offers a range of features designed to enhance the storytelling experience for both creators and readers.

- **Interactive Story Display with Multimedia Support**: Stories are presented in an interactive format, allowing users to navigate through pages and chapters with ease. This includes dynamic loading and display of:
    *   **Background Music**: Stories can feature background music that plays throughout the reading experience.
    *   **Page Backgrounds**: Each story page can have a unique background image.
    *   **Narrator Avatars**: The story reader displays the avatar of the story's creator.
    *   **Audio Narration**: Audio tracks for page narration.
    *   **Premium Features**: Integration of Convai AI agents and teaser videos for premium stories.
- **Template-Driven Story Creation**: The creation process is a guided flow (managed by `src/app/create/`) that assists users in defining initial prompts, selecting templates ("Three-Act Structure", "Hero's Journey"), and providing reference materials.
- **Story Content Editing**: A dedicated editor (`src/app/create/scenes/`) allows users to write text, generate/upload images, and add audio for each page. It supports auto-saving to local storage (drafts) and final publishing to Firestore.
- **AI Writing Prompts**: The application integrates with an AI tool to provide writing prompts based on story templates and user input.
- **User Authentication & Credit System**:
    *   **Multiple Auth Providers**: Google Sign-In (GSI), Email/Password, and Starknet Wallet connection.
    *   **Credit Management**: Centralized credit tracking via `AuthContext`. Credits are used to read premium stories and use AI generation tools.
    *   **Subscription & Payments**: Users can buy one-time credit packs or subscribe to plans via PayPal integration (`src/app/subscription/`).
- **Story Discovery Page with Search and Filtering**:
    *   **UI Implementation**: Grid display of story cards with rich metadata (author, comments, cost).
    *   **Semantic Search**: AI-powered search (`src/app/api/semantic-search/`) matches stories by theme/concept.
    *   **Advanced Filtering**: Filter by popularity, recency, genre, story type, plan, language, and author.
    *   **Tipping**: Readers can tip writers directly from the story card.
- **Profile Management**:
    *   **Avatar Management**: Users can upload and manage their avatars.
    *   **Story & Draft Lists**: Users can view their published stories, work-in-progress drafts, and favorited stories.
- **AI Image Generation**: 
    *   **Generation**: Creators can generate custom illustrations using AI (`generateNarratumImage` Cloud Function) based on text prompts.
    *   **Asset Management**: Generated images are saved to Firebase Storage and indexed for easy retrieval and assignment to story pages.
    *   **Describe Image**: AI capability to describe uploaded images for accessibility and prompting assistance.
- **Community Features**:
    *   **Reactions**: 'Like', 'love', 'wow' reactions for stories.
    *   **Comments**: Comment system with author attribution and real-time counters.

### 3.1. Story Creation Flow

The story creation process in Narratum is a guided, multi-step workflow:

1.  **Initial Story Setup (`src/app/create/begin/page.tsx`)**: Define story metadata (title, synopsis, genre, category, language), select a template, and design/upload a cover image. Premium features (Convai ID, teaser URL) are configured here.
2.  **Reference Gallery (`src/app/create/support/page.tsx`)**: Build a library of assets (characters, locations, audio) to use in the story. Includes tools for AI image generation and scene composition.
3.  **Scene Composition & Publishing (`src/app/create/scenes/page.tsx`)**: The main editor. Write text for each page, assign images from the gallery or generate new ones, add narration audio, and finally publish the story to the platform.

## 4. Technical Stack

The Narratum application is built with a modern and robust technology stack:

- **Frontend**:
  - **Framework**: [Next.js](https://nextjs.org/) (React) - App Router
  - **Styling**: [Tailwind CSS](https://tailwindcss.com/)
  - **UI Components**: [Shadcn/ui](https://ui.shadcn.com/)
- **Backend**:
  - **Serverless Functions**: [Firebase Functions](https://firebase.google.com/docs/functions)
  - **AI Integration**: [Genkit](https://firebase.google.com/docs/genkit), Gemini API
- **Database**:
  - **Service**: [DataConnect](https://firebase.google.com/docs/dataconnect) (PostgreSQL), Cloud Firestore
- **Authentication**:
  - **Providers**: [Firebase Authentication](https://firebase.google.com/docs/auth), [Starknet](https://www.starknet.io/)
- **Payments**:
  - **Provider**: PayPal (Standard Checkout & Subscriptions)

## 5. Data Model

The application uses a hybrid data model leveraging both PostgreSQL (via DataConnect) and Cloud Firestore.

- **Firestore Collections**:
  - **`stories`**: Stores story metadata, status, and configuration.
  - **`storyContents`**: Stores the actual page content (text, media URLs) for each story.
  - **`users`**: Stores user profiles, credit balances, and subscription status.
  - **`assetsIndex`**: An index of all user-uploaded files for quick querying.
  - **`comments`, `reactions`, `ratings`**: Sub-collections for community interaction.

## 6. Getting Started

To set up and run the Narratum project locally, follow these steps:

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd narratum
    ```
2.  **Install root dependencies (Next.js application)**:
    ```bash
    pnpm install
    ```
3.  **Install Firebase Functions dependencies**:
    ```bash
    cd functions
    npm install
    cd ..
    ```
4.  **Set up environment variables**:
    - Create a `.env.local` file in the root of the project.
    - Add the necessary Firebase, PayPal, and other configuration details to this file.
5.  **Run the development server**:
    ```bash
    pnpm run dev
    ```
6.  **Deploy Firebase Functions (if changes are made to functions)**:
    ```bash
    firebase deploy --only functions
    ```
7.  **Open the application**:
    - Open your browser and navigate to `http://localhost:3000`.
