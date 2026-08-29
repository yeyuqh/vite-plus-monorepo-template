// @vitest-environment happy-dom

import { shallowMount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, expect, test } from 'vite-plus/test'
import Layout from './Layout.vue'

beforeEach(() => {
  document.documentElement.scrollTop = 0
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
})

test('reveals the masked header fade only after the document content has scrolled', async () => {
  const wrapper = shallowMount(Layout, {
    props: { tabbarEnable: false },
  })
  const header = wrapper.get('[data-layout-header-wrapper]')

  expect(header.classes()).toContain('after:[mask-image:linear-gradient(to_bottom,black,transparent)]')
  expect(header.classes()).toContain('after:h-8')
  expect(header.classes()).toContain('after:opacity-0')
  expect(header.classes()).not.toContain('after:opacity-100')

  document.documentElement.scrollTop = 21
  document.dispatchEvent(new Event('scroll'))
  await nextTick()

  expect(header.classes()).toContain('after:opacity-100')

  document.documentElement.scrollTop = 0
  document.dispatchEvent(new Event('scroll'))
  await nextTick()

  expect(header.classes()).not.toContain('after:opacity-100')
  wrapper.unmount()
})
