# DSH TraceLens

English | [中文](README.zh.md)

**See every agent step. Understand every token.**

DSH TraceLens is a visual execution explorer for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It turns the currently loaded Session into an interactive map of user input, model responses, Tool calls, system activity, failures, and per-call Token usage without adding another event store or changing the agent loop.

## Overview

The **Agent Map** view sits beside the existing conversation views and updates as the Session runs. Five stable lanes separate Input, Model, Tool, System, and Error records. Select any node to inspect the data already recorded for that event, including message content, model request details, reasoning, Tool arguments and results, timing, errors, retries, and nested calls when available.

Model usage is summarized in a conversation-wide 100% stacked dashboard. Selecting a model node highlights its matching segment and opens a four-metric Token card for input, output, cache-read, and reasoning usage. Recorded `callId` values connect model Tool requests to their results; ordinary adjacent records remain timeline-only relationships.

## Highlights

- **Live execution map** — new Session records appear without replacing the current zoom, pan, or node selection.
- **Token attribution** — compare every model call against the loaded conversation total and inspect exact recorded values.
- **Deep node inspection** — open type-specific details directly below a selected node instead of losing canvas width to a side panel.
- **Readable large workflows** — Fit mode starts at 100%, scales down to a 30% floor, and supports manual zoom plus synchronized two-axis panning.
- **Deterministic projection** — the browser renders the public conversation snapshot; it does not infer dependencies from text, timing, or proximity.
- **Native DSH integration** — the client plugin contributes through the official `conversation.view` slot and follows the host theme, locale, disposal, and reduced-motion behavior.

<a id="run"></a><a id="run-from-source"></a>

## Quick start

Prerequisites: Node.js `^22.19` or `>=24`, pnpm, and a DeepSeek API key for live model execution.

```sh
git clone https://github.com/BLueMooneer/dsh-tracelens.git
cd dsh-tracelens
pnpm install
pnpm run build
pnpm dsh web
```

Open `http://127.0.0.1:3080`, create or open a Session, then select **Agent Map**. The map also renders keyless fixture Sessions used by the assembled Web tests.

For operation and troubleshooting, read the [Agent Map user guide](docs/user/guide/agent-map.md). For implementation details and extension rules, read the [plugin README](packages/client/ui-agent-map/README.md).

## Architecture

DSH TraceLens remains inside DeepSeek Harness's plugin architecture:

```text
Session projection
      ↓
pure graph projection
      ↓
Agent Map client plugin
      ↓
conversation.view slot
      ↓
DSH Web UI
```

The graph model and layout are pure functions. React owns only live view state such as selection, fit/manual scale, and viewport position. The plugin adds no host service, persistence format, model-visible input, or second conversation projection.

The main implementation lives in [`packages/client/ui-agent-map`](packages/client/ui-agent-map). Web-profile composition is declared by [`packages/bundle/web-app`](packages/bundle/web-app).

## Development

Run focused Agent Map checks from the repository root:

```sh
pnpm exec tsc -p packages/client/ui-agent-map/tsconfig.json --noEmit
pnpm exec vitest run packages/client/ui-agent-map/tests
pnpm --filter @deepseek-ai/dsh-client-ui-agent-map bundle
pnpm run build:web
```

Repository-wide documentation and integration changes must also satisfy the applicable DeepSeek Harness checks described in [AGENTS.md](AGENTS.md).

## Project status

DSH TraceLens tracks the developer-preview DeepSeek Harness codebase, which can introduce compatibility-breaking changes. The current implementation is an integrated Web-profile fork rather than a separately versioned npm plugin.

## Upstream and license

Built on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) and [Cordis](https://github.com/cordiverse/cordis). Upstream community and contribution guidance remains available in the DeepSeek Harness repository.

[MIT](LICENSE). Third-party dependencies and their licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
