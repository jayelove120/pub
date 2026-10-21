'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Toaster } from '@/components/ui/sonner';
import {
  LayoutDashboard,
  Boxes,
  Package,
  Tags,
  Layers,
  Truck,
  Warehouse,
  ArrowLeftRight,
  ClipboardEdit,
  BellRing,
  ScrollText,
  Settings,
  Users,
  LogOut,
  Loader2,
  Boxes as BrandIcon,
} from 'lucide-react';

const navItems: { href: string; label: string; icon: typeof Boxes; adminOnly?: boolean }[] = [
  { href: '/', label: '仪表盘', icon: LayoutDashboard },
  { href: '/inventory', label: '库存管理', icon: Warehouse },
  { href: '/inventory/entry', label: '出入库录入', icon: ClipboardEdit },
  { href: '/inventory/transactions', label: '出入库记录', icon: ArrowLeftRight },
  { href: '/materials', label: '物料管理', icon: Package, adminOnly: true },
  { href: '/categories', label: '分类管理', icon: Tags, adminOnly: true },
  { href: '/levels', label: '分级管理', icon: Layers, adminOnly: true },
  { href: '/suppliers', label: '供应商管理', icon: Truck, adminOnly: true },
  { href: '/alerts', label: '库存预警', icon: BellRing },
  { href: '/logs', label: '操作日志', icon: ScrollText, adminOnly: true },
  { href: '/users', label: '用户管理', icon: Users, adminOnly: true },
  { href: '/settings', label: '系统设置', icon: Settings, adminOnly: true },
];

const mobileTabs: { href: string; label: string; icon: typeof Boxes }[] = [
  { href: '/', label: '首页', icon: LayoutDashboard },
  { href: '/inventory', label: '查询', icon: Warehouse },
  { href: '/inventory/entry', label: '录入', icon: ClipboardEdit },
  { href: '/profile', label: '我的', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, authenticated, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !authenticated) {
      router.replace('/login');
    }
  }, [loading, authenticated, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!authenticated) return null;

  const isAdmin = profile?.role === 'admin';
  const visibleNav = navItems.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Toaster />
      {/* PC 侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-neutral-200 bg-white md:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-neutral-200 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <BrandIcon className="h-4.5 w-4.5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-neutral-900">备件管理系统</p>
            <p className="text-[11px] text-neutral-400">Spare Parts Mgt</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {visibleNav.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors ${
                  active ? 'bg-blue-50 font-medium text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-neutral-200 p-3">
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
              {profile?.name?.slice(0, 1) || 'U'}
            </div>
            <div className="flex-1 leading-tight">
              <p className="truncate text-[13px] font-medium text-neutral-800">{profile?.name}</p>
              <p className="text-[11px] text-neutral-400">{isAdmin ? '系统管理员' : '设备管理员'}</p>
            </div>
            <button
              onClick={signOut}
              className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              title="退出登录"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 主内容 */}
      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-20 pt-4 md:px-6 md:pb-8 md:pt-6">{children}</main>
      </div>

      {/* 移动端底部 Tab */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-neutral-200 bg-white md:hidden">
        {mobileTabs.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href.split('/').slice(0, 2).join('/'));
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
                active ? 'text-blue-600' : 'text-neutral-400'
              }`}
            >
              <Icon className="h-5 w-5" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}