# Lexi — AI Vocabulary Tutor
## Complete PWA Build Specification

This document is the master specification for building an AI-first vocabulary learning Progressive Web App (PWA).

The application should be built with:

- React
- Vite
- TypeScript
- React Router
- Vanilla CSS
- Supabase
- PostgreSQL
- pgvector
- Supabase Edge Functions
- PWA support

---

# 1. Product Overview

## Goal

Build a personal vocabulary-learning application where a user can:

- save unfamiliar words
- understand meanings and different senses
- learn pronunciation
- practise saved words
- receive personalised review reminders
- search for words by meaning
- interact with an AI tutor
- track learning progress
- revisit weak words
- use spaced repetition

The application must **not** be designed as a generic chatbot with vocabulary features.

The core product is:

> User vocabulary + learning history + AI + spaced repetition + semantic search.

The AI should understand:

- words the user has saved
- word meanings and senses
- when the user learned a word
- how often the user has reviewed it
- whether they remember it
- mistakes they make
- words they struggle with
- words they have successfully used
- contexts in which they encountered words

---

# 2. Technology Stack

## Frontend

- React
- Vite
- TypeScript
- React Router
- Vanilla CSS
- PWA support
- Responsive/mobile-first UI

Do **not** use Tailwind.

## Backend

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage where necessary
- Supabase Edge Functions
- pgvector for semantic search

## AI

Use an LLM through server-side Edge Functions.

Never expose AI API keys in the browser.

Use structured JSON outputs for AI-generated data.

Use embeddings for semantic search.

Keep AI-provider-specific code isolated behind an AI service module.

---

# 3. Architecture

Use a modular monolith architecture rather than microservices.

High-level architecture:

```text
React PWA
    ↓
Supabase Auth
    ↓
Supabase Database / Edge Functions
    ↓
AI Orchestration Layer
    ↓
LLM / Embedding / Dictionary / Speech Services
```

The browser must never directly call privileged AI APIs.

Prioritise:

1. Correctness
2. Maintainability
3. Simple architecture
4. Good UX
5. AI capabilities
6. Performance
7. Cost control

---

# 4. Important Data Architecture Rule

Do not model the application simply as:

```text
users → words
```

Instead separate:

```text
Canonical lexical information
        +
User's relationship with the word
        +
Learning progress
        +
Review history
        +
AI-generated learning information
```

A word can have multiple meanings and parts of speech.

For example:

```text
run

Sense 1:
verb — move quickly on foot

Sense 2:
verb — operate/function

Sense 3:
noun — a period of running

Sense 4:
noun — a sequence or series
```

The user's learning progress may relate to a specific sense, not simply the word.

Therefore, model **words and word senses separately** from the beginning.

---

# 5. Database Schema

## Profiles

```text
profiles
--------
id
display_name
avatar_url
timezone
created_at
updated_at
```

---

## Canonical vocabulary

```text
words
-----
id
word
language
normalized_word
created_at
updated_at
```

```text
word_senses
-----------
id
word_id
part_of_speech
definition
simple_definition
usage_note
register
difficulty
created_at
updated_at
```

```text
word_examples
-------------
id
sense_id
sentence
source
created_at
```

```text
pronunciations
--------------
id
word_id
accent
ipa
audio_url
created_at
```

---

# 6. User Vocabulary

```text
user_words
----------
id
user_id
word_id
status
personal_note
source
encounter_context
discovered_at
created_at
updated_at
```

Possible statuses:

```text
new
learning
reviewing
mastered
archived
```

---

# 7. Learning Progress

```text
user_sense_progress
--------------------
id
user_id
sense_id

understanding_score
recall_score
usage_score
pronunciation_score

times_reviewed
times_forgotten
times_correct
times_used

last_reviewed_at
next_review_at

created_at
updated_at
```

---

# 8. Review History

```text
review_events
-------------
id
user_id
sense_id
review_type
result
difficulty
response_time_ms
created_at
```

Review types:

```text
meaning
recognition
active_recall
fill_blank
usage
pronunciation
reverse_recall
```

---

