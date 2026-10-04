// HTTP-клиент: единая обёртка над fetch, типизированные ошибки, cookie-сессия.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Событие, на которое подписан AuthContext для сброса сессии при 401. */
export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function fetchOrNetworkError(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Нет связи с сервером');
  }
}

/** Разбирает ответ, превращая не-2xx в типизированную ошибку (и сигнализируя о 401). */
async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
    if (response.status === 401) window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    throw new ApiError(response.status, error?.code ?? 'HTTP_ERROR', error?.message ?? `Ошибка запроса (${response.status})`);
  }

  return data as T;
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const response = await fetchOrNetworkError(path, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseResponse<T>(response);
}

/** Отправка multipart (FormData) — Content-Type ставит браузер. */
async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetchOrNetworkError(path, { method: 'POST', credentials: 'same-origin', body: formData });
  return parseResponse<T>(response);
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, formData: FormData) => requestForm<T>(path, formData),
};
