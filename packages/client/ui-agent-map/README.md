# @deepseek-ai/dsh-client-ui-agent-map

English | [中文](README.zh.md)

Agent Map adds an interactive execution map to the Web conversation page. It projects the public browser conversation snapshot into five horizontal lanes—Input, Model, Tool, System, and Error—without adding a host service, session event, or second conversation projection.

The package is part of the repository's `web` profile. Start that profile and open a session; the **Agent Map** tab appears beside the existing conversation views. See the [user guide](../../../docs/user/guide/agent-map.md) for operation and troubleshooting.

## What the map shows

- Finalized conversation records, the frozen partial Assistant response, and running Tool calls from the currently loaded Session window.
- Visible node, turn, tool, and failure counts.
- A selected-node detail card directly below the node. Common fields include status, time, sequence, Turn/Step placement, and incoming relation; type-specific fields expose message content and source, model request/timing/reasoning, Tool arguments/results/errors, command outcome, compaction counts, or retry data when recorded. Tool arguments, Tool results, model reasoning, and model Tool calls use near-black text on a light content panel for readable long-form inspection in either host theme. A Tool result shows **Direct child calls** only when the conversation projection records one or more nested Code Mode dispatches; ordinary Tool calls correctly omit it. Clicking outside the selected node and its attached cards closes them.
- A conversation-wide 100% stacked usage bar that expands across the header's remaining space. Hovering or focusing the dashboard reveals only each call's exact total and percentage; selecting a Model node highlights its matching bar segment.
- Live fit-to-viewport scaling from 100% down to a 30% floor, manual zoom controls, pointer and Enter/Space selection, a synchronized bottom scrollbar, and an accessible graph label.

Gray edges state only that adjacent records appear in event-log order. A blue Tool edge is stronger: an Assistant block named the destination Tool call's exact `callId`. The map never infers causality from timing, prose, or proximity. When earlier history remains unloaded, the header says that the graph covers only the loaded Session window.

## Canvas scaling

The graph starts at 100% when its authored geometry fits. It measures available width and height whenever nodes arrive or the surrounding layout changes, then scales down only as far as 30%; a graph wider than that floor remains pannable instead of becoming unreadably small. **Zoom in** and **Zoom out** enter a bounded manual scale that remains stable as more nodes arrive; drag empty canvas space to pan the workflow horizontally or vertically, or use the bottom scrollbar for precise horizontal movement. Canvas drag and scrollbar positions stay synchronized. **Fit** returns to live fitting and resets the pan position. The five compact lane labels stay in a fixed left rail instead of scaling or moving horizontally with the SVG. Node ids, selection, keyboard focus, and the detail card attached below the selected node remain stable across zoom and pan changes.

An Assistant record containing only Tool-call blocks remains visible in the Model lane. This guarantees that every Token dashboard segment has exactly one canvas node; its recorded `callId` also marks and connects the corresponding Tool node.

## Token usage

Each finalized Assistant `usage` sample is validated at the public snapshot boundary and totaled as uncached input + output + cache reads + cache writes. `reasoningTokens` is displayed but is not added again because it is already included in `outputTokens`. Selecting a model response opens a two-by-two Token card above that node with `inputTokens`, `outputTokens`, `cacheReadTokens`, and `reasoningTokens`, highlights the same call's dashboard segment, and dims the other segments; selecting a dashboard segment selects that same canvas node. `cacheWriteTokens` remains part of totals but is omitted from the fixed four-cell quick card. The taller dashboard uses enlarged type, and its expanded call list matches the dashboard width. Its denominator is the sum of the loaded model calls, including Tool-call-only Assistant records, so every segment has one visible Model-lane node. It reports the loaded conversation window rather than a hidden all-history total. Calls without a recorded usage sample are absent instead of being estimated.

The presentation uses the host theme's semantic colors rather than fixed light or dark values: node accents, status text, focus outlines, edge glow, glass surfaces, and the canvas grid therefore retain their hierarchy in both appearance modes. A slow aurora, scanning beam, flowing Tool edges, running-node beacon, selected-node circuit, and spatial detail-card entrance add HUD motion without changing graph geometry or React state. `prefers-reduced-motion` disables every continuous or entrance animation. Status remains written on every node, so color is never its only indicator.

## Composition and dependency order

The client manifest declares locale, runtime, and conversation UI injections. The Web bundle must load those providers before this plugin can contribute its view. Registration itself uses `ctx.slots.inject('conversation.view', ...)`, so the declaration can appear later and Cordis still activates the contribution for the declaration lifetime. The returned disposer removes the view when that lifetime ends; reloads therefore do not accumulate duplicate tabs.

The repository Web profile already includes the package. A different composition must include `@deepseek-ai/dsh-client-ui-agent-map` in its browser roster and provide:

- `@deepseek-ai/dsh-client-locale`
- `@deepseek-ai/dsh-client-runtime`
- `@deepseek-ai/dsh-client-ui-conversation`

## Development

The pure projection is in [`src/client/graph.ts`](src/client/graph.ts); the React view is in [`src/client/AgentMapView.tsx`](src/client/AgentMapView.tsx); localized product copy is in [`src/client/locales.ts`](src/client/locales.ts). Keep new relationships backed by an authoritative identifier. If a new visual needs data absent from `ConversationSnapshot`, extend the owning session projection instead of scanning unrelated state or guessing from adjacency.

Run the focused checks from the repository root:

```sh
pnpm exec tsc -b packages/client/ui-agent-map
pnpm exec vitest run packages/client/ui-agent-map/tests
pnpm --filter @deepseek-ai/dsh-client-ui-agent-map bundle
```

Changes to a conversation view also need a real assembled Web snapshot, relevant GUI checks, bilingual documentation, and the repository gates required by the changed surface.

## Model Experience

None, as Agent Map renders existing Session data in the browser and nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No historical paging control** — the map reports an unloaded prefix, but users load that prefix from Chat or Trajectory.
- **No branch comparison or inferred dependencies** — the graph shows one Session and refuses to invent relationships without an explicit identifier.
- **Large windows use one SVG canvas** — browser cost grows with the loaded event window; virtualized graph tiles remain deferred until measured Sessions justify the added interaction complexity.
