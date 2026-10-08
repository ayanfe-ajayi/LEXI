# Switch Lexi to Google's free AI tier

Your `GEMINI_API_KEY` in Supabase secrets is sufficient to select Google automatically
after deploying the updated functions. Existing OpenAI secrets are ignored when this
key is present. No private key belongs in Netlify, GitHub, or a `VITE_` variable.
In **Edge Functions → Secrets**, also set `AI_PROVIDER` to `gemini` to explicitly
select Google if you previously configured a different provider.

## 1. Update the existing database

In Supabase, open **SQL Editor → New query**. Copy all of
`supabase/dashboard-deploy/gemini-upgrade.sql`, paste it, and click **Run**.
This adds model tracking to search vectors and a service-only search function.
It preserves your vocabulary and learning history and can safely be run again.
Do **not** rerun `setup.sql` on your existing project.

## 2. Deploy four functions

Open **Edge Functions**. For each function below, open its code editor, replace
the entire `index.ts` with the corresponding file, and click **Deploy**:

| Function | File to copy |
| --- | --- |
| vocabulary | `supabase/dashboard-deploy/vocabulary.ts` |
| review | `supabase/dashboard-deploy/review.ts` |
| reverse-search | `supabase/dashboard-deploy/reverse-search.ts` |
| ai | `supabase/dashboard-deploy/ai.ts` |

Use these bundled files, not the source files under `supabase/functions`.
Keep the existing authentication configuration: platform JWT verification disabled;
the functions verify each signed-in user's token themselves.
The `notifications` function does not need to change for this upgrade.

## 3. Publish the frontend update

In VS Code **Source Control**, commit the changes and **Sync Changes** to GitHub.
Wait for your connected Netlify site to deploy successfully. Reopen the installed
PWA or use **Settings → Update Lexi** if an update is available.

## 4. Prepare your existing words for meaning search

In Lexi, open **Settings → Prepare meaning search**. Keep the page open until it
finishes. This replaces existing vectors with Google vectors for your active words.
It keeps the words and review history. Old vectors are excluded from Google's
semantic matching even before they are rebuilt.

If Google returns a quota error, retry later. Completed senses are cached and
skipped on retry. Google quotas and Lexi's hourly request limit both apply.
Archived words are excluded; restore them and prepare search if you want them indexed.

## 5. Check the app

- Add a new word and open its definitions.
- Ask the tutor to explain a saved word or give you a practice question.
- Try a usage review and check the feedback.
- Search for a saved word by its meaning.

If the semantic API is temporarily unavailable, meaning search uses text matches.
If an explanation fails, matching words still appear. Tutor chat and AI grading
report their error rather than inventing an answer. The shared word collection is
still the words already looked up in Lexi, not the entire English dictionary.

## Optional server settings

These are Supabase Edge Function secrets. The defaults need no additional setup.

| Secret | Default |
| --- | --- |
| `AI_PROVIDER` | `gemini` when `GEMINI_API_KEY` is present |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` |
| `GEMINI_TUTOR_MODEL` | `gemini-2.5-flash` |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-2` |

Changing the embedding provider or model requires preparing meaning search again.
Setting `AI_PROVIDER=openai` explicitly restores the original OpenAI-compatible
configuration using `AI_API_KEY`, `AI_BASE_URL`, and the original model secrets.
Lexi never automatically spends OpenAI credits when Google reaches its quota.

Google's [pricing](https://ai.google.dev/gemini-api/docs/pricing) lists free-tier
availability and data use; check your project's current
[quotas](https://ai.google.dev/gemini-api/docs/rate-limits) in AI Studio.
Model availability and free limits can change.
