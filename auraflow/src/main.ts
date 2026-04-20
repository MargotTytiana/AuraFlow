import { App } from './App';

// 等待 DOM 加载完成后启动应用
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});