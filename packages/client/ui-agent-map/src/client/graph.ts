/** Pure projection from the public conversation snapshot into graph geometry. */

import type {
  AssistantBlock, ConversationNode, PartialAssistant, RunningToolCall,
} from '@deepseek-ai/dsh-client-runtime/client'

/** Semantic lane used by the execution graph. */
export type AgentMapLane = 'input' | 'model' | 'tool' | 'system' | 'error'
/** Stable node status derived from recorded or in-flight session state. */
export type AgentMapStatus = 'complete' | 'running' | 'failed'
/** Source role retained for localized presentation. */
export type AgentMapRole =
  | 'user' | 'steering' | 'context' | 'assistant' | 'tool' | 'command'
  | 'compaction' | 'retry' | 'error' | 'maxTokens' | 'unknown'

/** Localized label key for one node-detail value. */
export type AgentMapDetailKind =
  | 'time' | 'content' | 'source' | 'form' | 'messageId' | 'providerModel' | 'request'
  | 'timing' | 'reasoning' | 'toolCalls' | 'callId' | 'arguments'
  | 'result' | 'error' | 'metadata' | 'subCalls' | 'commandId' | 'outcome'
  | 'summaryEvent' | 'shadowedItems' | 'shadowedTokens' | 'retry'
  | 'retryState' | 'eventType' | 'payload'

/** One non-empty value shown in the selected-node detail panel. */
export interface AgentMapDetail {
  readonly kind: AgentMapDetailKind
  readonly value: string
  readonly long?: true
}

/** Validated provider usage attached to one finalized Assistant call. */
export interface AgentMapTokenUsage {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens?: number
  readonly cacheWriteTokens?: number
  readonly reasoningTokens?: number
  readonly total: number
}

/** One finalized model request represented in the conversation-wide Token dashboard. */
export interface AgentMapTokenCall {
  readonly id: string
  readonly turn: number
  readonly step: number
  readonly usage: AgentMapTokenUsage
}

/** One positioned execution node. */
export interface AgentMapNode {
  readonly id: string
  readonly seq: number | null
  readonly time: number
  readonly lane: AgentMapLane
  readonly role: AgentMapRole
  readonly status: AgentMapStatus
  readonly summary: string
  readonly details: readonly AgentMapDetail[]
  readonly relation: 'flow' | 'tool'
  readonly tokens?: AgentMapTokenUsage
  readonly turn?: number
  readonly step?: number
  readonly x: number
  readonly y: number
}

/** A proven tool-call relation or an ordering edge between adjacent records. */
export interface AgentMapEdge {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly kind: 'flow' | 'tool'
}

/** Complete graph model for the loaded conversation window. */
export interface AgentMapGraph {
  readonly nodes: readonly AgentMapNode[]
  readonly edges: readonly AgentMapEdge[]
  readonly width: number
  readonly height: number
  readonly turns: number
  readonly tools: number
  readonly errors: number
  readonly tokenCalls: readonly AgentMapTokenCall[]
}

/** Fixed SVG node width shared by the pure layout and renderer. */
export const NODE_WIDTH = 168
/** Fixed SVG node height shared by the pure layout and renderer. */
export const NODE_HEIGHT = 72
/** Maximum scale used when fitting a graph so small graphs retain their authored size. */
export const MAX_FIT_SCALE = 1
/** Smallest automatic or manual scale; wider graphs remain pannable below this fit point. */
export const MIN_FIT_SCALE = 0.3
const COLUMN_GAP = 36
const GRAPH_LEFT = 24
/** Unscaled top offset shared by graph nodes and the fixed lane-label rail. */
export const GRAPH_TOP = 52
/** Unscaled vertical distance shared by graph nodes and the fixed lane-label rail. */
export const LANE_GAP = 104
const GRAPH_RIGHT = 48
const GRAPH_BOTTOM = 36

/**
 * Fit the complete graph inside the measured viewport without enlarging its authored geometry.
 * @param graph - Unscaled graph dimensions.
 * @param viewport - Available browser viewport dimensions.
 * @param margin - Empty space retained around the scaled graph.
 * @returns Positive scale that keeps the complete graph visible, or one before layout is measured.
 */
export function fitAgentMapScale(
  graph: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
  margin = 24,
): number {
  if (viewport.width <= 0 || viewport.height <= 0) return MAX_FIT_SCALE
  const availableWidth = Math.max(1, viewport.width - margin * 2)
  const availableHeight = Math.max(1, viewport.height - margin * 2)
  return Math.max(
    MIN_FIT_SCALE,
    Math.min(MAX_FIT_SCALE, availableWidth / graph.width, availableHeight / graph.height),
  )
}

const laneIndex: Record<AgentMapLane, number> = {
  input: 0,
  model: 1,
  tool: 2,
  system: 3,
  error: 4,
}

