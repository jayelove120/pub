import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator';
  phone?: string;
  profileId: string;
}

const ADMIN_ROLE = 'admin';

export class AuthError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 401, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * 从请求中解析 x-session token，校验登录态并拉取用户档案。
 * 若用户尚无档案（新注册用户），自动创建默认 operator 档案。
 */
export async function getSessionUser(req: NextRequest): Promise<AppUser> {
  const token = req.headers.get('x-session');
  if (!token) {
    throw new AuthError('请先登录', 401, 'NOT_LOGGED_IN');
  }

  // token 客户端仅用于校验身份（auth.getUser 走 Supabase Auth API，不受 RLS 影响）
  const client = getSupabaseClient(token);
  const { data: userData, error: authError } = await client.auth.getUser();
  if (authError || !userData?.user) {
    throw new AuthError('认证失败，请重新登录', 401, 'AUTH_FAILED');
  }
  const authUser = userData.user;

  // 档案读取/创建使用 service client（绕过 RLS；本系统数据访问统一走 service 角色 + 代码级权限）
  const adminClient = getSupabaseClient();
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, user_id, email, name, role, phone, is_active')
    .eq('user_id', authUser.id)
    .maybeSingle();
  if (profileError) {
    throw new AuthError('读取用户信息失败', 500);
  }

  let p = profile;
  if (!p) {
    const email = authUser.email ?? '';
    const metaName =
      (authUser.user_metadata?.full_name as string) ||
      (authUser.user_metadata?.name as string) ||
      email.split('@')[0] ||
      '用户';
    const { data: created, error: createErr } = await adminClient
      .from('profiles')
      .insert({
        user_id: authUser.id,
        email,
        name: metaName,
        role: 'operator',
        is_active: true,
      })
      .select('id, user_id, email, name, role, phone, is_active')
      .single();
    if (createErr) {
      throw new AuthError('创建用户档案失败', 500);
    }
    p = created;
  }

  if (!p.is_active) {
    throw new AuthError('账号已被停用，请联系管理员', 403, 'ACCOUNT_DISABLED');
  }

  return {
    id: p.user_id,
    email: p.email,
    name: p.name,
    role: p.role === 'admin' ? 'admin' : 'operator',
    phone: p.phone ?? undefined,
    profileId: p.id,
  };
}

/** 校验用户为系统管理员，否则抛 403 */
export function requireAdmin(user: AppUser): void {
  if (user.role !== ADMIN_ROLE) {
    throw new AuthError('无权限操作，仅系统管理员可执行该操作', 403, 'FORBIDDEN');
  }
}

/** 校验用户为登录用户（用于设备管理员可访问的接口） */
export function isAuthed(user: AppUser): boolean {
  return user.role === ADMIN_ROLE || user.role === 'operator';
}