# 9. AI Interaction

```text
ai_sessions
-----------
id
user_id
title
created_at
updated_at
```

```text
ai_messages
-----------
id
session_id
role
content
created_at
```

Do not dump the entire conversation into every AI request.

The AI should retrieve only relevant context.

---

# 10. Reminders

```text
reminder_preferences
--------------------
id
user_id
enabled
preferred_time
timezone
daily_limit
created_at
updated_at
```

```text
reminders
---------
id
user_id
type
title
body
scheduled_for
status
created_at
sent_at
```

---

# 11. Embeddings

Use pgvector.

```text
word_sense_embeddings
---------------------
id
sense_id
content
embedding
created_at
updated_at
```

The embedding should represent the meaning, not merely the word.

For example:

```text
cumbersome — adjective

Difficult or awkward to use, carry, or deal with
because of size, complexity, or inconvenience.
```

Do not embed only:

```text
cumbersome
```

---

# 12. Row Level Security

Every user-owned table must have Row Level Security enabled.

A user may only read/write their own:

- profiles
- user_words
- user_sense_progress
- review_events
- ai_sessions
- ai_messages
- reminder_preferences
- reminders

Canonical vocabulary data such as:

- words
- word_senses
- word_examples
- pronunciations

may be readable to authenticated users.

Users must never be able to access another user's vocabulary or learning history.

Never trust a `user_id` supplied by the client.

Use the authenticated Supabase user ID.

---

# 13. Frontend Architecture

Recommended structure:

```text
src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   └── providers/
│
├── components/
│   ├── ui/
│   ├── vocabulary/
│   ├── review/
│   ├── quiz/
│   ├── ai/
│   └── reminders/
│
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Vocabulary.tsx
│   ├── WordDetails.tsx
│   ├── ReverseSearch.tsx
│   ├── Review.tsx
│   ├── Quiz.tsx
│   ├── Tutor.tsx
│   └── Settings.tsx
│
├── hooks/
│
├── lib/
│   ├── supabase.ts
│   ├── api.ts
│   └── utils.ts
│
├── services/
│   ├── vocabulary.ts
│   ├── review.ts
│   ├── quiz.ts
│   ├── tutor.ts
│   └── reminders.ts
│
├── types/
│
├── styles/
│   ├── globals.css
│   ├── variables.css
│   └── components/
│
└── main.tsx
```

Do not put all application logic inside React components.

Components should mainly handle:

- display
- user interaction
- loading states
- error states

Business logic should live in services/hooks.

---

# 14. Supabase Backend Architecture

Recommended structure:

```text
supabase/
├── migrations/
│
├── functions/
│   ├── ai/
│   │   ├── index.ts
│   │   └── tools/
│   │
│   ├── vocabulary/
│   │   └── index.ts
│   │
│   ├── reverse-search/
│   │   └── index.ts
│   │
│   ├── review/
│   │   └── index.ts
│   │
│   ├── notifications/
│   │   └── index.ts
│   │
│   └── _shared/
│       ├── ai/
│       │   ├── client.ts
│       │   ├── prompts.ts
│       │   ├── schemas.ts
│       │   ├── tools.ts
│       │   └── orchestrator.ts
│       │
│       ├── dictionary/
│       ├── embeddings/
│       ├── auth/
│       └── utils/
│
└── config.toml
```

---

# 15. AI Architecture

Do not build:

```text
POST /chat
→ send everything to AI
→ return text
```

Instead:

```text
User request
      ↓
AI Orchestrator
      ↓
Understand intent
      ↓
Select tools
      ↓
Retrieve relevant data
      ↓
AI reasoning
      ↓
Structured response
      ↓
Update learning state if necessary
```

AI tools should include:

```text
search_my_vocabulary
get_word
get_word_senses
get_word_history
search_word_meaning
semantic_search_vocabulary
get_words_due_for_review
get_weak_words
get_recently_learned_words
create_word
create_learning_note
generate_quiz
evaluate_answer
record_review
analyze_sentence
```

---

# 16. Example AI Interaction

User:

