import Index from '@/views/Index.vue';
import { createRouter, createWebHistory } from 'vue-router';
// import { useStore } from 'vuex'

const router = createRouter({
  //@ts-ignore
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [{
    path: '/',
    name: 'index',
    component: Index,
  }, {
    path: '/edit-deck',
    name: 'editDeck',
    component: () => import('@/views/EditDeck.vue'),
  }, {
    path: '/game-room/:roomId',
    name: 'gameRoom',
    component: () => import('@/views/GeniusInvokation.vue'),
  }, {
    path: '/edit-deck/:mode?',
    name: 'editDeck',
    component: () => import('@/views/EditDeck.vue'),
  }]
})

let sum = 0;
router.beforeEach((_to, _from, next) => {
  // if (to.path == '/') {
  //   next();
  //   return;
  // }
  // if (from.name == 'index') {
  //   next();
  //   return;
  // }
  // next({ path: '/' });
  ++sum;
  if (sum == 1) {
    next({ path: '/' });
    return;
  }
  next();
})

export default router
