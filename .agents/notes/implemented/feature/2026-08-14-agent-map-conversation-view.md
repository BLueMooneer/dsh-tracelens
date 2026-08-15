# Agent Note: Agent Map conversation view

Status: implemented

English | [中文](2026-08-14-agent-map-conversation-view.zh.md)

## Problem

Trajectory preserves a detailed chronological ledger, but users must still read individual rows to understand how human input, model output, Tool activity, system work, and failures relate across a Session. Replacing Trajectory with another timeline would duplicate its owner while leaving this relationship question unanswered. A visual view also risks overstating causality when the log proves only order.

## Decision

`@deepseek-ai/dsh-client-ui-agent-map` contributes a session-scoped `agent-map` entry to the existing `conversation.view` ring. The component derives one SVG graph from the public conversation snapshot already assembled by UI Conversation. It registers no host service, durable event, Conversation Node Definition, or independent view target.

The graph uses five stable semantic lanes: Input, Model, Tool, System, and Error. Final conversation nodes, the frozen partial Assistant, and running Tool calls become nodes in the loaded-window order. A gray edge means only adjacent log order. A blue edge requires an Assistant Tool block and Tool node with the same `callId`; the UI never labels temporal adjacency as causation.

The graph model, geometry, and fit-scale calculation are pure functions outside React. Fit starts at the authored 100% scale and has a 30% readability floor; overflow beyond that floor is handled by panning. The component owns selection, manual scale, and viewport pan state, reads live arrays through the framework-provided Session hook, and receives localized copy through the slot locale seat. A viewport observer recomputes scale in Fit mode; manual mode keeps its scale as graph geometry changes. A dedicated bottom scrollbar and pointer panning update the same viewport position in both directions, and both canvas axes use the host scrollbar skin. Compact lane labels render in a fixed sibling rail while the SVG pans independently. The selected node owns one detail card below it with common coordinates and recorded type-specific values; pointer input outside the node and attached cards clears the selection. Long Tool arguments, Tool results, model reasoning, and model Tool calls use near-black text on light content panels in both themes. Tool results expose a direct-child count only for nonempty nested Code Mode dispatch projections, avoiding a misleading zero on ordinary calls. Assistant records made only of Tool-call blocks retain Model-lane nodes, and their `callId` classifies the matching Tool node's relation. Validated Assistant usage supplies a taller loaded-window 100% stacked dashboard that expands between a two-row counter grid and compact zoom controls. Its same-width expanded list exposes only totals and percentages. Every dashboard segment uses the corresponding Model node id: node selection highlights that segment, while activating the segment selects the node. A glass two-by-two quick card above the selected Model node shows input, output, cache-read, and reasoning values. Cache writes remain in totals without adding a fifth quick-card cell, and reasoning remains excluded from addition because output already contains it. Calls without usage samples are not estimated. Theme semantic colors drive the grid, translucent surfaces, node accents, status and focus treatment, and Tool-edge glow in both appearance modes; written statuses preserve meaning without color. CSS-only aurora, scan, edge-flow, running, selection, and detail-entry effects avoid graph-state updates, and the reduced-motion query disables all of them. Neither zoom nor pan replaces graph nodes or selection. The slot declaration injection owns registration and disposal, while CSS Modules own responsive presentation and reduced-motion behavior.

## Alternatives considered

**Extend Trajectory with a graph mode.** Trajectory owns detailed event inspection, timing, paging, and search. Adding a relationship canvas would couple two different reading tasks and make independent installation or removal impossible.

**Register another complete Conversation event projection.** A target-specific projection is appropriate when a view needs facts Chat does not retain. Agent Map uses the public finalized and in-flight conversation records already required by its owning view ring, so another set of event state machines would duplicate lifecycle rules and could drift from the visible conversation.

**Infer causal edges from sequence, timing, or text.** Those signals do not prove that one operation caused another. The implemented graph reserves the stronger Tool relation for recorded `callId` identity and labels every other connection as flow.

**Adopt a graph component dependency.** The view needs fixed lanes, curved edges, fit scaling, zoom, and selection rather than arbitrary node dragging or automatic layout. A small SVG projection keeps the browser bundle and runtime dependency set narrow; a maintained graph library remains appropriate if measured requirements add large-graph virtualization, editable topology, or freeform panning.

## Consequences

The Web bundle gains a third conversation view that can explain a loaded Session without changing the model-visible transcript or provider request. Users can distinguish recorded Tool relationships from simple execution order, keep the full loaded graph visible as nodes arrive, change scale, and inspect a node without leaving the graph. The package depends on UI Conversation being present: its slot injection remains dormant when the owner is absent and follows that declaration across reloads.

The view is deliberately not a complete Session graph while older pages remain unloaded, does not compare forks, and mounts the loaded records in one SVG canvas. These limits appear in the package README and avoid hidden paging, speculative causality, and premature graph infrastructure.
