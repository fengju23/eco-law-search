import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// mode=mobile 用于 Android 打包：使用精简素材目录 public-mobile
// （不含 485MB 桌面版音频，只带 4 首 30s/22.05kHz 单声道背景音，约 5MB）
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  publicDir: mode === 'mobile' ? 'public-mobile' : 'public',
  base: './',
  server: {
    port: 5188,
    strictPort: true,
    watch: {
      // Windows 原生 fs.watch 在文件快速创建/删除时会抛 EBUSY 导致 dev server 崩溃，
      // 改用轮询监视规避；同时排除大体积/无需热更新的目录。
      usePolling: true,
      interval: 900,
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.npm-cache/**',
        '**/public/**',
        '**/public-mobile/**',
        '**/android/**',
        '**/assets-archive/**',
        '**/*.tmpdir/**',
        '**/*.tmp',
      ],
    },
  },
  build: {
    // 全文库 chunk 本就较大（1242 条），放宽告警阈值
    chunkSizeWarningLimit: 900,
    emptyOutDir: true,
  },
}))
