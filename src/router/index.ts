import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'finder',
    component: () => import('@/views/FingerFinderView.vue'),
    meta: { title: 'Fingering' },
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
    meta: { title: 'Note', parent: 'notes' },
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
    meta: { title: 'Sheet', parent: 'sheets' },
  },
  {
    path: '/ear',
    name: 'ear',
    component: () => import('@/views/EarTrainerView.vue'),
    meta: { title: 'Ear' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Settings' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})