```text
What's that word I learned recently that means doing something without intending to?
```

The AI should:

1. Detect reverse vocabulary search.
2. Search the user's vocabulary semantically.
3. Find `inadvertently`.
4. Check learning history.
5. Return the word.

Example response:

```text
I think you're looking for "inadvertently".

You saved it 3 days ago.

It means doing something without intending to.
```

---

# 17. Personalised AI Tutor

User:

```text
I don't really understand how to use meticulous.
```

The AI should:

1. Find `meticulous`.
2. Retrieve its senses.
3. Check the user's previous attempts.
4. Identify whether recognition is strong but usage is weak.
5. Generate a usage-focused exercise.

Do not simply return another dictionary definition.

The AI should behave like a tutor that knows the user's learning history.

---

# 18. Reverse Meaning Search

User enters:

```text
something that means doing something secretly
```

Flow:

```text
Query
 ↓
Generate embedding
 ↓
Semantic search
 ↓
Retrieve matching senses
 ↓
Check user's vocabulary
 ↓
Rank results
 ↓
AI explains distinctions
```

Potential result:

```text
Words you may be looking for:

1. covertly
2. clandestinely
3. surreptitiously
4. stealthily

From your vocabulary:
✓ surreptitiously

You learned this on September 28.
```

Search should combine:

- exact search
- PostgreSQL/full-text search
- semantic search
- user vocabulary filtering

---

# 19. Adding a Word

User enters:

```text
cumbersome
```

Frontend calls:

```text
vocabulary/analyze
```

Backend:

1. Normalize word.
2. Check database.
3. Retrieve existing lexical data if available.
4. Call dictionary/lexical provider if necessary.
5. Generate AI learning information.
6. Save word.
7. Save senses.
8. Save examples.
9. Generate embedding.
10. Create `user_words` record.
11. Create initial learning schedule.

Example UI:

```text
cumbersome

/kum-bər-səm/

adjective

Difficult or awkward to use, carry, or deal with.

Simple meaning:
Something that is inconvenient because it is
large, complicated, or difficult to handle.

Example:
"The old system was cumbersome and slow."

Useful phrases:
• cumbersome process
• cumbersome system
• cumbersome equipment

Similar:
awkward
unwieldy
complicated
```

Actions:

```text
[ Hear pronunciation ]

[ I understand it ]

[ Practice it ]
```

---

# 20. AI-Generated Content Rules

Never blindly save arbitrary LLM text into the database.

AI-generated lexical information must be returned as structured JSON.

Validate the response before saving.

If the AI returns invalid data:

- do not save it
- return a controlled error
- log the failure

Example:

```json
{
  "word": "meticulous",
  "senses": [
    {
      "part_of_speech": "adjective",
      "definition": "...",
      "simple_definition": "...",
      "usage_note": "...",
      "examples": ["..."]
    }
  ],
  "register": "neutral",
  "difficulty": "advanced"
}
```

---

# 21. Learning Engine

Start simple.

Do not build an extremely complicated spaced-repetition algorithm in V1.

Initial schedule:

```text
New word
   ↓
1 day
   ↓
3 days
   ↓
7 days
   ↓
14 days
   ↓
30 days
   ↓
60 days
```

If the user gets it wrong:

```text
Reset to 1 day
```

If they repeatedly get it right:

```text
Increase interval
```

Later, replace this with a more sophisticated algorithm such as FSRS if needed.

---

# 22. Review Session

Dashboard:

```text
Good morning

7 words ready for review

[ Start Review ]
```

Example:

```text
What does "meticulous" mean?
```

After the answer:

```text
✓ Correct

Very careful about details.

Example:
"She was meticulous when checking the report."

[ Continue ]
```

Use multiple question types:

- meaning recognition
- active recall
- fill in the blank
- reverse recall
- sentence creation
- usage selection
- pronunciation

---

# 23. Reverse Recall

This is especially important.

Instead of:

```text
What does "surreptitiously" mean?
```

also ask:

```text
What word means:

"doing something secretly so that other people
don't notice"?

Type the word.
```

Expected answer:

