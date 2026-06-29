import { defineConfig } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[64, 'favicon.png']],
    },
    maskable: {
      sizes: [512],
      resizeOptions: { background: '#0f1117' },
    },
    apple: {
      sizes: [180],
      resizeOptions: { background: '#0f1117' },
    },
  },
  images: ['public/icon-source.svg'],
})
