/**
 * Mirrors of the backend admin-auth contracts. Source of truth:
 * backend/src/modules/admin-auth/admin-auth.{controller,service}.ts and dtos.
 * Keep field names snake_case exactly as the wire format.
 */

/** Prisma `AdminRole` enum. */
export type AdminRole = 'reviewer' | 'super_admin';

export interface AdminSummary {
  id: string;
  email: string;
  role: AdminRole;
}

/** Body of POST /api/admin-auth/login (AdminLoginDto). */
export interface AdminLoginRequest {
  email: string;
  password: string;
}

/** Body of POST /api/admin-auth/totp and /totp-setup (TotpVerifyDto). */
export interface TotpVerifyRequest {
  challenge_token: string;
  code: string;
}

/** Successful second-factor response (AdminSessionResult). */
export interface AdminSessionResult {
  access_token: string;
  admin: AdminSummary;
}

/** Challenge response from POST /api/admin-auth/login (TotpChallengeResult). */
export interface TotpChallengeResult {
  totp_required?: true;
  totp_setup_required?: true;
  challenge_token: string;
  /** Present only on setup: otpauth:// URL for the QR code. */
  otpauth_url?: string;
}

/**
 * The backend currently always returns a TOTP challenge from /login, but we
 * defensively accept a direct session too (covers a future "TOTP optional"
 * admin without a client change).
 */
export type LoginResponse = TotpChallengeResult | AdminSessionResult;

export function isSessionResult(response: LoginResponse): response is AdminSessionResult {
  return 'access_token' in response && typeof response.access_token === 'string';
}

/* ────────────────────────── Feature-screen contracts (C5.4–C5.11) ──────────────────────────
 * Source of truth: the admin-* services/controllers under backend/src/modules/*.
 * Wire fields stay snake_case exactly as the backend serializes them.
 */

/* C5.4 Dashboard — GET /api/admin/dashboard/metrics */
export interface MetricsData {
  dau: number;
  coins_issued: number;
  coins_redeemed: number;
  /** 0..1 */
  offer_completion_rate: number;
  outstanding_liability: number;
}
export interface MetricsSnapshotView extends MetricsData {
  captured_at: string;
}
export interface DashboardMetrics {
  current: MetricsData;
  /** recent snapshots, oldest → newest */
  series: MetricsSnapshotView[];
}

/* C5.5 Users */
export type UserStatus = 'active' | 'flagged' | 'banned';

export interface AdminUserListItem {
  id: string;
  email: string;
  display_name: string;
  country: string | null;
  status: string;
  coin_balance_cached: number;
  created_at: string;
  last_seen_at: string;
}
export interface AdminUserListPage {
  users: AdminUserListItem[];
  next_cursor: string | null;
}
export interface UserDevice {
  id: string;
  device_fingerprint: string;
  first_seen: string;
  last_seen: string;
}
export interface UserFraudFlag {
  id: string;
  rule_triggered: string;
  severity: string;
  auto_action: string;
  status: string;
  created_at: string;
}
export interface AdminUserDetail extends AdminUserListItem {
  referral_code: string;
  devices: UserDevice[];
  fraud_flags: UserFraudFlag[];
}
export interface LedgerEntryView {
  id: string;
  amount: number;
  source_type: string;
  source_ref_id: string | null;
  balance_after: number;
  created_at: string;
}
export interface LedgerPageView {
  entries: LedgerEntryView[];
  next_cursor: string | null;
}
export interface AdjustBalanceRequest {
  amount: number;
  reason: string;
}
export interface AdjustBalanceResult {
  balance_after: number;
  ledger_id: string;
}

/* C5.6 Redemptions */
export type RedemptionStatus =
  | 'requested'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'issued';

export interface AdminRedemptionView {
  id: string;
  user: { id: string; email: string };
  gift_card: { id: string; brand: string; denomination: number };
  coin_amount: number;
  status: string;
  rejection_reason: string | null;
  reviewed_by_admin_id: string | null;
  created_at: string;
  resolved_at: string | null;
  has_code: boolean;
}
export interface AdminRedemptionPage {
  redemptions: AdminRedemptionView[];
  next_cursor: string | null;
}
export type ApproveOutcome = 'issued' | 'approved_pending' | 'held_banned_user';
export interface ApproveResult {
  outcome: ApproveOutcome;
  redemption: AdminRedemptionView;
  reason?: string;
}

/* C5.7 Offers */
export interface AdminOfferView {
  id: string;
  network: string;
  external_offer_id: string;
  title: string;
  description: string | null;
  coin_reward: number;
  is_active: boolean;
  created_at: string;
}
export interface PostbackLogView {
  id: string;
  user_id: string;
  network: string;
  external_txn_id: string;
  status: string;
  coin_reward: number;
  status_reason: string | null;
  network_payload: unknown;
  created_at: string;
}
export interface PostbackLogPage {
  logs: PostbackLogView[];
  next_cursor: string | null;
}

/* C5.8 Inventory */
export type InventoryStatus = 'unused' | 'reserved' | 'issued';

export interface InventoryUploadResult {
  inserted: number;
  skipped: number;
  total_submitted: number;
}
export interface InventoryItemView {
  id: string;
  brand: string;
  denomination: number;
  status: string;
  code_masked: string;
  redemption_id: string | null;
  created_at: string;
}
export interface StockLevel {
  brand: string;
  denomination: number;
  unused: number;
  reserved: number;
  issued: number;
}
export interface RevealResult {
  code: string;
  status: string;
}

/* C5.9 Fraud */
export type FraudFlagStatus = 'open' | 'resolved';
export type FraudResolveAction = 'dismiss' | 'ban_user' | 'confirm';

export interface FraudFlagView {
  id: string;
  user: { id: string; email: string; status: string };
  rule_triggered: string;
  severity: string;
  auto_action: string;
  status: string;
  resolution_action: string | null;
  resolved_by_admin_id: string | null;
  resolved_at: string | null;
  created_at: string;
}

/* C5.10 Config */
export interface ConfigView {
  key: string;
  value: unknown;
  version: number;
  updated_at: string;
}

/* C5.11 Admins */
export interface AdminView {
  id: string;
  email: string;
  role: string;
  status: string;
  totp_configured: boolean;
  created_at: string;
}
export interface CreateAdminResult extends AdminView {
  temp_password: string;
}
