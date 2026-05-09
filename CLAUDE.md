# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Kanna is a web UI for the Claude Code and Codex CLIs. It is a Bun + React app distributed on npm as `kanna-code`. The CLI entry is `bin/kanna` → `src/server/cli.ts`. Requires Bun ≥ 1.3.5.

## Commands

- `bun run dev` — runs Vite client (default port 5174) and Bun backend (5175) together via `scripts/dev.ts`. Accepts the same flags as the production CLI (`--port`, `--host`, `--remote`, `--share`, `--password`, `--cloudflared`). In dev, `--port N` sets the client to N and the backend to N+1.
- `bun run dev:client` / `bun run dev:server` — run them independently.
- `bun run build` — builds both the client (`vite build`) and the export-viewer (`vite build --config vite.export-viewer.config.ts`) into `dist/`.
- `bun run check` — `tsc --noEmit` plus both builds. Use this as the pre-commit gate; there is no separate lint step.
- `bun test` — Bun's built-in test runner. Run a single file with `bun test path/to/file.test.ts`, or filter by name with `bun test -t "pattern"`.
- `bun run start` — runs the production server directly from source (`src/server/cli.ts`).
- `bun run install:dev` — `bun install && bun run build && bun link` to test the global `kanna` command locally.

The published `files` field only ships `bin/`, `src/server/`, `src/shared/`, and the two `dist/` bundles — the client runs from `dist/client` in production but is served from Vite in dev.

## Architecture

The app is event-sourced with CQRS and a reactive WebSocket fan-out. The big picture (also drawn in README.md) is:

```
Browser (React + Zustand)
    ↕  WebSocket
Bun Server (HTTP + WS)
    ├── WSRouter        — subscription & command routing (src/server/ws-router.ts)
    ├── AgentCoordinator — multi-provider turn management (src/server/agent.ts)
    ├── ProviderCatalog  — provider/model/effort normalization (src/server/provider-catalog.ts)
    ├── QuickResponseAdapter — structured queries w/ provider fallback (src/server/quick-response.ts)
    ├── EventStore       — JSONL append + snapshot compaction (src/server/event-store.ts)
    └── ReadModels       — derived sidebar/chat/project views (src/server/read-models.ts)
    ↕ stdio
Claude Agent SDK / Codex App Server (local processes)
    ↕
~/.kanna/data/ + project dirs
```

Key invariants to preserve when changing server code:

- **Event sourcing.** All state mutations go through `EventStore` as appends to the JSONL files in `~/.kanna/data/` (`projects.jsonl`, `chats.jsonl`, `messages.jsonl`, `turns.jsonl`). On startup, Kanna replays the tail after `snapshot.json` and compacts when logs exceed 2 MB. Never mutate read models without going through an event.
- **CQRS split.** Writers append events; `read-models.ts` derives the views the client subscribes to. Sidebar / chat / project views are pushed, not polled — adding new view data means adding a derivation here, not a new endpoint.
- **Reactive broadcasting.** The `WSRouter` pushes fresh snapshots to subscribers on every state change. New mutations should result in the right read model being recomputed and re-broadcast; otherwise the UI silently goes stale.
- **Multi-provider coordination.** `AgentCoordinator` owns turn lifecycle across Claude (via `@anthropic-ai/claude-agent-sdk`) and Codex (via `codex-app-server.ts`'s JSON-RPC client). Provider/model/reasoning-effort strings are normalized through `provider-catalog.ts` — do not hard-code provider strings elsewhere.
- **Tool gating.** Plan mode and other approval flows depend on tool gating in the agent layer; transcript hydration in `src/shared/tools.ts` is provider-agnostic so the UI renders both providers uniformly.
- **QuickResponse fallback.** Lightweight structured queries (e.g. title generation) prefer Haiku and fall back to Codex via `QuickResponseAdapter`; preserve the fallback when adding new structured queries rather than calling a provider directly.

### Client

- `src/client/app/` holds the router, central state hook, and socket client. Treat the socket client as the only path to server state.
- `src/client/stores/` are Zustand stores for purely-local UI state (chat input, preferences, project order). Server-derived state should not be mirrored here — subscribe to the read model instead.
- `src/client/components/` renders messages, tool groups, plan-mode dialogs, and interactive prompts. Transcript rendering relies on the shared hydration in `src/shared/tools.ts`.

### Shared

`src/shared/` is the contract between client and server: `types.ts` (core data + provider catalog), `tools.ts` (tool normalization), `protocol.ts` (WS message protocol), `ports.ts`, `branding.ts` (`~/.kanna/data/` paths). Changing any of these is a breaking change to the WS protocol — bump both sides together.

### Export viewer

`src/export-viewer/` is a separate Vite bundle (`vite.export-viewer.config.ts`) used for standalone transcript exports. `scripts/prepare-export-viewer-release-assets.ts` packages it for release.

## CLI flags worth knowing when changing server boot

- `--port`, `--host`, `--remote` (`0.0.0.0`), `--no-open`
- `--password <secret>` — sets a session cookie; `/health` stays public for restart detection, all other API + `/ws` require auth
- `--share` — temporary `trycloudflare.com` tunnel + terminal QR; **incompatible with `--host`/`--remote`**
- `--cloudflared <token>` — runs a named Cloudflare tunnel

Embedded terminal uses Bun's native PTY APIs (macOS/Linux only) and the `@xterm/*` packages.
