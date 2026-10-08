# Publish Lexi using your browser

You do not need to run terminal commands for this first deployment. The `dist` folder is already built with your Supabase URL and publishable key. The backend files in `supabase/dashboard-deploy` are generated from the existing source and contain no private credentials.

## 1. Put the website online

1. Sign in to Netlify and open https://app.netlify.com/drop.
2. Open this project's folder in Windows File Explorer.
3. Drag the entire `dist` folder onto the Netlify upload area. Do not upload the entire project or `.env.local`.
4. Open the HTTPS website address Netlify gives you and keep it handy.

You can now see the website. Saving words requires the backend steps below. No Netlify build environment variables are needed for this already-built upload.

## 2. Create the database

Use this step only if you have not already applied Lexi's database migrations. In your Supabase project's Table Editor, if Lexi tables such as `words` and `user_words` already exist, stop and check what was applied rather than rerunning this setup.

1. Open `supabase/dashboard-deploy/setup.sql` in VS Code and copy the entire file.
2. Open https://supabase.com/dashboard/project/pgxbzcsplpjtbvmtifta/sql/new.
3. Paste the SQL into a new query. Use the `postgres` role and click **Run**.
4. Wait for success before continuing. If it fails, save the error and do not proceed with a partial setup. The file wraps all four migrations in a transaction.

This manual setup does not populate the CLI's migration history. Before switching to CLI deployment later, reconcile that history rather than running the same migrations again.

## 3. Deploy five functions

In Supabase, open **Edge Functions → Deploy a new function → Via Editor**. For each row below, replace the entire default `index.ts` content with the complete contents of the corresponding prepared file. Use the exact function name and click **Deploy function**.

| Function name | File to copy from `supabase/dashboard-deploy` |
| --- | --- |
| `vocabulary` | `vocabulary.ts` |
| `review` | `review.ts` |
| `reverse-search` | `reverse-search.ts` |
| `ai` | `ai.ts` |
| `notifications` | `notifications.ts` |

For each deployed function, open its settings and turn off the platform's **Verify JWT** setting (it may be labelled **Verify JWT with legacy secret**), then save. This matches `supabase/config.toml`. Lexi validates user sessions inside the function with Supabase Auth; scheduled notification dispatch uses a separate secret. Shared code and versioned npm imports are already included in these prepared files; do not paste the original function entrypoints instead.

## 4. Allow your website

Replace `https://YOUR-SITE.netlify.app` below with your actual Netlify address, with no trailing slash.

1. In **Edge Functions → Secrets**, save a secret named `ALLOWED_ORIGINS` with your website address as its value.
2. In **Authentication → URL Configuration**, set **Site URL** to your website address.
3. Add these **Redirect URLs** and save:
   - `https://YOUR-SITE.netlify.app/dashboard`
   - `https://YOUR-SITE.netlify.app/reset-password`

For AI features, also add your provider's API key as the `AI_API_KEY` secret in Supabase. Do not add it to the frontend files or Netlify upload. Without that key, dictionary lookup, saving words and basic review work; AI tutoring and AI grading require the key and an active provider account.

## 5. Try it

Open your Netlify website, register, confirm the email, and sign in. For this first test, use the email address belonging to your Supabase organisation team account: Supabase's default email service only sends to team addresses. Configure custom SMTP in Supabase Authentication settings before inviting other users.

Add a word, save it, and refresh to confirm it is still there. Then try a review. If the tutor fails, check the `AI_API_KEY` secret and the `ai` function's logs.

Push reminder credentials and scheduling can be configured afterward using the push section in `DEPLOYMENT.md`; they do not block vocabulary learning.

Future frontend updates require a fresh build before uploading `dist` again. Ask Codex to prepare that build if you want to continue avoiding terminal commands. Regenerate the dashboard function copies when backend source changes.

References: [Netlify drag-and-drop deployment](https://docs.netlify.com/manage/projects/add-new-project/), [Supabase dashboard function editor](https://supabase.com/docs/guides/functions/quickstart-dashboard), [Supabase secrets](https://supabase.com/docs/guides/functions/secrets), [Supabase email restrictions](https://supabase.com/docs/guides/auth/auth-smtp).
