import { createRouter, createWebHistory } from 'vue-router';
import MapView from './views/MapView.vue';
import StoreDetailPage from './views/StoreDetailPage.vue';
import MaintenanceInboxView from './views/MaintenanceInboxView.vue';
import PrivacyPolicyView from './views/PrivacyPolicyView.vue';
import ImprintView from './views/ImprintView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: MapView },
    { path: '/regions/:regionId', component: MapView },
    { path: '/stores/:storeId', component: StoreDetailPage },
    { path: '/maintenance', component: MaintenanceInboxView },
    { path: '/privacy', component: PrivacyPolicyView },
    { path: '/imprint', component: ImprintView }
  ]
});
