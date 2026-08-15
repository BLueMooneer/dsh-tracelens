/** Interactive SVG projection of the loaded conversation execution flow. */

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import {
  deriveAgentMap, fitAgentMapScale, GRAPH_TOP, LANE_GAP, MIN_FIT_SCALE, NODE_HEIGHT, NODE_WIDTH,
  type AgentMapEdge, type AgentMapLane,
  type AgentMapDetailKind, type AgentMapNode, type AgentMapTokenCall, type AgentMapTokenUsage,
} from './graph.ts'
import type { AgentMapKey } from './locales.ts'
import css from './AgentMapView.module.css'

const laneOrder: readonly AgentMapLane[] = ['input', 'model', 'tool', 'system', 'error']
const MIN_SCALE = MIN_FIT_SCALE
const MAX_SCALE = 3
const ZOOM_STEP = 0.2
const DETAIL_WIDTH = 420
const DETAIL_HEIGHT = 300
const DETAIL_GAP = 10
const TOKEN_DETAIL_WIDTH = 320
const TOKEN_DETAIL_HEIGHT = 124
const TOKEN_DETAIL_GAP = 8

interface ViewportSize {
  readonly width: number
  readonly height: number
}

function useViewportSize(): {
  readonly ref: RefObject<HTMLDivElement>
  readonly size: ViewportSize
} {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<ViewportSize>({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return
    const measure = () => {
      const rect = element.getBoundingClientRect()
      const next = { width: rect.width, height: rect.height }
      setSize(previous => previous.width === next.width && previous.height === next.height
        ? previous
        : next)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(element)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  return { ref, size }
}

function nextScale(current: number, delta: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, current + delta))
}

interface DragState {
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
  readonly scrollLeft: number
  readonly scrollTop: number
}

function roleKey(role: AgentMapNode['role']): AgentMapKey {
  return `node.${role}`
}

function statusKey(status: AgentMapNode['status']): AgentMapKey {
  return `status.${status}`
}

function laneKey(lane: AgentMapLane): AgentMapKey {
  return `lane.${lane}`
}

function detailKey(kind: AgentMapDetailKind): AgentMapKey {
  return `detail.${kind}`
}

function edgePath(from: AgentMapNode, to: AgentMapNode): string {
  const startX = from.x + NODE_WIDTH
  const startY = from.y + NODE_HEIGHT / 2
  const endX = to.x
  const endY = to.y + NODE_HEIGHT / 2
  const bend = Math.max(24, (endX - startX) / 2)
  return `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`
}

function formatTokens(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: value >= 10_000 ? 'compact' : 'standard' }).format(value)
}

function formatExactTokens(value: number): string {
  return new Intl.NumberFormat().format(value)
}

function GraphEdge({ edge, byId }: {
  readonly edge: AgentMapEdge
  readonly byId: ReadonlyMap<string, AgentMapNode>
}) {
  const from = byId.get(edge.from)
  const to = byId.get(edge.to)
  if (from === undefined || to === undefined) return null
  return (
    <path
      data-edge-kind={edge.kind}
      className={edge.kind === 'tool' ? css.toolEdge : css.flowEdge}
      d={edgePath(from, to)}
    />
  )
}

function GraphNode({ node, selected, onSelect, t }: {
  readonly node: AgentMapNode
  readonly selected: boolean
  readonly onSelect: (node: AgentMapNode) => void
  readonly t: (key: AgentMapKey) => string
}) {
  const title = node.role === 'tool' && node.summary !== '' ? node.summary : t(roleKey(node.role))
  const summary = node.role === 'tool' ? t('node.tool') : node.summary
  const activate = () => { onSelect(node) }
  return (
    <g
      className={css.node}
      data-lane={node.lane}
      data-status={node.status}
      data-selected={selected || undefined}
      data-agent-map-node=""
      role="button"
      tabIndex={0}
      aria-label={`${title}, ${t(statusKey(node.status))}`}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        activate()
      }}
      transform={`translate(${node.x} ${node.y})`}
    >
      <rect className={css.nodeHalo} x={-4} y={-4} width={NODE_WIDTH + 8} height={NODE_HEIGHT + 8} rx={16} />
      <rect className={css.nodeSurface} width={NODE_WIDTH} height={NODE_HEIGHT} rx={12} />
      <circle cx={16} cy={18} r={4} />
      <text className={css.nodeTitle} x={28} y={22}>{title.slice(0, 22)}</text>
      <text className={css.nodeSummary} x={14} y={45}>{summary.slice(0, 25)}</text>
      <text className={css.nodeMeta} x={14} y={62}>
        {node.turn === undefined ? `#${node.seq ?? '…'}` : `T${node.turn} · S${node.step ?? '—'}`}
      </text>
      <text className={css.nodeStatus} x={NODE_WIDTH - 12} y={62} textAnchor="end">
        {t(statusKey(node.status))}
      </text>
    </g>
  )
}

