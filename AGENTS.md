# AI Agent Guidelines for Member Manager

This document provides essential information for AI agents working on the Member Manager codebase.

## 1. Project Structure

The project is divided into two main parts:
- **`client/`**: Frontend application (Vite, React, TypeScript, MUI, Tailwind).
- **`server/`**: Backend API (Fastify, TypeScript, Zod, Supabase).

## 2. Build, Lint, and Test Commands

### Client (`/client`)

*   **Package Manager**: `pnpm`
*   **Install Dependencies**:
    ```bash
    cd client
    pnpm install
    ```
*   **Start Development Server**:
    ```bash
    cd client
    pnpm dev
    ```
*   **Build for Production**:
    ```bash
    cd client
    pnpm build
    ```
*   **Lint & Format**:
    ```bash
    cd client
    pnpm lint        # Check for issues
    pnpm lint:apply  # Fix issues automatically
    ```
    *Note: The project uses [Biome](https://biomejs.dev/) for linting and formatting.*

*   **Testing**:
    *   *Currently, there are no tests configured for the client.*
    *   *If adding tests, use Vitest.*

### Server (`/server`)

*   **Package Manager**: `pnpm`
*   **Install Dependencies**:
    ```bash
    cd server
    pnpm install
    ```
*   **Start Development Server**:
    ```bash
    cd server
    pnpm dev
    ```
*   **Build**:
    ```bash
    cd server
    pnpm build
    ```

## 3. Code Style & Conventions

### General
-   **TypeScript**: Use TypeScript for all new code. Avoid `any`; use specific types or Generics.
-   **Imports**:
    -   Use absolute imports where configured or relative imports that are clear.
    -   Group imports: External libraries first, then internal modules.
-   **Formatting**:
    -   Respect the `biome.json` configuration in `client/`.
    -   Use tabs for indentation (as seen in existing files).

### Frontend (`client/`)
-   **Framework**: React (Functional Components).
-   **Styling**:
    -   Hybrid approach: **MUI (Material UI)** components are used extensively.
    -   **Tailwind CSS** is available for utility classes.
-   **Folder Structure**:
    -   `src/features/`: Domain-specific features (e.g., `auth`, `members`, `sepa`).
    -   `src/components/`: Reusable shared components (`ui`, `layout`).
    -   `src/lib/`: Configuration and clients (Supabase, API).
    -   `src/types/`: Centralized type definitions.
-   **Naming**:
    -   **Components**: PascalCase (e.g., `MemberForm.tsx`).
    -   **Functions/Variables**: camelCase.
    -   **Interfaces**: PascalCase (e.g., `Member`).
-   **State Management**: Use React `useState` and `useEffect`. For complex global state, consider context (though mostly local state is currently used).
-   **Error Handling**: Use `try/catch` blocks for async operations (API calls). Display user-friendly error messages via UI feedback (e.g., setting a `message` state).

### Backend (`server/`)
-   **Framework**: Fastify.
-   **Validation**: Use **Zod** for schema validation.
-   **Database**: Supabase (PostgreSQL).
-   **Architecture**: Keep routes, services, and types organized.

## 4. Workflows

### Refactoring
1.  Analyze the existing code and dependencies.
2.  Plan the changes to minimize disruption.
3.  Apply changes using `edit` or `write` tools.
4.  **Verify**: Run `pnpm build` in the respective directory (`client` or `server`) to ensure no compilation errors were introduced.
5.  **Lint**: Run `pnpm lint` in `client/` to ensure code quality.

### Adding Features
1.  Identify the domain of the feature.
2.  If it fits an existing feature folder in `client/src/features/`, add it there. Otherwise, create a new feature folder.
3.  Define types in `client/src/types/` if they are shared.
4.  Implement the UI component.
5.  Implement the API integration in `client/src/lib/` or within the component using `apiClient`.

## 5. Security
-   **Secrets**: Never commit `.env` files or hardcode secrets (API keys, DB credentials).
-   **Supabase**: Ensure Supabase clients are initialized correctly using environment variables.

