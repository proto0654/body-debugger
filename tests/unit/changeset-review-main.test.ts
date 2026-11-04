// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Changeset } from '@shared/domain/changeset'

const state = vi.hoisted(() => ({ dir: '' }))
vi.mock('electron', () => ({ app: { getPath: () => state.dir }, safeStorage: { isEncryptionAvailable: () => false } }))
let catalog: typeof import('../../electron/main/catalog-store')
let orchestrator: typeof import('../../electron/main/llm/orchestrator')
let persistence: typeof import('../../electron/main/persistence')

beforeEach(async () => {
  vi.resetModules()
  state.dir = mkdtempSync(join(tmpdir(), 'bd-review-'))
  persistence = await import('../../electron/main/persistence')
  persistence.loadPersistence()
  catalog = await import('../../electron/main/catalog-store')
  catalog.loadCatalogStore()
  orchestrator = await import('../../electron/main/llm/orchestrator')
  catalog.saveChangeset({ id: 'draft', kind: 'edit', targetSetId: 'user-main', createdAt: new Date().toISOString(), status: 'awaiting_approval', ops: [{ enabled: true, state: 'ok', issues: [], op: { op: 'update', id: 'wrist-circles', patch: { description: 'Уточнённая инструкция.' } } }] })
})
afterEach(() => rmSync(state.dir, { recursive: true, force: true }))

describe('reviewed AI changesets', () => {
  it('compares against the actual input and applies a reviewed shipped fork only once', () => {
    const review = orchestrator.reviewChangeset('draft')!
    expect(review.rows[0]?.title).toBe('Вращения запястьями')
    expect(review.rows[0]?.action).toContain('свой вариант')
    expect(review.rows[0]?.fields[0]?.after).toBe('Уточнённая инструкция.')
    expect(catalog.getCatalogFile().exercises).toHaveLength(0)
    expect(orchestrator.applyReviewedChangeset('draft', review.token).status).toBe('applied')
    expect(catalog.getCatalogFile().exercises).toHaveLength(1)
    expect(orchestrator.applyReviewedChangeset('draft', review.token).status).toBe('unavailable')
    expect(catalog.getCatalogFile().exercises).toHaveLength(1)
    expect(orchestrator.revertChangeset('draft')?.status).toBe('reverted')
  })
  it('rejects stale catalog and profile comparisons without writing changes', () => {
    const review = orchestrator.reviewChangeset('draft')!
    catalog.renameBatch('user-main', 'Другое название')
    expect(orchestrator.applyReviewedChangeset('draft', review.token).status).toBe('stale')
    const next = orchestrator.reviewChangeset('draft')!
    persistence.updateSettings({ ...persistence.getSettings(), profileShifts: [{ axis: 'zone', key: 'upper', source: 'user', level: 1, until: new Date(Date.now() + 86_400_000).toISOString() }] })
    expect(orchestrator.applyReviewedChangeset('draft', next.token).status).toBe('stale')
    expect(catalog.getCatalogFile().exercises).toHaveLength(0)
  })
  it('invalidates review after operation selection and rejects an empty selection', () => {
    const checked = orchestrator.reviewChangeset('draft')!
    orchestrator.toggleOp('draft', 0, false)
    expect(orchestrator.applyReviewedChangeset('draft', checked.token).status).toBe('stale')
    expect(orchestrator.applyReviewedChangeset('draft', orchestrator.reviewChangeset('draft')!.token).status).toBe('unavailable')
  })
  it('does not offer a fabricated review for historical applied changesets', () => {
    catalog.saveChangeset({ ...catalog.getChangeset('draft')!, status: 'applied' } as Changeset)
    expect(orchestrator.reviewChangeset('draft')).toBeNull()
  })
})
