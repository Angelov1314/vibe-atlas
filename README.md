# Vibe Atlas

**源码公开，仅限非商用（source-available）。** Original application code is licensed under PolyForm Noncommercial 1.0.0; third-party code keeps its own license. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

A source-backed Chinese directory of vibe-coding tools and locally runnable generative models, with persistent community ratings, real-output Arena infrastructure, and an opt-in local deployment companion.

## What ships

- 14 tool families, 92 detailed categories, 159 tools; 40 models across 34 tasks.
- Search with Chinese/English task expansion, category and license filtering, GitHub heat sorting, local bookmarks, three-item comparison, project details and source links.
- Server-side authenticated community voting backed by Cloudflare D1, unique-vote updates, atomic rate limits, explainable risk weights, HMAC identity keys and appeals.
- Arena protocol and sample submission to private R2 objects, explicitly configured administrator review, blinded pair assignments and protocol-separated provisional Elo.
- Transparent cold starts: no fabricated votes, no invented Arena media or quality scores, no X global-ranking claim.
- A downloadable standard-library Python companion on loopback only, exact-origin/token pairing, three reviewed Docker recipes, inspectable plans and real job status; optional local Ollama grounded chat.

## Stack

React 19 / Vinext / TypeScript / Cloudflare Workers / D1 / R2. The public fork includes local DB/R2 binding names in `.openai/hosting.json`; it does not include the original owner’s hosted project identity. Configure a separate platform project if deploying to Sites.

## Start here

Open `START_HERE.md` and `docs/CODEX_HANDOFF.md` for the complete Chinese delivery instructions. This 2026-11-03 UI release includes all source, 199 project Markdown documents, migrations and a portable local setup.

## Development

Recommended Node.js 24 and pnpm 11.25.0. In a clean extracted directory:

```text
npm install --global pnpm@11.25.0
npm run install:ci
pnpm setup:local
pnpm dev
```

The standalone development address defaults to `http://localhost:5173`; use the actual terminal output. The managed environment preview must be started using `sites-preview start <checkout>`. `dev` and `build` prepare public Markdown downloads automatically. Use `pnpm typecheck`, `pnpm test:catalog`, `pnpm test`, and the Python command in the handoff for verification.

Bindings: `DB` (D1), `BUCKET` (R2). Migrations are generated under `drizzle/`; do not mutate migration history after deployment. Apply local migrations separately from hosted migrations.

## Runtime configuration

| Key | Required | Purpose |
| --- | --- | --- |
| IDENTITY_HMAC_SECRET | Yes for authenticated community writes | Random server secret of at least 32 characters; never expose to browser |
| SITE_ORIGIN | Production | Exact deployed origin for same-origin write verification |
| TURNSTILE_SECRET_KEY | Optional | Server-side challenge verification |
| TURNSTILE_SITE_KEY | Optional | Public challenge widget key; used by community votes and Arena |
| ADMIN_USER_ID | Required for moderation | Explicit Sites-verified user subject; no first-user administrator bootstrap |

Set production secrets through Sites environment tools. This repository publishes source code; it does not publish an existing private hosted site. Authentication verifies a platform identity, not a person's uniqueness across all accounts.

## Important operational boundaries

- X API is not configured. Search engine hits are not X mention counts.
- No historical star-growth series exists at first launch. Only available signals contribute; data coverage is displayed.
- Community starts at zero real votes. No seed user identities are inserted.
- Arena starts without verified outputs. New uploads remain pending until the configured administrator validates protocol, provenance and publication rights. They cannot silently enter rankings.
- Turnstile is not configured initially. The adaptive policy accepts normal authenticated use with rate limiting, but refuses operations requiring an unavailable challenge. This is not a production-grade guarantee against Sybil attacks.
- The campaign detector and verified usage attestation are extension points, not completed services. No raw IP tracking is introduced.
- The AI assistant initially uses source-backed catalog retrieval and explicit constraint handling. Generative answers require a locally paired Ollama model; there is no fake remote LLM.
- A browser cannot silently install software. One-time companion setup and explicit plan approval are necessary. Only the reviewed recipe IDs run. Other projects export a Codex task with official documentation and validation requirements.
- Hardware requirements are official conditional claims or unknown, never workstation measurements. No guarantee that a GPU fits every resolution/quantization/workflow.
- Software and model licenses differ. Source available is not automatically OSI open source; model weights may restrict commercial use.

## Verification

TypeScript checks, production build, database scoring/security tests, companion boundary tests, and browser flow checks are recorded in `docs/verification.md` when completed. Runtime tests do not claim actual GPU inference or container installation on the user's computer.

## Provenance

See `docs/catalog-sources.md`, `docs/model-sources.md`, `docs/ranking-policy.md` and `public/assets/PROVENANCE.json`. Project images are referenced by upstream URLs; third-party showcase bitmap files are not bundled. Their availability and display rights remain with their owners. They are never Arena evaluation samples.

## Design

Apple-inspired restrained product UI, refined using the unslop review approach after the original Impeccable pass. Current typography and component rules are in DESIGN.md; attribution and decisions are in docs/UNSLOP_REVIEW.md. Historical design artifacts are not the current specification. Explanations, algorithms, provenance and operating guidance ship as Markdown rather than repeated in-page microcopy.
