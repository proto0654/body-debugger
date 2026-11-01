import { createRouter, createWebHashHistory } from 'vue-router'
import PopupView from '@/views/PopupView.vue'
import DashboardView from '@/views/DashboardView.vue'
import LaboratoryPreviewView from '@/views/LaboratoryPreviewView.vue'
import PlaygroundLabView from '@/views/PlaygroundLabView.vue'
import UpdatePromptView from '@/views/UpdatePromptView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/laboratory-preview', name: 'laboratory-preview', component: LaboratoryPreviewView },
    { path: '/lab-playground', name: 'lab-playground', component: PlaygroundLabView },
    { path: '/update-prompt', name: 'update-prompt', component: UpdatePromptView },
    { path: '/', redirect: '/dashboard' },
    { path: '/popup', name: 'popup', component: PopupView },
    { path: '/dashboard', name: 'dashboard', component: DashboardView }
  ]
})
