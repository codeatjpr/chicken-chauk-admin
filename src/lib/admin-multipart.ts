import { getApiRoot } from '@/lib/api-url'
import { useAdminAuthStore } from '@/stores/admin-auth-store'
import type { ApiErrorBody } from '@/types/api'
import type { ApiSuccess } from '@/types/api'

function authHeaders(): HeadersInit {
  const token = useAdminAuthStore.getState().accessToken
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function messageFromApiErrorBody(body: ApiErrorBody | Record<string, unknown>): string | null {
  const msg = typeof body.message === 'string' ? body.message.trim() : ''
  if (msg) return msg
  const errs = body.errors
  if (Array.isArray(errs) && errs.length > 0) {
    return errs.filter((e): e is string => typeof e === 'string').join('; ')
  }
  return null
}

function messageFromFailedResponse(status: number, statusText: string, text: string): string {
  const trimmed = text.trim()
  if (trimmed && !trimmed.startsWith('<')) {
    try {
      const parsed = JSON.parse(text) as ApiErrorBody | Record<string, unknown>
      const fromApi = messageFromApiErrorBody(parsed)
      if (fromApi) return fromApi
    } catch {
      return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed
    }
  }
  return statusText || `Request failed (${status})`
}

/** POST multipart (e.g. field `image`). Do not set Content-Type manually. */
export async function adminPostFormData<T>(path: string, formData: FormData): Promise<T> {
  const url = `${getApiRoot()}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers: authHeaders(),
  })

  const text = await res.text().catch(() => '')
  let parsed: ApiSuccess<T> | ApiErrorBody | Record<string, unknown> | null = null
  if (text.trim()) {
    try {
      parsed = JSON.parse(text) as ApiSuccess<T> | ApiErrorBody
    } catch {
      parsed = null
    }
  }

  if (!res.ok) {
    const fromBody = parsed ? messageFromApiErrorBody(parsed as ApiErrorBody) : null
    throw new Error(fromBody ?? messageFromFailedResponse(res.status, res.statusText, text))
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid response from server')
  }

  const success = parsed as ApiSuccess<T>
  if (!success.success || success.data === undefined) {
    throw new Error(messageFromApiErrorBody(parsed as ApiErrorBody) ?? 'Request failed')
  }
  return success.data
}
