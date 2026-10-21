import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, AuthError, AppUser } from '@/lib/auth';

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/** 解析请求体 JSON（兼容 POST/PUT/PATCH/DELETE，避免 req.json() 在部分方法下的流问题） */
export async function parseBody<T>(req: NextRequest): Promise<T> {
  let text = '';
  try {
    text = await req.text();
  } catch {
    throw new AuthError('请求体读取失败', 400, 'BAD_BODY');
  }
  const jsonText = text.replace(/^\uFEFF/, '').trim();
  try {
    return JSON.parse(jsonText) as T;
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    const codes = Array.from(jsonText).slice(0, 30).map((c) => c.charCodeAt(0)).join(',');
    throw new AuthError(`请求体格式错误:${why}|len=${jsonText.length}|codes=${codes}`, 400, 'BAD_BODY');
  }
}

/** 统一鉴权：从请求解析当前登录用户，异常转为带状态的 AuthError */
export async function requireUser(req: NextRequest): Promise<AppUser> {
  return getSessionUser(req);
}

/** 将错误转换为 NextResponse */
export function toErrorResponse(e: unknown): NextResponse {
  if (e instanceof AuthError) {
    return fail(e.message, e.status, e.code);
  }
  const msg = e instanceof Error ? e.message : '服务器内部错误';
  return fail(msg, 500);
}

/** 读取分页参数 */
export function getPagination(searchParams: URLSearchParams, defaultSize = 10) {
  const page = Math.max(1, Number(searchParams.get('page') || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || defaultSize) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}