// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ComponentProps } from 'react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import {
  createSnapshotStore, EMPTY_CHAT_SNAPSHOT, EMPTY_CONVERSATION_VIEWS,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ConversationNode, ConversationSnapshot, SessionId, SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import { AgentMapView } from '../src/client/AgentMapView.tsx'
import { zh, type AgentMapKey } from '../src/client/locales.ts'

afterEach(cleanup)

const SID = 'agent-map-session' as SessionId
const nodes: ConversationNode[] = [
  {
    kind: 'assistant', seq: 1, time: 1_000, turn: 1, step: 1,
    blocks: [
      { kind: 'text', text: 'Running bash now.' },
      { kind: 'reasoning', text: 'Need the working directory.' },
      { kind: 'tool-call', callId: 'c1', name: 'bash', argsRaw: '{"command":"pwd"}' },
    ],
    usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 50, reasoningTokens: 12 },
  },
  {
    kind: 'tool-result', seq: 2, time: 2_000, callId: 'c1',
    call: { name: 'bash', argsRaw: '{"command":"pwd"}' }, callTime: 1_500,
    content: [{ type: 'text', text: '/workspace' }],
    isError: false, callView: null, resultView: null, subCalls: [],
  },
]

function snapshot(currentNodes: readonly ConversationNode[], hasMore = false): ConversationSnapshot {
  return {
    sessionId: SID,
    views: EMPTY_CONVERSATION_VIEWS,
    chat: EMPTY_CHAT_SNAPSHOT,
    nodes: currentNodes,
    turnTimings: new Map(),
    turnEnds: new Map(),
    partial: null,
    runningCalls: [],
    pending: [],
    queue: [],
    running: false,
    subagent: null,
    composerPhase: 'active',
    removed: false,
    openState: 'open',
    openError: null,
    hasMore,
    loadingOlder: false,
    promptError: null,
    blank: currentNodes.length === 0,
    lastAgentError: null,
  }
}

function props(currentNodes: readonly ConversationNode[], hasMore = false) {
  const store = createSnapshotStore(snapshot(currentNodes, hasMore))
  return storeProps(store)
}

function storeProps(store: SnapshotStore<ConversationSnapshot>) {
  return {
    sessionId: SID,
    useSession: bindSnapshotSelector(store),
    t: (key: string) => zh[key as AgentMapKey] ?? key,
  } as unknown as ComponentProps<typeof AgentMapView>
}

