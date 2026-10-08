# Deploying Lexi

Prefer clicks and copy/paste? Follow [Publish Lexi using your browser](DEPLOYMENT_NO_CLI.md). The website build and single-file Dashboard function copies are prepared locally. Cloud deployment still needs to be completed in your accounts.

## 1. Install and authenticate

The project includes the Supabase CLI as a development dependency. Run `npm install`, then run `./scripts/deploy-backend.ps1` from PowerShell. It will open the Supabase login flow and may prompt for the database password while linking the project. Do not put the database password or Supabase access token in frontend configuration or commit them.

Equivalent commands if you prefer each step separately:

```sh
npx supabase login
npx supabase link --project-ref pgxbzcsplpjtbvmtifta
npx supabase db push
npx supabase functions deploy vocabulary
npx supabase functions deploy review
npx supabase functions deploy reverse-search
npx supabase functions deploy ai
npx supabase functions deploy notifications
```

Migrations create the complete schema, RLS, explicit grants, transactional lexical saving, deletion, review submission, hourly request quotas, hybrid search and reminder claiming. Existing Auth users receive profiles/preferences through the backfill migration. Do not rerun the SQL manually on a partially migrated project; the CLI tracks applied migrations.

Each function has `verify_jwt = false` to accommodate modern publishable keys/asymmetric project JWTs. This does **not** make user operations public: every user endpoint calls `auth.getUser(bearerToken)` before reading data or running privileged queries. Notification dispatch instead requires the scheduler secret. See [Supabase authorization headers](https://supabase.com/docs/guides/functions/auth-headers).

## 2. Configure optional AI

Copy `supabase/secrets.example` to the ignored `supabase/secrets.local`. Supply `AI_API_KEY`. The default adapter uses OpenAI-compatible Chat Completions structured output and embeddings; the default teaching model is `gpt-4.1-mini`, with `text-embedding-3-small` at 1536 dimensions. You can set a different compatible provider/base URL/model on the server. A replacement embedding model must support 1536 output dimensions or requires a schema/index migration and reindex.

Remove blank optional secrets instead of uploading empty values. Set `ALLOWED_ORIGINS` to your exact development and production frontend origins, separated by commas. Never include a trailing slash in an origin. Upload secrets with:

```sh
npx supabase secrets set --env-file supabase/secrets.local
```

Alternatively enter them under Edge Functions → Secrets in the Supabase Dashboard. The Supabase runtime supplies the project URL and service-role key; never add those to the Vite env file. [Server secret documentation](https://supabase.com/docs/guides/functions/secrets)

Without an AI key, dictionary lookup, saving, definitions, pronunciation playback, recognition/reverse-recall/fill-blank practice, analytics and full-text search work. AI enrichment, semantic embeddings, sentence/free-text grading and tutor conversations require an API key and provider billing. Words saved before AI is enabled can be indexed using **Settings → Prepare meaning search**. Embeddings are generated once per unchanged sense. Dictionary-backed entries are reused without generating fresh learning notes on every view.

## 3. Configure authentication and email

Use email/password authentication. In Auth → URL Configuration, add the frontend origin and allowed paths for `/dashboard` and `/reset-password`. For local development, allow `http://127.0.0.1:5173/**` and/or `http://localhost:5173/**`. Set the production Site URL to the deployed HTTPS origin; use exact production redirects.

Configure custom SMTP for production confirmation and password-recovery emails. Supabase's default service sends only to organisation team addresses. [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp), [redirect setup](https://supabase.com/docs/guides/auth/redirect-urls)

## 4. Publish the frontend

Run `npm run build`. Deploy the `dist` directory to your chosen HTTPS static host. The repository includes Netlify and Vercel configuration with SPA fallbacks. Set these build-time variables on the host:

```env
VITE_SUPABASE_URL=https://pgxbzcsplpjtbvmtifta.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Keep `sw.js` uncached/revalidated so updates can be discovered. HTTPS is required for PWA installation and notifications outside localhost. Install via the browser's install control, or Lexi's Install button when the browser offers the install event. Previously saved words are downloaded after successful sign-in/sync and are available offline. The UI uses system fonts when the optional Google font request is unavailable.

## 5. Configure push after the learning loop works

Run `node scripts/generate-push-keys.mjs` yourself. It outputs VAPID public/private keys and a random cron secret. Save the values as server secrets, with a `VAPID_SUBJECT` such as `mailto:you@example.com`. Private values must stay out of source control.

In `supabase/schedules/reminders.sql`, replace `REPLACE_WITH_CRON_SECRET` with the same cron secret and run the SQL in the Supabase Dashboard. The schedule invokes notification dispatch every 15 minutes. Vault holds the secret; the cron command only references the Vault entry. Run the Vault creation once; update that named Vault secret if rotating credentials. The reminder engine checks each user's timezone, preferred time, daily limit, frequency, quiet hours, due active senses and existing subscriptions. There is at most one daily reminder row per user. Failed deliveries are retried up to three times, and expired subscriptions are removed. Browser delivery is best-effort; monitoring real sends is still required.

Enable practice reminders and save preferences inside Lexi, then enable notifications on each desired device. Browser support and permission are required. On iOS/iPadOS, install the PWA to the Home Screen before requesting web push. Speech recognition support is separate and may depend on a network service.

## 6. Verify the cloud deployment

Use two separate real test accounts after deployment:

1. Register/sign in, verify confirmation/recovery links and logout.
2. Save a word such as “run” and check its distinct dictionary senses. Save an encounter note; refresh and confirm persistence.
3. Sign in with the second account and confirm the first account's collection/history/conversations are inaccessible. Check RLS in the Dashboard; every user table is enabled.
4. Run recognition and reverse recall. Repeat the same request ID through a test client and confirm one event and one scheduling update.
5. Configure the AI key, prepare meaning search, search by description, and ask the tutor about saved-word history. Check function logs for controlled errors; do not log user prompts or keys.
6. Install the PWA, open saved words, disconnect and reload. Practise a deterministic recall question; reconnect and confirm exactly one new review event.
7. Configure push and the optional schedule, verify an eligible notification in your timezone, then confirm quiet hours and disabling reminders stop future delivery.

## Current boundaries

Pronunciation exercises compare the browser's recognised transcript against the word; professional acoustic pronunciation assessment is not included. Meaning search operates on indexed saved/shared senses rather than a complete worldwide dictionary. English is the initial lexical language. Offline free-text/usage grading and AI tutoring require connectivity. The implementation is a complete deployable first version; live backend/AI/push operation can only be verified after the credentials and deployment steps above.
