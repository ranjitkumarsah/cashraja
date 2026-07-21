import { api } from './client';
import type {
  InventoryItemView,
  InventoryUploadResult,
  RevealResult,
  StockLevel,
} from './types';

export interface InventoryUploadBody {
  brand: string;
  denomination: number;
  /** Raw pasted text — one code per line or comma-separated. The backend splits, trims and dedupes. */
  codes: string;
}

/** POST /api/admin/inventory (super_admin) — bulk code upload. */
export async function uploadInventory(
  body: InventoryUploadBody,
): Promise<InventoryUploadResult> {
  const { data } = await api.post<InventoryUploadResult>('/admin/inventory', body);
  return data;
}

export interface InventoryListParams {
  brand?: string;
  denomination?: number;
  status?: string;
}

/** GET /api/admin/inventory (super_admin) — masked-code list. */
export async function listInventory(params: InventoryListParams): Promise<InventoryItemView[]> {
  const { data } = await api.get<InventoryItemView[]>('/admin/inventory', { params });
  return data;
}

/** GET /api/admin/inventory/stock-levels (super_admin). */
export async function getStockLevels(): Promise<StockLevel[]> {
  const { data } = await api.get<StockLevel[]>('/admin/inventory/stock-levels');
  return data;
}

/** GET /api/admin/inventory/:id/reveal (super_admin, audited). */
export async function revealCode(id: string): Promise<RevealResult> {
  const { data } = await api.get<RevealResult>(`/admin/inventory/${id}/reveal`);
  return data;
}
