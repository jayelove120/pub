import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

interface RequestOptions {
  method?: string;
  body?: unknown;
}

async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const client = getSupabaseBrowserClient();
  const session = client.auth.getSession();
  const token = (await session).data.session?.access_token;

  const headers: Record<string, string> = {};
  if (token) headers['x-session'] = token;
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body:
      options.body instanceof FormData
        ? options.body
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const err = (data as { error?: string })?.error || `请求失败（${res.status}）`;
    throw new Error(err);
  }
  return data as T;
}

type ApiFn = {
  <T = unknown>(url: string, options?: RequestOptions): Promise<T>;
  get: <T = any>(url: string) => Promise<T>;
  post: <T = any>(url: string, body?: unknown) => Promise<T>;
  put: <T = any>(url: string, body?: unknown) => Promise<T>;
  del: <T = any>(url: string) => Promise<T>;
};

const api = request as ApiFn;
api.get = <T = any>(url: string) => request<T>(url, { method: 'GET' });
api.post = <T = any>(url: string, body?: unknown) => request<T>(url, { method: 'POST', body });
api.put = <T = any>(url: string, body?: unknown) => request<T>(url, { method: 'PUT', body });
api.del = <T = any>(url: string) => request<T>(url, { method: 'DELETE' });

export { api };

/** 流式下载文件（兼容跨域签名单，使用 blob） */
export async function apiDownload(url: string, filename: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['x-session'] = token;
  const res = await fetch(url, { headers });
  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(blobUrl);
}