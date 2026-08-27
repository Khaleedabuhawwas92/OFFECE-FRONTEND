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

  if (isProtected && !token) {
    return next("/login");
  }
  if (to.path === "/login" && token) {
    return next("/");
  }
  next();
});

export default router;
