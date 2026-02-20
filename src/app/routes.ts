import { createBrowserRouter } from "react-router";
import HomePage from "./pages/HomePage";
import CustomerOrderPage from "./pages/CustomerOrderPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";
import KitchenPage from "./pages/KitchenPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminMenuPage from "./pages/AdminMenuPage";
import AdminTablesPage from "./pages/AdminTablesPage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import NotFoundPage from "./pages/NotFoundPage";

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
    path: "/kitchen",
    Component: KitchenPage,
  },
  {
    path: "/admin/login",
    Component: AdminLoginPage,
  },
  {
    path: "/admin/menu",
    Component: AdminMenuPage,
  },
  {
    path: "/admin/dashboard",
    Component: AdminDashboardPage,
  },
  {
    path: "/admin/tables",
    Component: AdminTablesPage,
  },
  {
    path: "/admin/orders",
    Component: AdminOrdersPage,
  },
  {
    path: "*",
    Component: NotFoundPage,
  },
]);
