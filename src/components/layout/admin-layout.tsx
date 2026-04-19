import {
  LogOut,
  LayoutDashboard,
  FolderTree,
  Package,
  Search,
  ShoppingBag,
  Store,
  CreditCard,
  Landmark,
  Users,
  TicketPercent,
  Images,
  ListOrdered,
  Bike,
  UserPlus,
  IdCard,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import { useTheme } from "next-themes";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getApiErrorMessage } from "@/lib/api-error";
import { adminLogout } from "@/services/admin-auth.service";
import { useAdminAuthStore } from "@/stores/admin-auth-store";
import { cn } from "@/lib/utils";

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

export function AdminLayout() {
  const navigate = useNavigate();
  const user = useAdminAuthStore((s) => s.user);
  const clearSession = useAdminAuthStore((s) => s.clearSession);
  const { theme, setTheme } = useTheme();

  function cycleTheme() {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  }

  async function handleLogout() {
    try {
      await adminLogout();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not sign out"));
    } finally {
      clearSession();
      navigate("/admin/login", { replace: true });
    }
  }

  return (
    <div className="bg-background flex min-h-svh">
      <aside className="border-border flex w-60 flex-col border-r bg-card">
        <div className="p-4">
          <p className="font-heading text-foreground text-base font-semibold">Chicken Chauk</p>
          <p className="text-muted-foreground text-xs">Admin</p>
        </div>
        <Separator />
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          <NavLink to="/admin" end className={navClass}>
            <LayoutDashboard className="size-4 shrink-0" aria-hidden />
            Dashboard
          </NavLink>
          <NavLink to="/admin/categories" className={navClass}>
            <FolderTree className="size-4 shrink-0" aria-hidden />
            Categories
          </NavLink>
          <NavLink to="/admin/products" className={navClass}>
            <Package className="size-4 shrink-0" aria-hidden />
            Products
          </NavLink>
          <NavLink to="/admin/vendors" className={navClass}>
            <Store className="size-4 shrink-0" aria-hidden />
            Vendors
          </NavLink>
          <NavLink to="/admin/vendors/create" className={navClass}>
            <UserPlus className="size-4 shrink-0" aria-hidden />
            Onboard vendor
          </NavLink>
          <NavLink to="/admin/vendor-listings" className={navClass}>
            <ListOrdered className="size-4 shrink-0" aria-hidden />
            Vendor listings
          </NavLink>
          <NavLink to="/admin/banners" className={navClass}>
            <Images className="size-4 shrink-0" aria-hidden />
            Banners
          </NavLink>
          <NavLink to="/admin/delivery" className={navClass}>
            <Bike className="size-4 shrink-0" aria-hidden />
            Delivery
          </NavLink>
          <NavLink to="/admin/delivery/onboard" className={navClass}>
            <IdCard className="size-4 shrink-0" aria-hidden />
            Onboard rider
          </NavLink>
          <NavLink to="/admin/orders" className={navClass}>
            <ShoppingBag className="size-4 shrink-0" aria-hidden />
            Orders
          </NavLink>
          <NavLink to="/admin/search-insights" className={navClass}>
            <Search className="size-4 shrink-0" aria-hidden />
            Search
          </NavLink>
          <NavLink to="/admin/payments" className={navClass}>
            <CreditCard className="size-4 shrink-0" aria-hidden />
            Payments
          </NavLink>
          <NavLink to="/admin/payouts" className={navClass}>
            <Landmark className="size-4 shrink-0" aria-hidden />
            Payouts
          </NavLink>
          <NavLink to="/admin/users" className={navClass}>
            <Users className="size-4 shrink-0" aria-hidden />
            Users
          </NavLink>
          <NavLink to="/admin/coupons" className={navClass}>
            <TicketPercent className="size-4 shrink-0" aria-hidden />
            Coupons
          </NavLink>
        </nav>
        <Separator />
        <div className="mt-auto space-y-2 p-3">
          <p className="text-muted-foreground truncate text-xs" title={user?.email ?? ""}>
            {user?.email ?? user?.phone ?? "—"}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 justify-start gap-2"
              onClick={() => void handleLogout()}>
              <LogOut className="size-3.5" aria-hidden />
              Sign out
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              title={`Theme: ${theme ?? 'system'}. Click to cycle.`}
              onClick={cycleTheme}
            >
              {theme === 'dark' ? (
                <Moon className="size-3.5" />
              ) : theme === 'light' ? (
                <Sun className="size-3.5" />
              ) : (
                <Monitor className="size-3.5" />
              )}
              <span className="text-xs capitalize">{theme ?? 'system'}</span>
            </Button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
