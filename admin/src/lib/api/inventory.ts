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

export interface InventoryUpdateBody {
  /** New ₹ value. Omit to keep. */
  denomination?: number;
  /** New plaintext code. Omit to keep. */
  code?: string;
}

/** PATCH /api/admin/inventory/:id (super_admin) — edit an unused code's value/code. */
export async function updateInventory(
  id: string,
  body: InventoryUpdateBody,
): Promise<InventoryItemView> {
  const { data } = await api.patch<InventoryItemView>(`/admin/inventory/${id}`, body);
  return data;
}

/** DELETE /api/admin/inventory/:id (super_admin) — delete an unused code. */
export async function deleteInventory(id: string): Promise<{ deleted: true }> {
  const { data } = await api.delete<{ deleted: true }>(`/admin/inventory/${id}`);
  return data;
}
