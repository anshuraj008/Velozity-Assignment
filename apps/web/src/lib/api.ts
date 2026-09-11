import type { User } from '@velozity/shared';
export const apiOrigin =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
let token: string | null = null;
let refreshPromise: Promise<{ accessToken: string; user: User }> | null = null;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
export function setToken(value: string | null) {
  token = value;
}
export function getToken() {
  return token;
}
async function response<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok)
    throw new ApiError(
      body?.error?.message ?? 'The server could not complete this request.',
      res.status,
      body?.error?.code ?? 'REQUEST_FAILED',
    );
  return body as T;
}
export function refreshSession() {
  if (!refreshPromise) {
    const requestRefresh = () =>
      fetch(`${apiOrigin}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
    // Cookies are shared across tabs. Serialize rotation there as well as within this tab.
    const request = (async () => {
      if (navigator.locks) return await navigator.locks.request('velozity-refresh', requestRefresh);
      return requestRefresh();
    })();
    refreshPromise = request
      .then(response<{ accessToken: string; user: User }>)
      .then((data) => {
        token = data.accessToken;
        return data;
      })
      .catch((error) => {
        token = null;
        window.dispatchEvent(new Event('session-expired'));
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}
export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const res = await fetch(`${apiOrigin}/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    await refreshSession();
    return api<T>(path, options, false);
  }
  return response<T>(res);
}
export const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