function ZoomIcon({ kind }: { readonly kind: 'in' | 'out' }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M3 8h10" />
      {kind === 'in' && <path d="M8 3v10" />}
    </svg>
  )
}

function TokenDashboard({ calls, selectedCallId, onSelectCall }: {
  readonly calls: readonly AgentMapTokenCall[]
  readonly selectedCallId: string | undefined
  readonly onSelectCall: (id: string) => void
}) {
  if (calls.length === 0) return null
  const total = calls.reduce((sum, call) => sum + call.usage.total, 0)
  return (
    <section
      className={css.tokenDashboard}
      data-token-dashboard=""
      tabIndex={0}
      aria-label={`Token usage: ${formatExactTokens(total)}`}
    >
      <div className={css.tokenDashboardHead}>
        <span>Token usage</span>
        <strong>{formatTokens(total)} tok</strong>
      </div>
      <div className={css.tokenBar} data-has-selection={selectedCallId === undefined ? undefined : ''}>
        {calls.map(call => (
          <button
            type="button"
            key={call.id}
            data-token-call-id={call.id}
            data-selected={call.id === selectedCallId || undefined}
            title={`T${call.turn} · S${call.step}: ${formatExactTokens(call.usage.total)} tok`}
            aria-label={`T${call.turn} · S${call.step}: ${formatExactTokens(call.usage.total)} tok`}
            style={{ flexGrow: total === 0 ? 1 : call.usage.total }}
            onClick={() => { onSelectCall(call.id) }}
          />
        ))}
      </div>
      <div className={css.tokenBreakdown}>
        <strong>Model call share</strong>
        <ol>
          {calls.map((call) => {
            const percent = total === 0 ? 0 : call.usage.total / total * 100
            return (
              <li key={call.id} data-selected={call.id === selectedCallId || undefined}>
                <span>T{call.turn} · S{call.step}</span>
                <span>{formatExactTokens(call.usage.total)} tok · {percent.toFixed(1)}%</span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

function NodeTokenDetails({ usage }: { readonly usage: AgentMapTokenUsage }) {
  const metrics = [
    ['inputTokens', usage.inputTokens],
    ['outputTokens', usage.outputTokens],
    ['cacheReadTokens', usage.cacheReadTokens ?? 0],
    ['reasoningTokens', usage.reasoningTokens ?? 0],
  ] as const
  return (
    <div className={css.nodeTokenDetails} data-agent-map-popup="" role="note" aria-label="Token usage">
      <strong>Token usage</strong>
      <dl>
        {metrics.map(([label, value]) => (
          <div key={label} data-token-metric="">
            <dt>{label}</dt>
            <dd>{formatExactTokens(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function NodeDetails({ node, t }: {
  readonly node: AgentMapNode
  readonly t: (key: AgentMapKey) => string
}) {
  const title = node.role === 'tool' && node.summary !== '' ? node.summary : t(roleKey(node.role))
  return (
    <div className={css.nodeDetails} data-agent-map-popup="" role="complementary" aria-label={t('detail.aria')}>
      <h2>{title}</h2>
      <dl>
        <div><dt>{t('detail.status')}</dt><dd>{t(statusKey(node.status))}</dd></div>
        <div><dt>{t('detail.sequence')}</dt><dd>{node.seq ?? '—'}</dd></div>
        <div><dt>{t('detail.time')}</dt><dd>{new Date(node.time).toLocaleString()}</dd></div>
        <div><dt>{t('detail.turnStep')}</dt><dd>{node.turn === undefined ? '—' : `${node.turn} / ${node.step ?? '—'}`}</dd></div>
        <div><dt>{t('detail.relation')}</dt><dd>{t(node.relation === 'tool' ? 'detail.toolRelation' : 'detail.flowRelation')}</dd></div>
        {node.details.map((item, index) => (
          <div key={`${item.kind}:${index}`} data-kind={item.kind} data-long={item.long || undefined}>
            <dt>{t(detailKey(item.kind))}</dt>
            <dd>{item.long ? <pre>{item.value}</pre> : item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * Render the Agent Map conversation tab from the standard per-session snapshot hook.
 * @param props - Conversation slot runtime and localized product copy.
 * @returns Interactive graph, loaded-window statistics, and selected-node details.
 */
export function AgentMapView({ useSession, t }: ConvViewProps & PropsLocale<'agent-map'>) {
  const nodes = useSession(snapshot => snapshot.nodes)
  const partial = useSession(snapshot => snapshot.partial)
  const runningCalls = useSession(snapshot => snapshot.runningCalls)
  const hasMore = useSession(snapshot => snapshot.hasMore)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [manualScale, setManualScale] = useState<number | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<DragState | null>(null)
  const horizontalScroll = useRef<HTMLDivElement>(null)
  const zoomAnchor = useRef<{ readonly scale: number; readonly x: number; readonly y: number } | null>(null)
  const viewport = useViewportSize()
  const graph = useMemo(
    () => deriveAgentMap({ nodes, partial, runningCalls }),
    [nodes, partial, runningCalls],
  )
  const byId = useMemo(() => new Map(graph.nodes.map(node => [node.id, node])), [graph.nodes])
  const selected = selectedId === null ? undefined : byId.get(selectedId)
  const detailX = selected === undefined
    ? 0
    : Math.max(8, Math.min(selected.x, graph.width - DETAIL_WIDTH - 8))
  const detailY = selected === undefined ? 0 : selected.y + NODE_HEIGHT + DETAIL_GAP
  const tokenDetailX = selected === undefined
    ? 0
    : Math.max(8, Math.min(
      selected.x - (TOKEN_DETAIL_WIDTH - NODE_WIDTH) / 2,
      graph.width - TOKEN_DETAIL_WIDTH - 8,
    ))
  const tokenDetailY = selected === undefined
    ? 0
    : Math.max(4, selected.y - TOKEN_DETAIL_HEIGHT - TOKEN_DETAIL_GAP)
  const canvasHeight = selected === undefined
    ? graph.height
    : Math.max(graph.height, detailY + DETAIL_HEIGHT + 20)
  const fitScale = fitAgentMapScale(graph, viewport.size)
  const scale = manualScale ?? fitScale
  const scalePercent = Math.round(scale * 100)
  useLayoutEffect(() => {
    const element = viewport.ref.current
    const anchor = zoomAnchor.current
    if (element === null || anchor === null || anchor.scale === scale) return
    const ratio = scale / anchor.scale
    element.scrollLeft = anchor.x * ratio - element.clientWidth / 2
    element.scrollTop = anchor.y * ratio - element.clientHeight / 2
    zoomAnchor.current = null
  }, [scale, viewport.ref])
  useLayoutEffect(() => {
    const element = viewport.ref.current
    if (element === null || manualScale !== null) return
    element.scrollLeft = 0
    element.scrollTop = 0
  }, [graph.height, graph.width, manualScale, viewport.ref])
  useLayoutEffect(() => {
    const canvas = viewport.ref.current
    const scrollbar = horizontalScroll.current
    if (canvas === null || scrollbar === null) return
    scrollbar.scrollLeft = canvas.scrollLeft
  }, [graph.width, scale, viewport.ref])

  const changeScale = (delta: number) => {
    const element = viewport.ref.current
    if (element !== null) {
      zoomAnchor.current = {
        scale,
        x: element.scrollLeft + element.clientWidth / 2,
        y: element.scrollTop + element.clientHeight / 2,
      }
    }
    setManualScale(nextScale(scale, delta))
  }

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target instanceof Element && event.target.closest('[role="button"], [data-agent-map-popup]') !== null) return
    drag.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = drag.current
    if (active === null || active.pointerId !== event.pointerId) return
    event.preventDefault()
    event.currentTarget.scrollLeft = active.scrollLeft + active.clientX - event.clientX
    event.currentTarget.scrollTop = active.scrollTop + active.clientY - event.clientY
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    setDragging(false)
  }

  return (
    <div
      className={css.root}
      data-conversation-composer-overlay=""
      onPointerDown={(event) => {
        if (!(event.target instanceof Element)) return
        if (event.target.closest('[data-agent-map-node], [data-agent-map-popup]') === null) setSelectedId(null)
      }}
    >
      <header className={css.summaryBar}>
        <div className={css.summaryLead}>
          <div className={css.stats}>
            <span data-stat="nodes"><strong>{graph.nodes.length}</strong>{t('stats.nodes')}</span>
            <span data-stat="turns"><strong>{graph.turns}</strong>{t('stats.turns')}</span>
            <span data-stat="tools"><strong>{graph.tools}</strong>{t('stats.tools')}</span>
            <span data-stat="errors" data-alert={graph.errors > 0 || undefined}><strong>{graph.errors}</strong>{t('stats.errors')}</span>
          </div>
        </div>
        <div className={css.summaryActions}>
          {hasMore && <span className={css.windowNotice}>{t('graph.loadedWindow')}</span>}
          <TokenDashboard
            calls={graph.tokenCalls}
            selectedCallId={selected?.tokens === undefined ? undefined : selected.id}
            onSelectCall={setSelectedId}
          />
          <div className={css.zoomControls} role="group" aria-label={t('zoom.controls')}>
            <button
              type="button"
              aria-label={t('zoom.out')}
              disabled={scale <= MIN_SCALE}
              onClick={() => { changeScale(-ZOOM_STEP) }}
            ><ZoomIcon kind="out" /></button>
            <output aria-label={t('zoom.level')}>{scalePercent}%</output>
            <button
              type="button"
              aria-label={t('zoom.in')}
              disabled={scale >= MAX_SCALE}
              onClick={() => { changeScale(ZOOM_STEP) }}
            ><ZoomIcon kind="in" /></button>
            <button
              type="button"
              className={css.fitButton}
              data-active={manualScale === null || undefined}
              aria-pressed={manualScale === null}
              onClick={() => { setManualScale(null) }}
            >{t('zoom.fit')}</button>
          </div>
        </div>
      </header>
      <div className={css.content}>
        <div className={css.graphFrame}>
          <div className={css.laneRail} aria-label={t('graph.aria')}>
            {laneOrder.map((lane, index) => (
              <span
                key={lane}
                data-agent-map-lane={lane}
                style={{ top: (GRAPH_TOP + index * LANE_GAP + NODE_HEIGHT / 2) * scale - scrollTop }}
              >
                {t(laneKey(lane))}
              </span>
            ))}
          </div>
          <div className={css.graphViewport}>
            <div
              className={css.graphScroll}
              ref={viewport.ref}
              data-agent-map-viewport=""
              data-dragging={dragging || undefined}
              onScroll={(event) => {
                setScrollTop(event.currentTarget.scrollTop)
                if (horizontalScroll.current !== null) {
                  horizontalScroll.current.scrollLeft = event.currentTarget.scrollLeft
                }
              }}
              onPointerDown={beginDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {graph.nodes.length === 0
                ? <div className={css.empty}>{t('graph.empty')}</div>
                : (
                  <svg
                    className={css.graph}
                    width={Math.round(graph.width * scale)}
                    height={Math.round(canvasHeight * scale)}
                    viewBox={`0 0 ${graph.width} ${canvasHeight}`}
                    role="img"
                    aria-label={t('graph.aria')}
                  >
                    <defs>
                      <linearGradient id="agent-map-tool-edge" x1="0" x2="1">
                        <stop offset="0" stopColor="var(--dsw-alias-brand-primary)" stopOpacity="0.35" />
                        <stop offset="1" stopColor="var(--dsw-alias-brand-primary)" />
                      </linearGradient>
                      <filter id="agent-map-edge-glow" x="-20%" y="-40%" width="140%" height="180%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>
                    {laneOrder.map((lane, index) => (
                      <line
                        key={lane}
                        className={css.laneLine}
                        x1={0}
                        x2={graph.width - 24}
                        y1={GRAPH_TOP + index * LANE_GAP + NODE_HEIGHT / 2}
                        y2={GRAPH_TOP + index * LANE_GAP + NODE_HEIGHT / 2}
                      />
                    ))}
                    <g className={css.edges}>
                      {graph.edges.map(edge => <GraphEdge key={edge.id} edge={edge} byId={byId} />)}
                    </g>
                    {graph.nodes.map(node => (
                      <GraphNode
                        key={node.id}
                        node={node}
                        selected={node.id === selected?.id}
                        onSelect={(next) => { setSelectedId(next.id) }}
                        t={t}
                      />
                    ))}
                    {selected !== undefined && (
                      <>
                        {selected.tokens !== undefined && (
                          <foreignObject
                            x={tokenDetailX}
                            y={tokenDetailY}
                            width={TOKEN_DETAIL_WIDTH}
                            height={TOKEN_DETAIL_HEIGHT}
                          >
                            <NodeTokenDetails usage={selected.tokens} />
                          </foreignObject>
                        )}
                        <path
                          className={css.detailConnector}
                          d={`M ${selected.x + NODE_WIDTH / 2} ${selected.y + NODE_HEIGHT} V ${detailY}`}
                        />
                        <foreignObject x={detailX} y={detailY} width={DETAIL_WIDTH} height={DETAIL_HEIGHT}>
                          <NodeDetails node={selected} t={t} />
                        </foreignObject>
                      </>
                    )}
                  </svg>
                )}
            </div>
            <div
              ref={horizontalScroll}
              className={css.horizontalScroll}
              data-agent-map-horizontal-scroll=""
              role="region"
              tabIndex={0}
              aria-label={t('scroll.horizontal')}
              onScroll={(event) => {
                if (viewport.ref.current !== null) {
                  viewport.ref.current.scrollLeft = event.currentTarget.scrollLeft
                }
              }}
            >
              <div style={{ width: Math.round(graph.width * scale) }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
