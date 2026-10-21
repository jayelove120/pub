import type { Metadata } from 'next';
import './globals.css';
import { SupabaseConfigProvider } from '@/lib/supabase-config-inject';
import { AuthProvider } from '@/components/auth-provider';

export const metadata: Metadata = {
  title: {
    default: '设备备品备件管理系统',
    template: '%s | 备件管理',
  },
  description: '设备备品备件的全生命周期管理：基础数据、出入库、库存预警、统计分析。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`antialiased`}>
        <SupabaseConfigProvider>
          <AuthProvider>{children}</AuthProvider>
        </SupabaseConfigProvider>
      </body>
    </html>
  );
}