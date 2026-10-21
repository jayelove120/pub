/**
 * 轻量 Excel 兼容工具（CSV 格式 + UTF-8 BOM），可由 Excel/WPS 直接打开。
 */

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** 将二维数组编码为 CSV 字符串 */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map((cell) => escapeCsv(cell)).join(',')).join('\n');
}

/** 生成带 BOM 的 CSV 下载响应 */
export function csvResponse(filename: string, rows: (string | number | null | undefined)[][]) {
  const body = '\uFEFF' + toCsv(rows);
  return new Response(body, {
    headers: {
      'Content-Type': 'application/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}

/** 解析 CSV 文本为二维数组（兼容 BOM 与换行） */
export function parseCsv(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (ch === '\r') {
      // ignore
    } else {
      field += ch;
    }
  }

  // 处理最后一段
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}