```text
surreptitiously
```

This tests whether the user can retrieve the word rather than merely recognise it.

---

# 24. Reminders

Reminders should be intelligent.

Do not simply send:

```text
Time to study!
```

Instead, calculate what the user actually needs.

Example:

```text
7 words are due today.
2 of them are words you've struggled with.
```

Notification:

```text
Your vocabulary is waiting 📚

You have 7 words ready for review.

5 minutes is enough.
```

Another example:

```text
Let's revisit a difficult word.

You haven't reviewed "cumbersome" recently.
```

---

# 25. Reminder Preferences

Settings:

```text
Practice reminders

[ ON ]

Preferred time
09:00 AM

Daily review limit
10 words

Reminder frequency
Daily

Quiet hours
10:00 PM – 7:00 AM
```

Store the user's timezone.

Do not assume everyone uses the same timezone.

---

# 26. PWA Requirements

The application must:

- install on desktop
- install on Android
- work responsively on mobile
- have an app icon
- have a web app manifest
- have a service worker
- cache the application shell
- show offline state
- allow previously saved vocabulary to be viewed offline

Do not attempt to make every AI feature work offline.

Offline mode should primarily support:

- saved words
- word details
- basic review data

AI features require connectivity.

---

# 27. Push Notifications

Implement push notifications after the core app works.

Architecture:

```text
Browser
   ↓
Permission
   ↓
Push subscription
   ↓
Supabase
   ↓
Stored subscription
   ↓
Scheduled reminder job
   ↓
Push notification
```

Add:

```text
push_subscriptions
------------------
id
user_id
endpoint
p256dh
auth
created_at
```

The reminder engine determines:

```text
Who should receive a reminder?
What should it say?
When should it be sent?
```

The push system handles delivery.

---

# 28. Dashboard

The dashboard should feel like a learning application, not an admin panel.

Suggested layout:

```text
Good morning

Ready to improve your vocabulary?

┌───────────────────────┐
│  7 words              │
│  ready for review     │
│                       │
│  [ Start Review ]     │
└───────────────────────┘

Your progress

Words learned       84
Due today             7
Mastered             31

Recent words

meticulous
cumbersome
inadvertently

[ View vocabulary ]

──────────────────────

Ask your AI tutor

"What word means...?"

[ Search by meaning ]

──────────────────────

Today's challenge

Use one of your new words
in a sentence.
```

---

# 29. Vocabulary Page

Include:

```text
Search

[ Search your vocabulary... ]

Filters:
All
Learning
Reviewing
Mastered

Sort:
Recently added
Due for review
Most difficult
Alphabetical
```

Word card:

```text
meticulous
adjective

Very careful about details.

Next review:
Tomorrow

Recall:
72%
```

---

# 30. AI Tutor Page

The AI tutor should support natural language.

Examples:

```text
What does meticulous mean?

What's the difference between discreet and discrete?

Give me a sentence using cumbersome.

Quiz me on words I learned this week.

What words am I struggling with?

What was that word I learned that means doing
something without intending to?

Help me practise words related to secrecy.
```

The AI should use tools rather than answering everything from general knowledge.

---

# 31. AI Context Strategy

Do not send all user data to the model.

For every request:

```text
User request
     ↓
Intent detection
     ↓
Retrieve relevant user data
     ↓
Build minimal context
     ↓
AI
```

Example:

```text
"What am I struggling with?"
```

Retrieve:

- weak words
- recent reviews
- failed questions

Do not retrieve:

- every word the user has ever saved
- every AI conversation

This reduces cost and improves response quality.

---

# 32. Semantic Search

Use embeddings for:

- word senses
- user meaning searches
- similar-word search
- concept search

Example embedding:

```text
cumbersome — adjective

Difficult or awkward to use, carry, or deal with
because of size, complexity, or inconvenience.
```

Do not embed only:

```text
cumbersome
```

---

# 33. Hybrid Search

Use:

```text
Exact search
+
Postgres/full-text search
+
Semantic search
+
User vocabulary filtering
```

This allows both:

```text
meticulous
```

