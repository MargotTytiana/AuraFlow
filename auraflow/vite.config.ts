import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    https: false, // 开发时可设为 true 测试摄像头（需证书）
    host: true
  },
  build: {
    target: 'es2020'
  }
});