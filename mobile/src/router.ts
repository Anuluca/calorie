import { createRouter, createWebHistory } from "@ionic/vue-router";
import type { RouteRecordRaw } from "vue-router";
import TabsPage from "@/pages/TabsPage.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/tabs/search" },
  {
    path: "/tabs",
    component: TabsPage,
    children: [
      { path: "", redirect: "/tabs/search" },
      {
        path: "search",
        component: () => import("@/pages/SearchPage.vue")
      },
      {
        path: "records",
        component: () => import("@/pages/RecordsPage.vue")
      },
      {
        path: "settings",
        component: () => import("@/pages/SettingsPage.vue")
      }
    ]
  },
  {
    path: "/history",
    component: () => import("@/pages/HistoryPage.vue")
  },
  {
    path: "/records/:dateKey",
    component: () => import("@/pages/RecordDetailPage.vue")
  }
];

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});