describe('AgentMapView', () => {
  it('renders statistics and opens call-backed relation details', () => {
    const view = render(<AgentMapView {...props(nodes, true)} />)

    expect(screen.getByRole('img', { name: 'Agent 执行关系图' })).toBeTruthy()
    expect(screen.getByText('显示当前已加载的会话范围')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Token usage: 170' })).toBeTruthy()
    expect(screen.getByText('170 tok')).toBeTruthy()
    const laneLabels = view.container.querySelectorAll('[data-agent-map-lane]')
    expect(laneLabels).toHaveLength(5)
    expect(Array.from(laneLabels, label => label.querySelector('b'))).toEqual([null, null, null, null, null])
    const dashboard = view.container.querySelector('[data-token-dashboard]')
    if (dashboard === null) throw new Error('missing Token dashboard')
    expect(dashboard.textContent).not.toContain('inputTokens')
    expect(screen.queryByRole('note', { name: 'Token usage' })).toBeNull()
    const modelSegment = dashboard.querySelector<HTMLElement>('[data-token-call-id="event:1"]')
    if (modelSegment === null) throw new Error('missing model Token segment')
    fireEvent.click(modelSegment)
    expect(modelSegment.hasAttribute('data-selected')).toBe(true)
    const modelDetails = screen.getByRole('complementary')
    expect(modelDetails.textContent).toContain('模型回复')
    expect(modelDetails.querySelector('[data-kind="reasoning"]')).toBeTruthy()
    expect(modelDetails.querySelector('[data-kind="toolCalls"]')).toBeTruthy()
    const tokenDetails = screen.getByRole('note', { name: 'Token usage' })
    expect(tokenDetails.querySelectorAll('[data-token-metric]')).toHaveLength(4)
    expect(tokenDetails.textContent).toContain('inputTokens100')
    expect(tokenDetails.textContent).toContain('outputTokens20')
    expect(tokenDetails.textContent).toContain('cacheReadTokens50')
    expect(tokenDetails.textContent).toContain('reasoningTokens12')
    expect(tokenDetails.textContent).not.toContain('{')
    expect(tokenDetails.textContent).not.toContain('用量')
    fireEvent.click(screen.getByRole('button', { name: 'bash, 完成' }))
    expect(dashboard.querySelector('[data-token-call-id][data-selected]')).toBeNull()
    expect(screen.queryByRole('note', { name: 'Token usage' })).toBeNull()
    const details = screen.getByRole('complementary', { name: '执行节点详情' })
    expect(details.textContent).toContain('工具调用')
    expect(details.textContent).toContain('bash')
    expect(details.textContent).toContain('{"command":"pwd"}')
    expect(details.querySelector('[data-kind="arguments"]')).toBeTruthy()
    expect(details.querySelector('[data-kind="result"]')).toBeTruthy()
    expect(within(details).getAllByText('bash')).toHaveLength(1)
    const root = view.container.querySelector('[data-conversation-composer-overlay]')
    if (root === null) throw new Error('missing Agent Map root')
    fireEvent.pointerDown(root)
    expect(screen.queryByRole('complementary')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '模型回复, 完成' }))
    expect(modelSegment.hasAttribute('data-selected')).toBe(true)
  })

  it('opens nodes from the keyboard and shows the empty state', () => {
    const view = render(<AgentMapView {...props(nodes)} />)
    fireEvent.keyDown(screen.getByRole('button', { name: '模型回复, 完成' }), { key: 'Enter' })
    const details = screen.getByRole('complementary')
    expect(within(details).getAllByText('模型回复')).toHaveLength(1)

    view.rerender(<AgentMapView {...props([])} />)
    expect(screen.getByText('当前加载范围内还没有可绘制的执行记录。')).toBeTruthy()
  })

  it('shows user, context, and model titles only once inside their detail cards', () => {
    const messageNodes: ConversationNode[] = [
      { kind: 'user', seq: 1, time: 1_000, content: [{ type: 'text', text: 'Hello' }], source: null },
      {
        kind: 'context', seq: 2, time: 2_000, content: [{ type: 'text', text: 'Instructions' }],
        source: { kind: 'plugin', plugin: 'fixture' },
        provenance: { role: 'inject', label: 'fixture' }, form: 'instructions',
      },
      {
        kind: 'assistant', seq: 3, time: 3_000, turn: 1, step: 1,
        blocks: [{ kind: 'text', text: 'Hello back' }],
      },
    ]
    render(<AgentMapView {...props(messageNodes)} />)

    for (const title of ['用户消息', '上下文', '模型回复']) {
      fireEvent.click(screen.getByRole('button', { name: `${title}, 完成` }))
      expect(within(screen.getByRole('complementary')).getAllByText(title)).toHaveLength(1)
    }
  })

  it('refits as live nodes arrive while preserving zoom controls and selected details', () => {
    const store = createSnapshotStore(snapshot(nodes))
    const view = render(<AgentMapView {...storeProps(store)} />)
    const viewport = view.container.querySelector<HTMLElement>('[data-agent-map-viewport]')
    if (viewport === null) throw new Error('missing Agent Map viewport')
    const horizontalScroll = view.container.querySelector<HTMLElement>('[data-agent-map-horizontal-scroll]')
    if (horizontalScroll === null) throw new Error('missing Agent Map horizontal scrollbar')
    viewport.getBoundingClientRect = () => ({
      width: 600, height: 500, top: 0, right: 600, bottom: 500, left: 0, x: 0, y: 0,
      toJSON: () => ({}),
    })
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 600 },
      clientHeight: { configurable: true, value: 500 },
      setPointerCapture: { configurable: true, value: () => {} },
      releasePointerCapture: { configurable: true, value: () => {} },
    })
    fireEvent(window, new Event('resize'))

    const level = screen.getByRole('status', { name: '当前缩放比例' })
    const initialPercent = Number(level.textContent?.replace('%', ''))
    const graph = screen.getByRole('img', { name: 'Agent 执行关系图' })
    const fixedInputLabel = screen.getByText('输入')
    expect(graph.contains(fixedInputLabel)).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '模型回复, 完成' }))
    expect(screen.getByRole('complementary').textContent).toContain('模型回复')

    const zoomIn = screen.getByRole('button', { name: '放大画布' })
    fireEvent.click(zoomIn)
    fireEvent.click(zoomIn)
    fireEvent.click(zoomIn)
    const manualPercent = Number(level.textContent?.replace('%', ''))
    expect(manualPercent).toBeGreaterThan(initialPercent)

    const extraNodes: ConversationNode[] = Array.from({ length: 8 }, (_, index) => ({
      kind: 'user', seq: index + 3, time: 3_000 + index,
      content: [{ type: 'text', text: `Live node ${index + 1}` }], source: null,
    }))
    act(() => { store.set(snapshot([...nodes, ...extraNodes])) })

    expect(Number(level.textContent?.replace('%', ''))).toBe(manualPercent)
    expect(screen.getByRole('complementary').textContent).toContain('模型回复')
    const beforeDrag = viewport.scrollLeft
    fireEvent.pointerDown(viewport, { button: 0, pointerId: 7, clientX: 400, clientY: 200 })
    fireEvent.pointerMove(viewport, { pointerId: 7, clientX: 180, clientY: 200 })
    fireEvent.pointerUp(viewport, { pointerId: 7, clientX: 180, clientY: 200 })
    expect(viewport.scrollLeft).toBeCloseTo(beforeDrag + 220)
    fireEvent.scroll(viewport)
    expect(horizontalScroll.scrollLeft).toBeCloseTo(viewport.scrollLeft)
    horizontalScroll.scrollLeft = 64
    fireEvent.scroll(horizontalScroll)
    expect(viewport.scrollLeft).toBe(64)
    expect(screen.getByText('输入')).toBe(fixedInputLabel)
    const firstLiveNode = screen.getAllByRole('button', { name: '用户消息, 完成' })[0]
    if (firstLiveNode === undefined) throw new Error('missing live Agent Map node')
    fireEvent.click(firstLiveNode)
    expect(screen.getByRole('complementary').textContent).toContain('Live node 1')
    fireEvent.click(screen.getByRole('button', { name: '适应' }))
    expect(Number(level.textContent?.replace('%', ''))).toBeLessThan(initialPercent)
    expect(viewport.scrollLeft).toBe(0)
  })
})
