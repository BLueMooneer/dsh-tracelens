// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as localeApply, inject as localeInject } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'

describe('Agent Map plugin registration', () => {
  it('waits for the view declaration and disposes its localized tab', async () => {
    const ctx = new Context()
    const slots = new SlotRegistry(ctx)
    ctx.provide('connection', { api: { settings: {} }, isLoopback: false } as never)
    ctx.provide('remote', { $on: () => () => {} } as never)
    ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
    ctx.plugin({ inject: [...localeInject], apply: localeApply })
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(slots.entries('conversation.view')).toEqual([])

    slots.register({
      name: 'root',
      children: { 'conversation.view': { kind: 'list', scope: 'session' } },
    }, (_props: { renderSlot?: unknown }) => null)
    expect(slots.entries('conversation.view').map(entry => entry.options.id)).toEqual(['agent-map'])
    expect(slots.entries('conversation.view')[0]?.options.label).toBeTypeOf('function')

    await fiber.dispose()
    expect(slots.entries('conversation.view')).toEqual([])
  })

  it('keeps the host loader entry as an intentional no-op', () => {
    expect(() => { hostApply() }).not.toThrow()
  })
})
