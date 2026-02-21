import { createBrowserRouter, redirect } from "react-router";
import HomePage from "./pages/HomePage";
import CustomerOrderPage from "./pages/CustomerOrderPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";
import KitchenPage from "./pages/KitchenPage";
import KitchenLoginPage from "./pages/KitchenLoginPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminMenuPage from "./pages/AdminMenuPage";
import AdminTablesPage from "./pages/AdminTablesPage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import NotFoundPage from "./pages/NotFoundPage";
import AdminLayout from "./components/AdminLayout";

export const router = createBrowserRouter([
  {
    path: "/",
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
    Component: KitchenLoginPage,
  },
  {
    path: "/admin/login",
    Component: AdminLoginPage,
  },
  {
    path: "/admin",
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
    ],
  },
  {
    path: "/kitchen",
    Component: KitchenPage,
  },
  {
    path: "*",
    Component: NotFoundPage,
  },
]);
