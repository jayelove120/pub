'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, PackageSearch, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

interface MaterialOpt {
  id: string;
  code: string;
  name: string;
  spec?: string;
  unit: string;
  unit_price: string;
  safety_stock: number;
  default_supplier_id?: string;
  categories?: { name?: string } | null;
  levels?: { name?: string } | null;
  inventory?: { quantity?: number } | null;
}

interface SupplierOpt {
  id: string;
  name: string;
}

export default function EntryPage() {
  const router = useRouter();
  const [type, setType] = useState<1 | 2>(1);
  const [materials, setMaterials] = useState<MaterialOpt[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([]);
  const [selected, setSelected] = useState<MaterialOpt | null>(null);
  const [search, setSearch] = useState('');
  const [openList, setOpenList] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [m, s] = await Promise.all([
          api<{ rows: MaterialOpt[] }>('/api/materials?pageSize=100'),
          api<SupplierOpt[]>('/api/suppliers'),
        ]);
        setMaterials(m.rows);
        setSuppliers(s.filter((x) => (x as { is_active?: boolean }).is_active !== false));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '加载物料失败');
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (selected) setUnitPrice(selected.unit_price);
    setSupplierId(selected?.default_supplier_id ?? '');
  }, [selected]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpenList(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return materials;
    return materials.filter((m) => m.code.toLowerCase().includes(kw) || m.name.toLowerCase().includes(kw) || m.spec?.toLowerCase().includes(kw));
  }, [materials, search]);

  const totalAmount = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  const outExceed = type === 2 && selected && (Number(quantity) || 0) > (selected.inventory?.quantity ?? 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return toast.error('请选择物料');
    if (!quantity || Number(quantity) <= 0) return toast.error('请输入有效的出入库数量');
    if (outExceed) return toast.error(`出库数量超过当前库存（${selected.inventory?.quantity} ${selected.unit}）`);
    setSubmitting(true);
    try {
      const payload = {
        material_id: selected.id,
        quantity: Number(quantity),
        unit_price: unitPrice,
        supplier_id: supplierId || null,
        remark: remark || undefined,
      };
      await api(type === 1 ? '/api/inventory/in' : '/api/inventory/out', { method: 'POST', body: payload });
      toast.success(type === 1 ? '入库成功' : '出库成功');
      setQuantity('');
      setRemark('');
      router.refresh();
      // 刷新当前库存展示
      const fresh = await api<MaterialOpt>(`/api/materials/${selected.id}`);
      setSelected((prev) => (prev ? { ...prev, inventory: fresh.inventory } : prev));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">出入库录入</h1>
        <p className="text-sm text-neutral-500">选择物料后自动带出信息，输入数量提交</p>
      </div>

      <Card className="border-neutral-200 shadow-sm">
        <CardContent className="p-5">
          {/* 类型切换 */}
          <div className="mb-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType(1)}
              className={`flex items-center justify-center gap-2 rounded-md border py-2.5 text-sm font-medium transition-colors ${
                type === 1 ? 'border-green-600 bg-green-50 text-green-700' : 'border-neutral-200 text-neutral-500'
              }`}
            >
              <ArrowDownToLine className="h-4 w-4" /> 入库
            </button>
            <button
              type="button"
              onClick={() => setType(2)}
              className={`flex items-center justify-center gap-2 rounded-md border py-2.5 text-sm font-medium transition-colors ${
                type === 2 ? 'border-rose-600 bg-rose-50 text-rose-700' : 'border-neutral-200 text-neutral-500'
              }`}
            >
              <ArrowUpFromLine className="h-4 w-4" /> 出库
            </button>
          </div>

          {/* 物料搜索选择 */}
          <div className="mb-4 space-y-1.5" ref={boxRef}>
            <Label>选择物料</Label>
            <div className="relative">
              <div className="relative">
                <PackageSearch className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  className="h-10 pl-8"
                  placeholder="输入编码 / 名称 / 规格搜索"
                  value={selected ? `${selected.code} ${selected.name}` : search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelected(null);
                    setOpenList(true);
                  }}
                  onFocus={() => setOpenList(true)}
                />
              </div>
              {openList && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg">
                  {filtered.length === 0 && <div className="p-3 text-center text-sm text-neutral-400">未找到物料</div>}
                  {filtered.slice(0, 20).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="flex w-full items-center justify-between border-b border-neutral-100 px-3 py-2 text-left last:border-0 hover:bg-neutral-50"
                      onClick={() => {
                        setSelected(m);
                        setSearch('');
                        setOpenList(false);
                      }}
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-800">{m.name}</p>
                        <p className="text-xs text-neutral-400">
                          {m.code}
                          {m.spec ? ` · ${m.spec}` : ''} · 库存 {m.inventory?.quantity ?? 0}
                        </p>
                      </div>
                      <span className="text-[13px] tabular-nums text-neutral-500">¥{Number(m.unit_price).toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 自动带出信息 */}
          {selected && (
            <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-neutral-50 p-3 text-[13px] sm:grid-cols-3">
              <InfoItem label="编码" value={selected.code} />
              <InfoItem label="规格型号" value={selected.spec || '-'} />
              <InfoItem label="类别" value={selected.categories?.name || '-'} />
              <InfoItem label="级别" value={selected.levels?.name || '-'} />
              <InfoItem label="单位" value={selected.unit} />
              <InfoItem label="当前库存" value={`${selected.inventory?.quantity ?? 0}`} />
              <InfoItem label="安全库存" value={`${selected.safety_stock}`} />
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  {type === 1 ? '入库数量' : '出库数量'}（{selected?.unit ?? '件'}）
                </Label>
                <Input
                  type="number"
                  min={0}
                  className="h-10"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>单价（元）</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-10"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>供应商（可空）</Label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">默认供应商</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>备注（出库用途 / 入库来源）</Label>
                <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="选填" rows={2} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-dashed border-neutral-300 px-4 py-3">
              <span className="text-sm text-neutral-500">本次总金额</span>
              <span className="text-lg font-semibold tabular-nums text-neutral-900">¥{totalAmount.toFixed(2)}</span>
            </div>

            {outExceed && <p className="text-sm text-rose-600">出库数量超过当前库存，请调整。</p>}

            <Button
              type="submit"
              disabled={submitting}
              className={`h-11 w-full text-sm ${type === 1 ? 'bg-green-600 hover:bg-green-700' : 'bg-rose-600 hover:bg-rose-700'}`}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认{type === 1 ? '入库' : '出库'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="truncate font-medium tabular-nums text-neutral-800">{value}</p>
    </div>
  );
}