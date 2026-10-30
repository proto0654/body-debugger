// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')

function directive(name: string): string {
  const match = new RegExp(`${name}\\s+([^;"]+)`).exec(html)
  return match?.[1]?.trim() ?? ''
}

/**
 * The renderer CSP is shipped in `index.html`, so it is easy to break without
 * touching any TypeScript. Photos arrive through the custom `photo://` scheme
 * and `'self'` does not cover a different scheme.
 */
describe('renderer Content-Security-Policy', () => {
  it('permits the photo scheme used by the progress gallery', () => {
    expect(directive('img-src')).toContain('photo:')
  })

  it('keeps scripts restricted to the bundled build', () => {
    expect(directive('default-src')).toBe("'self'")
    expect(directive('script-src')).toBe("'self'")
  })
})
