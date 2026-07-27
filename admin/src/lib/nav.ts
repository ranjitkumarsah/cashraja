import {
  Bell,
  ClipboardList,
  Gift,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Package,
  Settings,
  ShieldAlert,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AdminRole } from './api/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Roles allowed to see + open this section (RBAC matrix, ARCHITECTURE_PLAN §2.3). */
  roles: readonly AdminRole[];
}

const ALL: readonly AdminRole[] = ['reviewer', 'super_admin'];
const SUPER: readonly AdminRole[] = ['super_admin'];

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL },
  { to: '/admin/users', label: 'Users', icon: Users, roles: ALL },
  { to: '/admin/redemptions', label: 'Redemptions', icon: Gift, roles: ALL },
  { to: '/admin/offers', label: 'Offers', icon: Megaphone, roles: SUPER },
  { to: '/admin/inventory', label: 'Inventory', icon: Package, roles: SUPER },
  { to: '/admin/fraud', label: 'Fraud', icon: ShieldAlert, roles: ALL },
  { to: '/admin/feedback', label: 'Feedback', icon: MessageSquare, roles: ALL },
  { to: '/admin/manual-offers', label: 'Manual offers', icon: ClipboardList, roles: ALL },
  { to: '/admin/notifications', label: 'Send notification', icon: Bell, roles: SUPER },
  { to: '/admin/config', label: 'Config', icon: Settings, roles: SUPER },
  { to: '/admin/admins', label: 'Admins', icon: UserCog, roles: SUPER },
];

export function navItemsForRole(role: AdminRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
