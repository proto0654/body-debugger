const REQUEST_TIMEOUT_MS = 60_000
const RETRY_BACKOFF_MS = 1_200

export interface ChatCompletionInput {
  baseUrl: string
  model: string
  apiKey: string
  system: string
  user: string
  signal?: AbortSignal
  /** Override the default 60s provider timeout (generate needs more headroom). */
  timeoutMs?: number
}

export interface ChatCompletionResult {
  content: string
  usage?: { promptTokens: number; completionTokens: number }
}

function completionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  if (trimmed.endsWith('/chat/completions')) return trimmed
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`
  return `${trimmed}/v1/chat/completions`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function linkAbort(parent: AbortSignal | undefined, child: AbortController): () => void {
  if (!parent) return () => {}
  if (parent.aborted) {
    child.abort()
    return () => {}
  }
  const onAbort = (): void => child.abort()
  parent.addEventListener('abort', onAbort)
  return () => parent.removeEventListener('abort', onAbort)
}

async function postOnce(
  input: ChatCompletionInput,
  allowRetry: boolean
): Promise<ChatCompletionResult> {
  const controller = new AbortController()
  const unlink = linkAbort(input.signal, controller)
  const timeoutMs = input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : REQUEST_TIMEOUT_MS
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const body: Record<string, unknown> = {
      model: input.model,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user }
      ],
      response_format: { type: 'json_object' }
    }

    const response = await fetch(completionsUrl(input.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })

    if ((response.status === 429 || response.status >= 500) && allowRetry) {
      await sleep(RETRY_BACKOFF_MS)
      return postOnce(input, false)
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`LLM HTTP ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ''}`)
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    const content = json.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('LLM response missing content')

    const usage =
      json.usage &&
      typeof json.usage.prompt_tokens === 'number' &&
      typeof json.usage.completion_tokens === 'number'
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens
          }
        : undefined

    return { content, usage }
  } finally {
    clearTimeout(timeout)
    unlink()
  }
}

export async function chatCompletion(input: ChatCompletionInput): Promise<ChatCompletionResult> {
  try {
    return await postOnce(input, true)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LLM request cancelled or timed out')
    }
    throw error
  }
}
