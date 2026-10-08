# Lexi — AI Vocabulary Tutor

A personal vocabulary PWA built with React, Vite, TypeScript, React Router, vanilla CSS and Supabase. The supplied UI references inform the navy, lavender and coral design. The master specification is in [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md).

## Run locally

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and supply the Supabase project URL and **publishable** key. The supplied project's frontend configuration is already saved locally. Privileged credentials never belong in Vite variables.

## Backend setup is required

The app calls real Supabase APIs. The frontend credentials do not grant permission to install the database or functions. No production records, test accounts or sample vocabulary are created by the application. Before saving words, deploy the migrations and functions using [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

```powershell
& ./scripts/deploy-backend.ps1
```

The script asks you to log in, links the specified project, applies migrations, optionally uploads `supabase/secrets.local`, and deploys the five Edge Functions. It stops on errors. Review it before running on an existing project.

## Features

- Registration, email confirmation, login, password recovery and logout.
- Canonical words with separate senses, source attribution, examples and pronunciation audio; optional AI learning enrichment.
- Saved vocabulary with encounter source/context, notes, search, filters, sort, archive/restore and permanent removal.
- Per-sense review history and independent understanding, recall, usage and spoken transcript recognition scores.
- Review sessions and quizzes with recognition, reverse recall, active recall, fill-blank and sentence usage. Microphone practice uses browser speech recognition; it is not acoustic accent scoring.
- Simple 1/3/7/14/30/60-day scheduling with failed attempts reset to one day. Transactions and idempotency keys protect retries.
- Exact, full-text and pgvector meaning search. Without an AI key, search explicitly falls back to full-text search.
- Tool-assisted AI tutor with bounded vocabulary/history retrieval, persistent conversations, follow-up suggestions and saved-sense practice exercises.
- Review analytics, weak-word insights, timezone-aware streaks and JSON export.
- Reminder preferences, quiet hours, device subscriptions, VAPID push delivery and an optional scheduled job.
- Installable PWA, precached shell, user-scoped offline vocabulary and queued deterministic reviews. No AI APIs or user records are cached by the service worker.

## Checks

```sh
npm run build
npm test
npm run backend:check
npm run test:e2e
npm run test:pwa
```

Unit/database tests execute the actual migrations in embedded PostgreSQL with pgvector, a small Auth-schema fixture, and the same application roles. Browser tests run against the actual frontend with isolated **test-only** network fixtures. They do not establish that your cloud project is deployed or that a live AI key works. Cloud smoke tests are listed in the deployment guide.

## Architecture

`src/pages` renders screens; `src/services` owns data operations; providers manage auth, notifications and cached user state. `supabase/functions/_shared` isolates authentication, validation, dictionary access, embeddings, provider access and tutor tools. All user tables use RLS. Canonical lexical writes, review events, scores and scheduling are server-only. Public-key Edge requests validate their bearer tokens with Supabase Auth inside the handler.

The dictionary adapter uses [Free Dictionary API](https://dictionaryapi.dev/) and records returned source URLs and licences. AI enrichment preserves dictionary senses and validates structured output before persistence. Provider models, base URL and keys are server environment variables. See the [official structured-output documentation](https://developers.openai.com/api/docs/guides/structured-outputs) and [embedding documentation](https://developers.openai.com/api/docs/guides/embeddings).

The project includes frontend hosting configuration for Netlify/Vercel and generic SPA redirects. Hosting, Supabase setup, email delivery, AI credentials and notification scheduling must be configured separately; see the deployment guide.