and:

```text
very careful about tiny details
```

to find the appropriate word.

---

# 34. Edge Function Design

Do not create dozens of tiny Edge Functions.

Group related functionality.

For example:

```text
ai
```

handles AI requests and tools.

```text
vocabulary
```

handles:

- add
- get
- update
- delete
- analyze

```text
review
```

handles:

- due
- start
- submit
- complete

```text
reverse-search
```

handles semantic meaning searches.

```text
notifications
```

handles push/reminder operations.

---

# 35. Security Requirements

Never expose:

- AI API keys
- service role keys
- privileged database credentials
- push notification private keys

to the frontend.

Frontend may contain:

- Supabase project URL
- Supabase publishable key

All privileged operations happen server-side.

---

# 36. Error Handling

Every API request should handle:

- loading
- success
- empty
- validation error
- authentication error
- network error
- AI error
- rate limit
- unknown error

Avoid showing generic messages everywhere.

For example:

```text
We couldn't look up this word right now.

Your word has not been lost.
Please try again.
```

---

# 37. AI Cost Control

Design for reasonable AI costs.

Rules:

- Do not call the LLM unnecessarily.
- Cache canonical word information.
- Do not regenerate embeddings when nothing changed.
- Do not regenerate word analysis every time a user opens a word.
- Generate embeddings once per sense unless the semantic content changes.
- Use simpler/cheaper AI operations for classification and simple evaluation.
- Use stronger models for tutoring, nuanced explanations, sentence feedback and difficult semantic reasoning.

---

# 38. Development Phases

Do not build everything at once.

## Phase 1 — Foundation

Build:

```text
React + Vite
TypeScript
Routing
Supabase
Authentication
Database
RLS
Basic PWA setup
Basic design system
```

Deliverable:

> User can register, log in and log out.

---

## Phase 2 — Vocabulary

Build:

```text
words
word_senses
word_examples
user_words
vocabulary page
add word
word details
delete/archive word
```

Initially use mocked lexical data if necessary.

Deliverable:

> User can save and manage vocabulary.

---

## Phase 3 — AI Word Analysis

Add:

```text
AI Edge Function
AI provider
Structured output
Word analysis
Examples
Simple definitions
Usage notes
```

Deliverable:

> User types "cumbersome" and gets a useful structured vocabulary entry.

---

## Phase 4 — Learning Engine

Add:

```text
user_sense_progress
review_events
review scheduling
review UI
active recall
meaning questions
```

Deliverable:

> User can actually learn and review words.

---

## Phase 5 — Semantic Search

Add:

```text
pgvector
Embeddings
Embedding generation
Semantic search RPC
Reverse-search UI
```

Deliverable:

> User can type "doing something secretly" and find appropriate vocabulary.

---

## Phase 6 — AI Tutor

Add:

```text
AI orchestrator
Tool calling
Personal vocabulary retrieval
Learning-state retrieval
AI tutor UI
```

Deliverable:

> AI understands the user's actual vocabulary and learning history.

---

## Phase 7 — Intelligent Reminders

Add:

```text
reminder_preferences
reminders
review scheduling integration
push subscriptions
notification delivery
```

Deliverable:

> The app reminds users when they actually have vocabulary that needs practice.

---

## Phase 8 — PWA Polish

Add:

```text
Offline caching
Install experience
Push notifications
Mobile optimisation
Loading states
Empty states
Error states
```

---

## Phase 9 — Analytics and Polish

Track:

```text
Words added
Reviews completed
Review accuracy
Words forgotten
Words mastered
Usage attempts
Pronunciation attempts
Daily practice
Streak
```

Then build:

```text
Progress dashboard
Weak-word insights
Learning statistics
```

---

# 39. Instructions for Codex

Do not:

- build the entire application in one file
- put database logic inside React components
- expose AI API keys
- use service-role keys in the browser
- skip RLS
- make the AI the only source of lexical truth
- store every AI response as arbitrary text
- treat a word as having only one meaning
- send the entire user database to the LLM
- build microservices
- over-engineer the first version
- implement advanced spaced repetition before basic review works
- build push notifications before the core learning loop works
- use Tailwind
- replace TypeScript with JavaScript
- use Firebase
- hardcode user-specific data
- create fake backend APIs when Supabase is available

