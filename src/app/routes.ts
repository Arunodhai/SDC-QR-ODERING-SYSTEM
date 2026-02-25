import { createBrowserRouter, redirect } from "react-router";
import HomePage from "./pages/HomePage";
import CustomerOrderPage from "./pages/CustomerOrderPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";
import KitchenPage from "./pages/KitchenPage";
import KitchenLoginPage from "./pages/KitchenLoginPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import WelcomePage from "./pages/WelcomePage";
import SetupPage from "./pages/SetupPage";
import AdminMenuPage from "./pages/AdminMenuPage";
import AdminTablesPage from "./pages/AdminTablesPage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import NotFoundPage from "./pages/NotFoundPage";
import AdminLayout from "./components/AdminLayout";
import { isWorkspaceAuthenticated } from "./lib/workspaceAuth";
import { hasAdminWorkspaceSession } from "./lib/api";

function requireWorkspaceAuthLoader() {
  if (!isWorkspaceAuthenticated()) {
    return redirect("/setup");
  }
  return null;
}

function requireAdminAuthLoader() {
  if (!isWorkspaceAuthenticated()) {
    return redirect("/setup");
  }
  if (!hasAdminWorkspaceSession()) {
    return redirect("/admin/login");
  }
  return null;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: WelcomePage,
  },
  {
    path: "/welcome",
    loader: () => redirect("/"),
    Component: WelcomePage,
  },
  {
    path: "/setup",
    Component: SetupPage,
  },
  {
    path: "/access",
    loader: requireWorkspaceAuthLoader,
    Component: HomePage,
  },
  {
    path: "/table/:tableNumber",
    Component: CustomerOrderPage,
  },
  {
    path: "/order/success",
    Component: OrderSuccessPage,
  },
  {
    path: "/kitchen/login",
    loader: requireWorkspaceAuthLoader,
    Component: KitchenLoginPage,
  },
  {
    path: "/admin/login",
    loader: requireWorkspaceAuthLoader,
    Component: AdminLoginPage,
  },
  {
    path: "/admin",
    loader: requireAdminAuthLoader,
    Component: AdminLayout,
    children: [
      {
        index: true,
        loader: () => redirect("/admin/dashboard"),
      },
      {
        path: "dashboard",
        Component: AdminDashboardPage,
      },
      {
        path: "menu",
        Component: AdminMenuPage,
      },
      {
        path: "tables",
        Component: AdminTablesPage,
      },
      {
        path: "orders",
        Component: AdminOrdersPage,
      },
      {
        path: "kitchen",
        Component: KitchenPage,
      },
      {
        path: "settings",
        Component: AdminSettingsPage,
      },
    ],
  },
  {
    path: "/kitchen",
    loader: requireWorkspaceAuthLoader,
    Component: KitchenPage,
  },
  {
    path: "*",
    Component: NotFoundPage,
  },
]);
