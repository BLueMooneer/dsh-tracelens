# Inspect a Session with Agent Map

English | [中文](agent-map.zh.md)

Agent Map is included in the repository's Web profile. It gives the existing conversation data a compact visual projection; it does not run another agent or change the Session.

## Start the Web UI

From a repository checkout, build and start the Web profile:

```sh
pnpm install
pnpm run build
pnpm dsh web
```

Open the printed URL, choose a workspace, and open or create a Session. Select **Agent Map** in the conversation view switcher.

## Read the graph

The five lanes separate input, model output, tool activity, system records, and failures. Each card is one finalized or in-flight record from the browser's currently loaded conversation window.

- Gray lines connect adjacent records in event-log order; they do not claim that one record caused the next.
- Blue lines connect an Assistant tool request to its result only when both records share the same explicit `callId`.
- Hover or keyboard-focus either relationship line to read its type and causality guarantee.
- A running status can represent the frozen partial Assistant response or a Tool call that has not settled.
- A failed status covers Tool errors, interrupted Assistant output, model retries that were cancelled, turn errors, and maximum-token termination.

The counters describe only visible records. If the header reports a loaded-window limit, load earlier history from Chat or Trajectory before treating the counts as Session totals.

## Inspect a node

Select a node with the pointer, or focus it and press Enter or Space. A detail card opens directly below that node instead of taking space from the right side of the canvas. Every card shows status, time, event sequence when available, Turn/Step coordinates, and incoming relation. It then adds the fields recorded for that type: message content and source; model provider, request configuration, timing, reasoning, and Tool calls; Tool arguments, result, duration, error, metadata, and direct child calls; or the corresponding command, compaction, retry, and failure data. Tool arguments, Tool results, model reasoning, and model Tool calls appear as near-black text on light content panels for readable long-form inspection. **Direct child calls** counts only nested calls emitted by a Code Mode dispatch, not later ordinary Tool calls; the field is absent when the count is zero. The heading appears once. Click anywhere outside the selected node and its attached cards to close them. Pure Tool-call Assistant records such as `edit` or `write` remain visible as Model-lane nodes and connect to their Tool nodes by `callId`.

## Compare Token usage

The left side contains only a compact two-by-two counter grid, while the zoom controls use a narrow group on the right. The taller Token dashboard expands through all space between them with larger labels and a thicker bar. Its expanded call list has the same width as the dashboard and contains only each call's total and percentage. Select a model response to highlight its matching segment and dim the rest, or select a dashboard segment to select that exact canvas node. A matching glass Token card opens above the node with a two-by-two grid for `inputTokens`, `outputTokens`, `cacheReadTokens`, and `reasoningTokens`; it is absent until the node is selected. `cacheWriteTokens` remains part of the total but does not add a fifth cell. `reasoningTokens` is already part of `outputTokens`, so it is displayed without being added to the total again. Tool-call-only model records remain visible, giving every dashboard segment one Model-lane counterpart. If earlier history is unloaded, both the total and percentages cover only the loaded window.

## Fit and zoom the canvas

Agent Map starts in **Fit** mode at 100% when the graph fits. New nodes and viewport changes automatically recalculate the scale down to a minimum of 30%. Once the graph needs more space at that floor, it stays at 30% and becomes pannable instead of shrinking further. **Zoom in** or **Zoom out** enters manual mode, where the chosen scale remains stable as more nodes arrive. Hold and drag empty canvas space to move the workflow horizontally or vertically, or drag the scrollbar above the composer for exact horizontal positioning; the two controls remain synchronized. The compact lane labels remain fixed on the left. Select **Fit** to resume automatic fitting and reset the pan position. Nodes remain clickable, and the detail card stays attached to its selected node across every zoom or pan change.

## Enable it in another composition

The repository Web profile enables Agent Map by default. A custom browser composition must add `@deepseek-ai/dsh-client-ui-agent-map` to its client plugin roster after making locale, runtime, and conversation UI available. Do not register a second session projection for it: the plugin consumes the existing session-scoped `conversation.view` snapshot.

After changing a source checkout, rebuild the package and restart the Web process if no bundle watcher is running:

```sh
pnpm --filter @deepseek-ai/dsh-client-ui-agent-map bundle
pnpm dsh web
```

## Troubleshoot

- **The Agent Map tab is absent:** confirm the active composition contains the package and that its client bundle was built. Browser startup errors will name a missing injected client provider.
- **The graph is empty:** open a non-empty Session or send a message; an empty loaded conversation correctly produces an empty state.
- **Counts look too small:** check for the loaded-window notice and load the earlier prefix from Chat or Trajectory.
- **Nodes are too small after a long task:** use **Zoom in**, then drag empty canvas space to inspect the enlarged graph; select **Fit** to see the complete loaded graph again.
- **A gray edge looks unrelated:** that edge expresses ordering only. Treat only blue `callId`-backed edges as Tool request/result relations.
- **A recent source edit is not visible:** run the package bundle command above, then reload the page or restart the Web process.

Implementation and extension rules live in the [package README](../../../packages/client/ui-agent-map/README.md).