---

# 40. Recommended Codex Workflow

Do not give Codex the entire specification and simply say:

> Build everything.

Instead, provide the master specification first.

### First prompt

```text
Read the project specification carefully.

Do not write application code yet.

First:

1. Inspect the existing repository.
2. Determine what already exists.
3. Propose the folder structure.
4. Propose the database schema.
5. Identify any architectural conflicts.
6. Give me the implementation phases.

Do not make changes yet.
```

Review its response before proceeding.

### Second prompt

```text
Implement Phase 1 only.

Set up:

- React
- Vite
- TypeScript
- React Router
- Supabase client
- Authentication
- Base PWA configuration
- Global CSS/design tokens

Do not implement vocabulary, AI, quizzes, reminders or other future features yet.

Run the appropriate checks after implementation and fix any errors.
```

Then:

```text
Implement Phase 2 only.

Create the database migrations and RLS policies first.

Then implement the vocabulary UI and services.

Do not move on to Phase 3.
```

Continue one phase at a time.

---

# 41. Final Architecture

```text
                         ┌─────────────────────┐
                         │        USER         │
                         │                     │
                         │ Browser / Mobile    │
                         │ Installed PWA       │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    React + Vite     │
                         │                     │
                         │ Dashboard           │
                         │ Vocabulary          │
                         │ Review              │
                         │ Quiz                │
                         │ AI Tutor            │
                         │ Reverse Search      │
                         │ Settings            │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Supabase Auth     │
                         └──────────┬──────────┘
                                    │
                                    ▼
                 ┌──────────────────────────────────┐
                 │       Supabase Backend            │
                 │                                  │
                 │ Vocabulary                       │
                 │ Learning Engine                  │
                 │ AI Orchestrator                  │
                 │ Semantic Search                  │
                 │ Review Engine                    │
                 │ Reminder Engine                  │
                 └───────────────┬──────────────────┘
                                 │
               ┌─────────────────┼─────────────────┐
               │                 │                 │
               ▼                 ▼                 ▼
        ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
        │ PostgreSQL  │   │  pgvector   │   │  Storage    │
        │             │   │             │   │             │
        │ Words       │   │ Embeddings  │   │ Audio       │
        │ Senses      │   │ Semantic    │   │ Assets      │
        │ Progress    │   │ Search      │   │             │
        │ Reviews     │   │             │   │             │
        │ Reminders   │   │             │   │             │
        └─────────────┘   └─────────────┘   └─────────────┘
               │                 │
               └────────┬────────┘
                        ▼
                 ┌───────────────┐
                 │ AI Services   │
                 │               │
                 │ LLM           │
                 │ Embeddings    │
                 │ Dictionary    │
                 │ Speech        │
                 └───────────────┘

                        │
                        ▼
                ┌─────────────────┐
                │ Push / Reminder │
                │ Notifications   │
                └─────────────────┘
```

---

# 42. Repository Documentation

Create these files in the repository:

```text
/docs/PROJECT_SPEC.md
/AGENTS.md
```

`PROJECT_SPEC.md` should contain the full product and architecture specification.

`AGENTS.md` should contain:

- coding rules
- architecture rules
- commands
- testing requirements
- security requirements
- database/RLS rules
- frontend conventions
- "do not do" rules
- instruction to read `PROJECT_SPEC.md` before making architectural changes

The specification should be treated as the source of truth for the project.

---

# 43. Core Product Principle

The most important design principle is:

> The application should become more useful as it learns how the user learns.

The AI should not merely know what words mean.

It should eventually know:

```text
What words does this user know?
What words are they forgetting?
What meanings do they confuse?
What words do they struggle to use?
What words have they recently learned?
What contexts have they encountered them in?
What should they practise today?
What should they be reminded about?
```

That persistent learning state is what turns the application from an AI-powered dictionary into an **AI vocabulary tutor**.
