import { describe, expect, it } from 'vitest'
import type { ConversationNode, RunningToolCall } from '@deepseek-ai/dsh-client-runtime/client'
import { deriveAgentMap, fitAgentMapScale } from '../src/client/graph.ts'

const settled: ConversationNode[] = [
  {
    kind: 'user', seq: 1, time: 1_000,
    content: [{ type: 'text', text: '  Fix the failing test.  ' }], source: null,
  },
  {
    kind: 'assistant', seq: 2, time: 2_000, turn: 1, step: 1,
    blocks: [
      { kind: 'text', text: 'I will run the test.' },
      { kind: 'tool-call', callId: 'call-1', name: 'shell_command', argsRaw: '{}' },
    ],
    usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 20, reasoningTokens: 3 },
  },
  {
    kind: 'tool-result', seq: 3, time: 3_000, callId: 'call-1',
    call: { name: 'shell_command', argsRaw: '{}' }, callTime: 2_200,
    content: [], isError: false, callView: null, resultView: null, subCalls: [],
  },
  {
    kind: 'turn-error', seq: 4, time: 4_000, turn: 1, step: 1,
    message: 'Tests still fail', code: 'test-failed',
  },
]

describe('deriveAgentMap', () => {
  it('positions ordered records in semantic lanes and proves Tool relations by call id', () => {
    const graph = deriveAgentMap({ nodes: settled, partial: null, runningCalls: [] })

    expect(graph.nodes.map(node => [node.id, node.lane, node.status])).toEqual([
      ['event:1', 'input', 'complete'],
      ['event:2', 'model', 'complete'],
      ['tool:call-1', 'tool', 'complete'],
      ['event:4', 'error', 'failed'],
    ])
    expect(graph.edges).toContainEqual({
      id: 'tool:event:2\u0000tool:call-1',
      from: 'event:2',
      to: 'tool:call-1',
      kind: 'tool',
    })
    expect(graph.nodes[0]?.summary).toBe('Fix the failing test.')
    expect(graph.turns).toBe(1)
    expect(graph.tools).toBe(1)
    expect(graph.errors).toBe(1)
    expect(graph.nodes[2]?.details.some(item => item.kind === 'subCalls')).toBe(false)
    expect(graph.tokenCalls).toEqual([{
      id: 'event:2', turn: 1, step: 1,
      usage: {
        inputTokens: 10, outputTokens: 5, cacheReadTokens: 20, reasoningTokens: 3, total: 35,
      },
    }])
  })

  it('adds in-flight records after finalized events without duplicating settled calls', () => {
    const running: RunningToolCall[] = [
      {
        callId: 'call-1', name: 'shell_command', argsRaw: '{}', turn: 1, step: 1,
        time: 2_200, callView: null, subCalls: [],
      },
      {
        callId: 'call-2', name: 'web_search', argsRaw: '{}', turn: 2, step: 1,
        time: 5_000, callView: null, subCalls: [],
      },
    ]
    const graph = deriveAgentMap({
      nodes: settled.slice(0, 3),
      partial: { turn: 2, step: 2, blocks: [{ kind: 'text', text: 'Working' }] },
      runningCalls: running,
    })

    expect(graph.nodes.filter(node => node.id === 'tool:call-1')).toHaveLength(1)
    expect(graph.nodes.at(-2)).toMatchObject({ id: 'tool:call-2', status: 'running' })
    expect(graph.nodes.at(-1)).toMatchObject({ id: 'partial:2:2', status: 'running' })
  })

  it('returns a stable empty canvas', () => {
    expect(deriveAgentMap({ nodes: [], partial: null, runningCalls: [] })).toMatchObject({
      nodes: [], edges: [], width: 720, turns: 0, tools: 0, errors: 0,
    })
  })

  it('keeps tool-call-only model calls visible for one-to-one Token dashboard mapping', () => {
    const graph = deriveAgentMap({
      nodes: [
        {
          kind: 'assistant', seq: 1, time: 1_000, turn: 1, step: 1,
          blocks: [{ kind: 'tool-call', callId: 'edit-1', name: 'edit', argsRaw: '{"path":"a.ts"}' }],
          usage: { inputTokens: 100, outputTokens: 20 },
        },
        {
          kind: 'tool-result', seq: 2, time: 1_500, callId: 'edit-1', callTime: 1_100,
          call: { name: 'edit', argsRaw: '{"path":"a.ts"}' },
          content: [{ type: 'text', text: 'updated' }], isError: false,
          callView: null, resultView: null,
          subCalls: [{
            kind: 'tool-result', seq: 3, time: 1_400, callId: 'child-1',
            call: { name: 'read', argsRaw: '{"path":"a.ts"}' }, callTime: 1_200,
            content: [{ type: 'text', text: 'source' }], isError: false,
            callView: null, resultView: null, subCalls: [],
          }],
        },
      ],
      partial: null,
      runningCalls: [],
    })

    expect(graph.nodes).toHaveLength(2)
    expect(graph.nodes[0]).toMatchObject({
      id: 'event:1', lane: 'model', summary: 'edit', turn: 1, step: 1,
    })
    expect(graph.nodes[1]).toMatchObject({ id: 'tool:edit-1', summary: 'edit', relation: 'tool' })
    expect(graph.nodes[1]?.details.map(item => item.kind)).toEqual([
      'callId', 'arguments', 'result', 'timing', 'subCalls',
    ])
    expect(graph.nodes[1]?.details.find(item => item.kind === 'subCalls')?.value).toBe('1')
    expect(graph.edges).toContainEqual({
      id: 'tool:event:1\u0000tool:edit-1', from: 'event:1', to: 'tool:edit-1', kind: 'tool',
    })
    expect(graph.tokenCalls[0]?.usage.total).toBe(120)
  })

  it('fits complete graph geometry into both viewport dimensions', () => {
    expect(fitAgentMapScale(
      { width: 2_000, height: 500 },
      { width: 1_000, height: 700 },
    )).toBeCloseTo(0.476)
    expect(fitAgentMapScale(
      { width: 500, height: 1_000 },
      { width: 900, height: 600 },
    )).toBeCloseTo(0.552)
    expect(fitAgentMapScale(
      { width: 500, height: 300 },
      { width: 900, height: 600 },
    )).toBe(1)
    expect(fitAgentMapScale(
      { width: 500, height: 300 },
      { width: 0, height: 0 },
    )).toBe(1)
    expect(fitAgentMapScale(
      { width: 10_000, height: 3_000 },
      { width: 600, height: 400 },
    )).toBe(0.3)
  })
})
