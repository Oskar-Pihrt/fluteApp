<script setup lang="ts">
import { RouterView } from 'vue-router'
import TabBar from './components/TabBar.vue'
</script>

<template>
  <div class="mx-auto min-h-dvh w-full max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-40">
    <RouterView v-slot="{ Component, route }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
  </div>
  <TabBar />
</template>