interface UnpositionedNode extends Omit<AgentMapNode, 'x' | 'y'> {
  readonly callIds?: readonly string[]
  readonly callId?: string
}

function compact(text: string, limit = 90): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`
}

function contentSummary(content: readonly unknown[]): string {
  for (const block of content) {
    if (typeof block !== 'object' || block === null || !('type' in block)) continue
    if (block.type === 'text' && 'text' in block && typeof block.text === 'string') {
      const summary = compact(block.text)
      if (summary !== '') return summary
    }
  }
  return ''
}

function describe(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null) return 'null'
  if (value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '[unserializable value]'
  }
}

function detail(kind: AgentMapDetailKind, value: unknown, long = false): AgentMapDetail[] {
  const text = describe(value).trim()
  return text === '' ? [] : [{ kind, value: text, ...(long ? { long: true as const } : {}) }]
}

function contentDetails(content: readonly unknown[]): AgentMapDetail[] {
  if (content.length === 0) return []
  const text = content.flatMap((block) => {
    if (typeof block !== 'object' || block === null || !('type' in block)) return []
    if ((block.type === 'text' || block.type === 'reasoning') && 'text' in block && typeof block.text === 'string') {
      return [block.text]
    }
    return []
  }).join('\n\n')
  return detail('content', text === '' ? content : text, true)
}

function assistantSummary(blocks: readonly AssistantBlock[]): string {
  for (const block of blocks) {
    if ((block.kind === 'text' || block.kind === 'reasoning') && block.text.trim() !== '') {
      return compact(block.text)
    }
  }
  return blocks.flatMap(block => block.kind === 'tool-call' ? [block.name] : []).join(', ')
}

function assistantCallIds(blocks: readonly AssistantBlock[]): string[] {
  return blocks.flatMap(block => block.kind === 'tool-call' ? [block.callId] : [])
}

function usageValue(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function assistantTokenUsage(usage: unknown): AgentMapTokenUsage | undefined {
  if (typeof usage !== 'object' || usage === null || Array.isArray(usage)) return undefined
  const record = usage as Record<string, unknown>
  if (!['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens']
    .some(key => typeof record[key] === 'number')) return undefined
  const inputTokens = usageValue(record, 'inputTokens') ?? 0
  const outputTokens = usageValue(record, 'outputTokens') ?? 0
  const cacheReadTokens = usageValue(record, 'cacheReadTokens')
  const cacheWriteTokens = usageValue(record, 'cacheWriteTokens')
  const reasoningTokens = usageValue(record, 'reasoningTokens')
  return {
    inputTokens,
    outputTokens,
    ...(cacheReadTokens === undefined ? {} : { cacheReadTokens }),
    ...(cacheWriteTokens === undefined ? {} : { cacheWriteTokens }),
    ...(reasoningTokens === undefined ? {} : { reasoningTokens }),
    total: inputTokens + outputTokens + (cacheReadTokens ?? 0) + (cacheWriteTokens ?? 0),
  }
}

function assistantDetails(node: Extract<ConversationNode, { kind: 'assistant' }>): AgentMapDetail[] {
  const reasoning = node.blocks.flatMap(block => block.kind === 'reasoning' ? [block.text] : []).join('\n\n')
  const calls = node.blocks.flatMap(block => block.kind === 'tool-call'
    ? [`${block.name} (${block.callId})\n${block.argsRaw}`]
    : [])
  const timing = node.timing === undefined ? '' : [
    node.timing.stepStartTime === null ? null : `total ${node.timing.completedTime - node.timing.stepStartTime} ms`,
    node.timing.stepStartTime === null || node.timing.firstTokenTime === null
      ? null
      : `TTFT ${node.timing.firstTokenTime - node.timing.stepStartTime} ms`,
  ].filter(value => value !== null).join(' · ')
  return [
    ...detail('messageId', node.messageId),
    ...detail('providerModel', node.provenance === undefined ? '' : `${node.provenance.provider} / ${node.provenance.model}`),
    ...detail('request', node.requestConfig, true),
    ...detail('timing', timing),
    ...detail('reasoning', reasoning, true),
    ...detail('toolCalls', calls.join('\n\n'), true),
  ]
}

function assertNever(value: never): never {
  throw new Error(`unsupported conversation node: ${JSON.stringify(value)}`)
}

function settledNode(node: ConversationNode): UnpositionedNode {
  switch (node.kind) {
    case 'user':
      return { id: `event:${node.seq}`, seq: node.seq, time: node.time, lane: 'input', role: 'user', status: 'complete', summary: contentSummary(node.content), details: [...detail('source', node.source, true), ...contentDetails(node.content)], relation: 'flow' }
    case 'steering':
      return { id: `event:${node.seq}`, seq: node.seq, time: node.time, lane: 'input', role: 'steering', status: 'complete', summary: contentSummary(node.content), details: [...detail('messageId', node.messageId), ...detail('source', node.source, true), ...contentDetails(node.content)], relation: 'flow' }
    case 'context':
      return { id: `event:${node.seq}`, seq: node.seq, time: node.time, lane: 'system', role: 'context', status: 'complete', summary: contentSummary(node.content), details: [...detail('source', node.provenance.label ?? node.source, true), ...detail('form', node.form ?? node.provenance.role), ...contentDetails(node.content)], relation: 'flow' }
    case 'assistant': {
      const tokens = assistantTokenUsage(node.usage)
      return {
        id: `event:${node.seq}`, seq: node.seq, time: node.time, lane: 'model', role: 'assistant',
        status: node.interrupted === true ? 'failed' : 'complete', summary: assistantSummary(node.blocks),
        turn: node.turn, step: node.step, callIds: assistantCallIds(node.blocks),
        details: assistantDetails(node), relation: 'flow',
        ...(tokens === undefined ? {} : { tokens }),
      }
    }
    case 'tool-result':
      return {
        id: `tool:${node.callId}`, seq: node.seq, time: node.time, lane: 'tool', role: 'tool',
        status: node.isError ? 'failed' : 'complete', summary: node.call?.name ?? node.callId,
        callId: node.callId, relation: 'flow',
        details: [
          ...detail('callId', node.callId), ...detail('arguments', node.call?.argsRaw, true),
          ...contentDetails(node.content).map(item => ({ ...item, kind: 'result' as const })),
          ...detail('timing', node.callTime === null ? '' : `${Math.max(0, node.time - node.callTime)} ms`),
          ...detail('error', node.error, true), ...detail('metadata', node.meta, true),
          ...(node.subCalls.length === 0 ? [] : detail('subCalls', node.subCalls.length)),
        ],
      }
    case 'command':
      return {
        id: `command:${node.commandId}`, seq: node.seq, time: node.time, lane: 'system', role: 'command',
        status: node.outcome?.kind === 'error' ? 'failed' : node.outcome === null ? 'running' : 'complete',
        summary: node.name ?? node.commandId, relation: 'flow', details: [
          ...detail('commandId', node.commandId), ...detail('arguments', node.args, true),
          ...detail('outcome', node.outcome, true),
        ],
      }
    case 'compaction':
      return { id: `event:${node.seq}`, seq: node.seq, time: node.time, lane: 'system', role: 'compaction', status: 'complete', summary: node.summary === null ? '' : compact(node.summary), details: [...detail('result', node.summary, true), ...detail('summaryEvent', node.summaryEventSeq), ...detail('shadowedItems', node.shadowedItemCount), ...detail('shadowedTokens', node.shadowedTokenCount)], relation: 'flow' }
    case 'model-retry':
      return { id: `event:${node.seq}`, seq: node.seq, time: node.time, lane: 'error', role: 'retry', status: node.retryState === 'cancelled' ? 'failed' : 'running', summary: compact(node.failure.message), turn: node.turn, step: node.step, details: [...detail('providerModel', node.provider), ...detail('retry', `${node.retry}${'maxRetries' in node ? ` / ${node.maxRetries}` : ''} · ${node.delayMs} ms`), ...detail('retryState', node.retryState), ...detail('error', node.failure, true)], relation: 'flow' }
    case 'turn-error':
      return { id: `event:${node.seq}`, seq: node.seq, time: node.time, lane: 'error', role: 'error', status: 'failed', summary: compact(node.message), turn: node.turn, step: node.step, details: [...detail('error', node.code === undefined ? node.message : `${node.code}: ${node.message}`, true)], relation: 'flow' }
    case 'turn-max-tokens':
      return { id: `event:${node.seq}`, seq: node.seq, time: node.time, lane: 'error', role: 'maxTokens', status: 'failed', summary: '', turn: node.turn, step: node.step, details: [], relation: 'flow' }
    case 'unknown':
      return { id: `event:${node.seq}`, seq: node.seq, time: node.time, lane: 'system', role: 'unknown', status: 'complete', summary: node.type, details: [...detail('eventType', node.type), ...detail('payload', node.data, true)], relation: 'flow' }
    default:
      return assertNever(node)
  }
}

function runningToolNodes(root: RunningToolCall, output: UnpositionedNode[]): void {
  output.push({
    id: `tool:${root.callId}`, seq: null, time: root.time, lane: 'tool', role: 'tool',
    status: 'running', summary: root.name, turn: root.turn, step: root.step, callId: root.callId,
    details: [
      ...detail('callId', root.callId), ...detail('arguments', root.argsRaw, true),
      ...(root.subCalls.length === 0 ? [] : detail('subCalls', root.subCalls.length)),
    ], relation: 'flow',
  })
  for (const child of root.subCalls) {
    if ('kind' in child) output.push(settledNode(child))
    else runningToolNodes(child, output)
  }
}

function collectRunningTools(calls: readonly RunningToolCall[]): UnpositionedNode[] {
  const output: UnpositionedNode[] = []
  for (const call of calls) runningToolNodes(call, output)
  return output
}

function partialNode(partial: PartialAssistant): UnpositionedNode {
  return {
    id: `partial:${partial.turn}:${partial.step}`, seq: null, time: Number.MAX_SAFE_INTEGER,
    lane: 'model', role: 'assistant', status: 'running', summary: assistantSummary(partial.blocks),
    turn: partial.turn, step: partial.step, callIds: assistantCallIds(partial.blocks),
    details: [...detail('reasoning', partial.blocks.flatMap(block => block.kind === 'reasoning' ? [block.text] : []).join('\n\n'), true), ...detail('toolCalls', partial.blocks.flatMap(block => block.kind === 'tool-call' ? [`${block.name} (${block.callId})\n${block.argsRaw}`] : []).join('\n\n'), true)], relation: 'flow',
  }
}

function edgeKey(from: string, to: string): string {
  return `${from}\u0000${to}`
}

/**
 * Derive deterministic graph nodes and edges from the loaded public conversation projection.
 * @param input - Finalized nodes plus optional in-flight Assistant and Tool state.
 * @returns Positioned graph with ordering edges and call-id-backed Tool edges.
 */
export function deriveAgentMap(input: {
  readonly nodes: readonly ConversationNode[]
  readonly partial: PartialAssistant | null
  readonly runningCalls: readonly RunningToolCall[]
}): AgentMapGraph {
  const settled = input.nodes.map(settledNode)
  const seen = new Set(settled.map(node => node.id))
  const running = collectRunningTools(input.runningCalls).filter(node => !seen.has(node.id))
  const allSource = [
    ...settled,
    ...running,
    ...(input.partial === null ? [] : [partialNode(input.partial)]),
  ].sort((left, right) => {
    if (left.seq !== null && right.seq !== null) return left.seq - right.seq
    if (left.seq !== null) return -1
    if (right.seq !== null) return 1
    return left.time - right.time || left.id.localeCompare(right.id)
  })
  const assistantByCall = new Map<string, string>()
  for (const node of allSource) {
    for (const callId of node.callIds ?? []) assistantByCall.set(callId, node.id)
  }
  const nodes = allSource.map<AgentMapNode>((node, index) => ({
    ...node,
    relation: node.callId !== undefined && assistantByCall.has(node.callId) ? 'tool' : node.relation,
    x: GRAPH_LEFT + index * (NODE_WIDTH + COLUMN_GAP),
    y: GRAPH_TOP + laneIndex[node.lane] * LANE_GAP,
  }))
  const edges: AgentMapEdge[] = []
  const edgeIds = new Set<string>()
  for (let index = 1; index < nodes.length; index++) {
    const from = nodes[index - 1]
    const to = nodes[index]
    if (from === undefined || to === undefined) continue
    const key = edgeKey(from.id, to.id)
    edgeIds.add(key)
    edges.push({ id: `flow:${key}`, from: from.id, to: to.id, kind: 'flow' })
  }
  for (const node of allSource) {
    if (node.callId === undefined) continue
    const from = assistantByCall.get(node.callId)
    if (from === undefined || from === node.id || !nodes.some(candidate => candidate.id === from)) continue
    const key = edgeKey(from, node.id)
    if (edgeIds.has(key)) {
      const index = edges.findIndex(edge => edge.from === from && edge.to === node.id)
      const previous = edges[index]
      if (previous !== undefined) edges[index] = { ...previous, kind: 'tool', id: `tool:${key}` }
      continue
    }
    edgeIds.add(key)
    edges.push({ id: `tool:${key}`, from, to: node.id, kind: 'tool' })
  }
  const turns = new Set(nodes.flatMap(node => node.turn === undefined ? [] : [node.turn])).size
  return {
    nodes,
    edges,
    width: Math.max(720, GRAPH_LEFT + nodes.length * (NODE_WIDTH + COLUMN_GAP) + GRAPH_RIGHT),
    height: GRAPH_TOP + 5 * LANE_GAP - (LANE_GAP - NODE_HEIGHT) + GRAPH_BOTTOM,
    turns,
    tools: nodes.filter(node => node.lane === 'tool').length,
    errors: nodes.filter(node => node.status === 'failed').length,
    tokenCalls: allSource.flatMap(node => node.role === 'assistant'
      && node.turn !== undefined && node.step !== undefined && node.tokens !== undefined
      ? [{ id: node.id, turn: node.turn, step: node.step, usage: node.tokens }]
      : []),
  }
}
