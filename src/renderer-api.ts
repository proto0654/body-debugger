import type { BodyDebuggerApi } from '@/env'

/**
 * Nested laboratory host pushes a sandbox-facing API so Pinia stores inside
 * that app never call the real-profile bridge on `window.api`.
 */
const stack: BodyDebuggerApi[] = []

export function pushRendererApi(api: BodyDebuggerApi): void {
  stack.push(api)
}

export function popRendererApi(): void {
  stack.pop()
}

export function rendererApi(): BodyDebuggerApi | undefined {
  return stack[stack.length - 1] ?? (typeof window !== 'undefined' ? window.api : undefined)
}
