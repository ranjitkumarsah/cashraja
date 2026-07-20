import {
  Gift,
  LayoutDashboard,
  Megaphone,
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
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ALL },
  { to: '/users', label: 'Users', icon: Users, roles: ALL },
  { to: '/redemptions', label: 'Redemptions', icon: Gift, roles: ALL },
  { to: '/offers', label: 'Offers', icon: Megaphone, roles: SUPER },
  { to: '/inventory', label: 'Inventory', icon: Package, roles: SUPER },
  { to: '/fraud', label: 'Fraud', icon: ShieldAlert, roles: ALL },
  { to: '/config', label: 'Config', icon: Settings, roles: SUPER },
  { to: '/admins', label: 'Admins', icon: UserCog, roles: SUPER },
];

export function navItemsForRole(role: AdminRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
