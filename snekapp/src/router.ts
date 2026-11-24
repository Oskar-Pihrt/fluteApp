import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
    { path: '/snakes', name: 'snakes', component: () => import('./views/SnakesView.vue') },
    { path: '/snake/:id', name: 'snake', component: () => import('./views/SnakeView.vue'), props: true },
    { path: '/calendar', name: 'calendar', component: () => import('./views/CalendarView.vue') },
    { path: '/measure', name: 'measure', component: () => import('./views/MeasureView.vue') },
    { path: '/more', name: 'more', component: () => import('./views/MoreView.vue') },
    { path: '/guide', name: 'guide', component: () => import('./views/GuideView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
