import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'finder',
    component: () => import('@/views/FingerFinderView.vue'),
    meta: { title: 'Fingering', fit: true },
  },
  {
    path: '/notes',
    name: 'notes',
    component: () => import('@/views/NoteLibraryView.vue'),
    meta: { title: 'Notes' },
  },
  {
    path: '/notes/:note',
    name: 'note',
    component: () => import('@/views/NoteDetailView.vue'),
    meta: { title: 'Note', parent: 'notes', fit: true },
  },
  {
    path: '/sheets',
    name: 'sheets',
    component: () => import('@/views/SheetLibraryView.vue'),
    meta: { title: 'Sheets' },
  },
  {
    path: '/sheets/:id',
    name: 'sheet',
    component: () => import('@/views/SheetDetailView.vue'),
    meta: { title: 'Sheet', parent: 'sheets', immersive: true },
  },
  {
    path: '/ear',
    name: 'ear',
    component: () => import('@/views/EarTrainerView.vue'),
    meta: { title: 'Ear', fit: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Settings' },
  },
  {
    path: '/welcome',
    name: 'welcome',
    component: () => import('@/views/WelcomeView.vue'),
    meta: { title: 'Welcome', bare: true },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

// A new player picks their instruments before anything else.
router.beforeEach((to) => {
  const settings = useSettingsStore()
  if (!settings.onboarded && to.name !== 'welcome') return { name: 'welcome' }
  if (settings.onboarded && to.name === 'welcome') return { name: 'finder' }
})
