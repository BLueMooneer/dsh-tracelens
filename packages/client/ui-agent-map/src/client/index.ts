/** Browser Agent Map plugin contributing one conversation view. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { AgentMapView } from './AgentMapView.tsx'
import { en, NS, zh } from './locales.ts'

/** Required browser services: the slot registry and locale registry. */
export const inject = ['slots', 'locale']

/**
 * Register the localized Agent Map tab for each conversation-view declaration lifetime.
 * @param ctx - Browser plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-agent-map: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'agent-map',
    order: 20,
    locale: NS,
    label: () => t('view.agentMap'),
  }, AgentMapView))
}
