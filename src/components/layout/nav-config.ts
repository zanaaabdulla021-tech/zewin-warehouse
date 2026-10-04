import {
  LayoutDashboard,
  Warehouse,
  Package,
  Boxes,
  FileText,
  ShieldCheck,
  Truck,
  BarChart3,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Module } from "@/lib/permissions";
import type { Dictionary } from "@/i18n/en";

export type NavItem = { module: Module; href: string; icon: LucideIcon; label: keyof Dictionary["nav"] };
export type NavGroup = { label?: keyof Dictionary["nav"]; items: NavItem[] };

export const NAV: NavGroup[] = [
  { items: [{ module: "dashboard", href: "/", icon: LayoutDashboard, label: "dashboard" }] },
  {
    label: "groupOperations",
    items: [
      { module: "warehouses", href: "/warehouses", icon: Warehouse, label: "warehouses" },
      { module: "products", href: "/products", icon: Package, label: "products" },
      { module: "stock", href: "/stock", icon: Boxes, label: "stock" },
      { module: "documents", href: "/documents", icon: FileText, label: "documents" },
    ],
  },
  {
    label: "groupFinance",
    items: [
      { module: "accounting", href: "/accounting", icon: ShieldCheck, label: "accounting" },
      { module: "suppliers", href: "/suppliers", icon: Truck, label: "suppliers" },
      { module: "reports", href: "/reports", icon: BarChart3, label: "reports" },
    ],
  },
  {
    label: "groupAdmin",
    items: [
      { module: "employees", href: "/employees", icon: Users, label: "employees" },
      { module: "settings", href: "/settings", icon: Settings, label: "settings" },
    ],
  },
];
