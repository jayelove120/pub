'use client';

import { Empty, EmptyContent, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { PackageOpen } from 'lucide-react';
import { ReactNode } from 'react';

/** 统一的空状态展示组件 */
export function EmptyState({ title = '暂无数据', description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <Empty>
      <EmptyContent>
        <EmptyMedia>
          <PackageOpen className="h-6 w-6" />
        </EmptyMedia>
        <div className="flex flex-col gap-1">
          <EmptyTitle>{title}</EmptyTitle>
          {description && <EmptyDescription>{description}</EmptyDescription>}
        </div>
        {action}
      </EmptyContent>
    </Empty>
  );
}