/** `agent-map` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'agent-map'

/** Agent Map dictionary keys shared by both locales. */
export type AgentMapKey =
  | 'view.agentMap' | 'graph.aria' | 'graph.empty' | 'graph.loadedWindow'
  | 'stats.nodes' | 'stats.turns' | 'stats.tools' | 'stats.errors'
  | 'lane.input' | 'lane.model' | 'lane.tool' | 'lane.system' | 'lane.error'
  | 'node.user' | 'node.steering' | 'node.context' | 'node.assistant' | 'node.tool'
  | 'node.command' | 'node.compaction' | 'node.retry' | 'node.error'
  | 'node.maxTokens' | 'node.unknown'
  | 'status.running' | 'status.failed' | 'status.complete'
  | 'zoom.controls' | 'zoom.in' | 'zoom.out' | 'zoom.fit' | 'zoom.level'
  | 'scroll.horizontal'
  | 'detail.aria' | 'detail.status' | 'detail.sequence' | 'detail.time' | 'detail.turnStep' | 'detail.relation'
  | 'detail.flowRelation' | 'detail.toolRelation'
  | 'detail.content' | 'detail.source' | 'detail.form' | 'detail.messageId'
  | 'detail.providerModel' | 'detail.request' | 'detail.timing'
  | 'detail.reasoning' | 'detail.toolCalls' | 'detail.callId' | 'detail.arguments'
  | 'detail.result' | 'detail.error' | 'detail.metadata' | 'detail.subCalls'
  | 'detail.commandId' | 'detail.outcome' | 'detail.summaryEvent'
  | 'detail.shadowedItems' | 'detail.shadowedTokens' | 'detail.retry'
  | 'detail.retryState' | 'detail.eventType' | 'detail.payload'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Agent Map tab, graph, statistics, and detail labels. */
    'agent-map': AgentMapKey
  }
}

/** Simplified Chinese dictionary. */
export const zh: Record<AgentMapKey, string> = {
  'view.agentMap': '执行地图',
  'graph.aria': 'Agent 执行关系图',
  'graph.empty': '当前加载范围内还没有可绘制的执行记录。',
  'graph.loadedWindow': '显示当前已加载的会话范围',
  'stats.nodes': '节点',
  'stats.turns': '轮次',
  'stats.tools': '工具',
  'stats.errors': '错误',
  'lane.input': '输入',
  'lane.model': '模型',
  'lane.tool': '工具',
  'lane.system': '系统',
  'lane.error': '错误',
  'node.user': '用户消息',
  'node.steering': '追加指令',
  'node.context': '上下文',
  'node.assistant': '模型回复',
  'node.tool': '工具调用',
  'node.command': '命令',
  'node.compaction': '上下文压缩',
  'node.retry': '模型重试',
  'node.error': '轮次错误',
  'node.maxTokens': '达到输出上限',
  'node.unknown': '其他事件',
  'status.running': '运行中',
  'status.failed': '失败',
  'status.complete': '完成',
  'zoom.controls': '画布缩放',
  'zoom.in': '放大画布',
  'zoom.out': '缩小画布',
  'zoom.fit': '适应',
  'zoom.level': '当前缩放比例',
  'scroll.horizontal': '横向滚动画布',
  'detail.aria': '执行节点详情',
  'detail.status': '状态',
  'detail.sequence': '序号',
  'detail.time': '时间',
  'detail.turnStep': '轮次 / 步骤',
  'detail.relation': '关系',
  'detail.flowRelation': '时间流',
  'detail.toolRelation': '工具调用',
  'detail.content': '内容',
  'detail.source': '来源',
  'detail.form': '上下文形式',
  'detail.messageId': '消息 ID',
  'detail.providerModel': '提供方 / 模型',
  'detail.request': '请求配置',
  'detail.timing': '耗时',
  'detail.reasoning': '推理内容',
  'detail.toolCalls': '工具调用',
  'detail.callId': '调用 ID',
  'detail.arguments': '参数',
  'detail.result': '结果',
  'detail.error': '错误',
  'detail.metadata': '元数据',
  'detail.subCalls': '直接子调用数',
  'detail.commandId': '命令 ID',
  'detail.outcome': '执行结果',
  'detail.summaryEvent': '摘要事件序号',
  'detail.shadowedItems': '压缩条目数',
  'detail.shadowedTokens': '压缩 Token 数',
  'detail.retry': '重试次数 / 延迟',
  'detail.retryState': '重试状态',
  'detail.eventType': '事件类型',
  'detail.payload': '事件数据',
}

/** English dictionary. */
export const en: Record<AgentMapKey, string> = {
  'view.agentMap': 'Agent Map',
  'graph.aria': 'Agent execution relationship graph',
  'graph.empty': 'There are no execution records to map in the loaded window.',
  'graph.loadedWindow': 'Showing the currently loaded conversation window',
  'stats.nodes': 'Nodes',
  'stats.turns': 'Turns',
  'stats.tools': 'Tools',
  'stats.errors': 'Errors',
  'lane.input': 'Input',
  'lane.model': 'Model',
  'lane.tool': 'Tool',
  'lane.system': 'System',
  'lane.error': 'Error',
  'node.user': 'User message',
  'node.steering': 'Steering message',
  'node.context': 'Context',
  'node.assistant': 'Model response',
  'node.tool': 'Tool call',
  'node.command': 'Command',
  'node.compaction': 'Compaction',
  'node.retry': 'Model retry',
  'node.error': 'Turn error',
  'node.maxTokens': 'Output limit',
  'node.unknown': 'Other event',
  'status.running': 'Running',
  'status.failed': 'Failed',
  'status.complete': 'Complete',
  'zoom.controls': 'Canvas zoom',
  'zoom.in': 'Zoom in',
  'zoom.out': 'Zoom out',
  'zoom.fit': 'Fit',
  'zoom.level': 'Current zoom level',
  'scroll.horizontal': 'Scroll canvas horizontally',
  'detail.aria': 'Execution node details',
  'detail.status': 'Status',
  'detail.sequence': 'Sequence',
  'detail.time': 'Time',
  'detail.turnStep': 'Turn / Step',
  'detail.relation': 'Relations',
  'detail.flowRelation': 'Timeline flow',
  'detail.toolRelation': 'Tool call',
  'detail.content': 'Content',
  'detail.source': 'Source',
  'detail.form': 'Context form',
  'detail.messageId': 'Message ID',
  'detail.providerModel': 'Provider / model',
  'detail.request': 'Request config',
  'detail.timing': 'Timing',
  'detail.reasoning': 'Reasoning',
  'detail.toolCalls': 'Tool calls',
  'detail.callId': 'Call ID',
  'detail.arguments': 'Arguments',
  'detail.result': 'Result',
  'detail.error': 'Error',
  'detail.metadata': 'Metadata',
  'detail.subCalls': 'Direct child calls',
  'detail.commandId': 'Command ID',
  'detail.outcome': 'Outcome',
  'detail.summaryEvent': 'Summary event sequence',
  'detail.shadowedItems': 'Compacted items',
  'detail.shadowedTokens': 'Compacted tokens',
  'detail.retry': 'Retry / delay',
  'detail.retryState': 'Retry state',
  'detail.eventType': 'Event type',
  'detail.payload': 'Event data',
}
