'use client';

import { toast as sonnerToast } from 'sonner';

type ToastVariant = 'default' | 'destructive';

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

/** 统一的 Toast 封装：成功用 success，失败用 error */
export function toast(input: ToastInput) {
  const isError = input.variant === 'destructive';
  if (isError) {
    sonnerToast.error(input.description || input.title);
  } else if (input.description) {
    sonnerToast.success(input.title, { description: input.description });
  } else {
    sonnerToast.success(input.title);
  }
}