# Lexi development rules

Read docs/PROJECT_SPEC.md before architectural changes. Use React, Vite, TypeScript, React Router, vanilla CSS, Supabase, pgvector, and grouped Edge Functions. Never use Tailwind or put database queries in presentation components.

Canonical words and senses are separate from user vocabulary, sense progress, and immutable review events. Authenticate requests server-side; derive the user from the bearer token. All user tables require RLS. Validate AI JSON before writing it. Never ship privileged credentials to the browser. Scope offline caches to the authenticated user and remove them on logout. AI tools must apply ownership filters and retrieve bounded context.

Commands: npm install; npm run dev; npm run build; npm test; npm run test:e2e. Check Edge Functions with the installed Deno executable and supabase/functions/deno.json. Backend migrations must preserve constraints and ownership. Review submission must be transactional and idempotent. Test learning intervals, wrong-answer resets, validation, authorization, and real browser flows. Do not claim cloud migrations or functions are deployed unless verified.
