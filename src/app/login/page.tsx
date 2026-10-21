'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClientAsync } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { PackageSearch, Boxes, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('请输入账号和密码');
      return;
    }
    setLoading(true);
    try {
      // 支持用户名登录：无 @ 时自动补全企业域名
      const account = email.includes('@') ? email : `${email}@spare.com`;
      const client = await getSupabaseBrowserClientAsync();
      const { error } = await client.auth.signInWithPassword({ email: account, password });
      if (error) throw new Error(error.message);
      toast.success('登录成功');
      router.push('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 p-4">
      <Toaster />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Boxes className="h-7 w-7" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-neutral-900">设备备品备件管理系统</h1>
            <p className="mt-1 text-sm text-neutral-500">备件全生命周期 · 出入库 · 库存预警 · 统计分析</p>
          </div>
        </div>

        <Card className="border-neutral-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-neutral-900">账号登录</CardTitle>
            <CardDescription className="text-sm text-neutral-500">使用账号或企业邮箱登录系统</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm text-neutral-700">
                  账号
                </Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="admin"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm text-neutral-700">
                  密码
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-10"
                />
              </div>
              <Button type="submit" disabled={loading} className="h-10 w-full bg-blue-600 hover:bg-blue-700">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                登 录
              </Button>
            </form>

            <div className="mt-5 rounded-md bg-blue-50 p-3 text-xs leading-5 text-blue-700">
              <p className="mb-1 flex items-center gap-1.5 font-medium">
                <PackageSearch className="h-3.5 w-3.5" /> 演示账号
              </p>
              <p>
                系统管理员：admin / 123456
                <br />
                设备管理员：fuping / 123456
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}