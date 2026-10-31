import { createRouter, createWebHashHistory } from 'vue-router'
import PopupView from '@/views/PopupView.vue'
import DashboardView from '@/views/DashboardView.vue'
import LaboratoryView from '@/views/LaboratoryView.vue'
import LaboratoryPreviewView from '@/views/LaboratoryPreviewView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/laboratory-preview', name: 'laboratory-preview', component: LaboratoryPreviewView },
    { path: '/laboratory', name: 'laboratory', component: LaboratoryView },
    { path: '/', redirect: '/dashboard' },
    { path: '/popup', name: 'popup', component: PopupView },
    { path: '/dashboard', name: 'dashboard', component: DashboardView }
  ]
})
