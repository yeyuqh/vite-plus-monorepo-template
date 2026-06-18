export {}

declare module 'vue' {
  export interface GlobalComponents {
    UButton: (typeof import('@nuxt/ui/components/Button.vue'))['default']
    UCard: (typeof import('@nuxt/ui/components/Card.vue'))['default']
  }
}
