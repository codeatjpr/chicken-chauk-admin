import { Navigate, Route, Routes } from "react-router-dom";
import { AdminSessionBootstrap } from "@/components/session/admin-session-bootstrap";
import { RequireAdmin } from "@/components/session/require-admin";
import { AdminLayout } from "@/components/layout/admin-layout";
import { CategoriesPage } from "@/pages/admin/categories-page";
import { CouponsPage } from "@/pages/admin/coupons-page";
import { DashboardPage } from "@/pages/admin/dashboard-page";
import { OrdersPage } from "@/pages/admin/orders-page";
import { PaymentsPage } from "@/pages/admin/payments-page";
import { PayoutsPage } from "@/pages/admin/payouts-page";
import { ProductsPage } from "@/pages/admin/products-page";
import { SubcategoriesPage } from "@/pages/admin/subcategories-page";
import { SearchInsightsPage } from "@/pages/admin/search-insights-page";
import { UsersPage } from "@/pages/admin/users-page";
import { VendorAdminCreatePage } from "@/pages/admin/vendor-admin-create-page";
import { VendorAdminDetailPage } from "@/pages/admin/vendor-admin-detail-page";
import { VendorsPage } from "@/pages/admin/vendors-page";
import { VendorListingsPage } from "@/pages/admin/vendor-listings-page";
import { BannersPage } from "@/pages/admin/banners-page";
import { PlatformSettingsPage } from "@/pages/admin/platform-settings-page";
import { DeliveryRidersPage } from "@/pages/admin/delivery-riders-page";
import { RiderOnboardPage } from "@/pages/admin/rider-onboard-page";
import { ForgotPasswordPage } from "@/pages/admin/forgot-password-page";
import { LoginPage } from "@/pages/admin/login-page";
import { ResetPasswordPage } from "@/pages/admin/reset-password-page";

export default function App() {
  return (
    <AdminSessionBootstrap>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }>
          <Route index element={<DashboardPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="subcategories" element={<SubcategoriesPage />} />
          <Route path="vendors" element={<VendorsPage />} />
          <Route path="vendors/create" element={<VendorAdminCreatePage />} />
          <Route path="vendors/:vendorId" element={<VendorAdminDetailPage />} />
          <Route path="vendor-listings" element={<VendorListingsPage />} />
          <Route path="banners" element={<BannersPage />} />
          <Route path="platform-settings" element={<PlatformSettingsPage />} />
          <Route path="delivery" element={<DeliveryRidersPage />} />
          <Route path="delivery/onboard" element={<RiderOnboardPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="search-insights" element={<SearchInsightsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="payouts" element={<PayoutsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="coupons" element={<CouponsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminSessionBootstrap>
  );
}
