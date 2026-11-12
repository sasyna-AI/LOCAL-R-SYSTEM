# SASYNA – The World of Research

A local-first research workspace for KMTC students to prepare proposal and dissertation documents using LM Studio on Windows 11.

## Run & Operate

- `pnpm --filter @workspace/sasyna run dev` — run the SASYNA web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- The initial local-first app stores data in the user's browser on that device; do not wire it to the workspace PostgreSQL database.
- No Supabase, Cloudflare R2, or paid AI API services are part of this product.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Web app: `artifacts/sasyna/`
- Shared API: `artifacts/api-server/`
- Product contract: `lib/api-spec/openapi.yaml`

## Architecture decisions

- The primary AI engine is LM Studio running locally on the user's Windows 11 laptop; Qwen, Gemma, and DeepSeek are configurable model choices.
- Proposal exports should follow the lecturer's uploaded KMTC sample: about 40 pages, concise section lengths, a paginated contents page, and complete appendices.
- Keep generated proposal text clean: no repeated section headings or Markdown asterisks; abbreviations are limited to 12 entries and 60 words.
- Keep the conceptual framework and appendix tables together on a page; move them to the next page instead of splitting them.
- Research documents, student information, and academic knowledge sources stay local by default. Cloud sync is excluded.
- Internet is optional and only for clearly labeled reference verification, geographic data, and updates.
- Never fabricate AI responses, research findings, or academic references; report missing local model/source capability explicitly.

## Product

The app supports KMTC proposal and dissertation workflows, local academic-source management, local LM Studio-assisted drafting, and exportable Word documents.

## User preferences

- Clearly distinguish offline-ready features from features that require internet access.
- Never send student data, research documents, prompts, or knowledge-base content to cloud storage or AI services.

## Gotchas

- The Replit preview cannot reach LM Studio on the user's laptop. Local AI must only be reported as connected when the locally run app can verify the LM Studio endpoint.
- The supplied template repeats “Data collection process” in sections 3.9 and 3.10; use “Data collection tools” for 3.10 while retaining the section order.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
