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

const routes = [
  { path: "/", name: "Dashboard", component: BotDashboard },

  { path: "/drivers", name: "Drivers", component: DriversPage },
  { path: "/consignors", name: "Consignors", component: ConsignorsPage },
  { path: "/consignees", name: "Consignees", component: ConsigneesPage },

  // invoices
  {
    path: "/invoices/new",
    name: "InvoiceCreate",
    component: InvoiceCreatePage,
  },
  { path: "/invoices/:id/edit", name: "edit-invoice", component: EditInvoice },

  // waybills
  {
    path: "/waybills/new",
    name: "WaybillCreate",
    component: WaybillCreatePage,
  },
  {
    path: "/waybills/:id/edit",
    name: "WaybillEdit",
    component: WaybillEditPage,
    props: true,
  },

  // reports
  { path: "/reports", name: "reports", component: ReportsPage },
  {
    path: "/reports/:year/:month",
    name: "ReportsMonthDetails",
    component: () => import("../pages/MonthDetails.vue"),
    props: true,
  },

  // consignee edit/create
  {
    path: "/consignees/new/edit",
    name: "ConsigneeNew",
    component: () => import("../pages/ConsigneeEdit.vue"),
  },
  {
    path: "/consignees/:id/edit",
    name: "ConsigneeEdit",
    component: () => import("../pages/ConsigneeEdit.vue"),
    props: true,
  },

  // fallback
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
});
