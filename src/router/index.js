import { createRouter, createWebHashHistory } from "vue-router";

import BotDashboard from "../components/BotDashboard.vue";
import DriversPage from "../components/DriversPage.vue";
import ConsignorsPage from "../components/ConsignorsPage.vue";
import ConsigneesPage from "../components/ConsigneesPage.vue";
import WaybillEditPage from "../components/WaybillEditPage.vue";
import ReportsPage from "../pages/ReportsPage.vue";

import InvoiceCreatePage from "../components/InvoiceCreatePage.vue";
import WaybillCreatePage from "../components/WaybillCreatePage.vue";
import EditInvoice from "../components/EditInvoice.vue";
import LoginView from "../components/LoginView.vue";
import CustomerLogin from "../components/CustomerLogin.vue";
import CustomerDashboard from "../components/CustomerDashboard.vue";
import AdminCompanies from "../components/AdminCompanies.vue";
import AdminCompanyDetails from "../components/AdminCompanyDetails.vue";

function getTokenRole() {
  const token = localStorage.getItem("auth_token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}

const routes = [
  { path: "/login", name: "Login", component: LoginView, meta: { protected: false } },
  { path: "/", name: "Dashboard", component: BotDashboard, meta: { protected: true } },

  { path: "/drivers", name: "Drivers", component: DriversPage, meta: { protected: true } },
  { path: "/consignors", name: "Consignors", component: ConsignorsPage, meta: { protected: true } },
  { path: "/consignees", name: "Consignees", component: ConsigneesPage, meta: { protected: true } },

  // invoices
  {
    path: "/invoices/new",
    name: "InvoiceCreate",
    component: InvoiceCreatePage,
    meta: { protected: true },
  },
  { path: "/invoices/:id/edit", name: "edit-invoice", component: EditInvoice, meta: { protected: true } },

  // waybills
  {
    path: "/waybills/new",
    name: "WaybillCreate",
    component: WaybillCreatePage,
    meta: { protected: true },
  },
  {
    path: "/waybills/:id/edit",
    name: "WaybillEdit",
    component: WaybillEditPage,
    props: true,
    meta: { protected: true },
  },

  // reports
  { path: "/reports", name: "reports", component: ReportsPage, meta: { protected: true } },
  {
    path: "/reports/:year/:month",
    name: "ReportsMonthDetails",
    component: () => import("../pages/MonthDetails.vue"),
    props: true,
    meta: { protected: true },
  },

  // consignee edit/create
  {
    path: "/consignees/new/edit",
    name: "ConsigneeNew",
    component: () => import("../pages/ConsigneeEdit.vue"),
    meta: { protected: true },
  },
  {
    path: "/consignees/:id/edit",
    name: "ConsigneeEdit",
    component: () => import("../pages/ConsigneeEdit.vue"),
    props: true,
    meta: { protected: true },
  },

  // customer portal
  {
    path: "/customer/login",
    name: "CustomerLogin",
    component: CustomerLogin,
    meta: { protected: false, customerOnly: false },
  },
  {
    path: "/customer/dashboard",
    name: "CustomerDashboard",
    component: CustomerDashboard,
    meta: { protected: true, customerOnly: true },
  },

  // admin companies
  {
    path: "/admin/companies",
    name: "AdminCompanies",
    component: AdminCompanies,
    meta: { protected: true, adminOnly: true },
  },
  {
    path: "/admin/companies/:id",
    name: "AdminCompanyDetails",
    component: AdminCompanyDetails,
    props: true,
    meta: { protected: true, adminOnly: true },
  },

  // fallback
  { path: "/:pathMatch(.*)*", redirect: "/", meta: { protected: false } },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("auth_token");
  const isProtected = to.meta?.protected !== false;
  const customerOnly = to.meta?.customerOnly === true;
  const adminOnly = to.meta?.adminOnly === true;
  const role = getTokenRole();

  // Admin-only routes
  if (adminOnly) {
    if (!token || role !== "ADMIN") {
      return next("/login");
    }
    return next();
  }

  // Customer-only routes
  if (customerOnly) {
    if (!token || role !== "CUSTOMER") {
      return next("/customer/login");
    }
    return next();
  }

  // Admin routes (default protected)
  if (isProtected && !token) {
    return next("/login");
  }

  // If going to /login with valid ADMIN token, redirect to admin dashboard
  if (to.path === "/login" && token && role === "ADMIN") {
    return next("/");
  }

  // If going to /login with valid CUSTOMER token, redirect to customer dashboard
  if (to.path === "/login" && token && role === "CUSTOMER") {
    return next("/customer/dashboard");
  }

  // If going to /customer/login with valid CUSTOMER token, redirect to customer dashboard
  if (to.path === "/customer/login" && token && role === "CUSTOMER") {
    return next("/customer/dashboard");
  }

  // If going to /customer/login with ADMIN token, redirect to admin dashboard
  if (to.path === "/customer/login" && token && role === "ADMIN") {
    return next("/");
  }

  next();
});

export default router;
