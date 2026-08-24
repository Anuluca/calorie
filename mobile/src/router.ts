import { createRouter, createWebHistory } from "@ionic/vue-router";
import type { RouteLocationNormalized, RouteRecordRaw } from "vue-router";
import TabsPage from "@/pages/TabsPage.vue";
import { syncNativeRoute } from "@/services/native-route";

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
  },
  {
    path: "/updates",
    component: () => import("@/pages/UpdatesPage.vue")
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

router.afterEach((to: RouteLocationNormalized) => syncNativeRoute(to.path));
window.addEventListener("ios-liquid-glass-ready", () => {
  syncNativeRoute(router.currentRoute.value.path);
});

export default router;
