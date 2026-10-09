import { defineConfig } from 'vite';

export default defineConfig({
  // Относительный базовый путь необходим для работы на GitHub Pages
  // и предотвращения ошибок 404 при загрузке ассетов PixiJS/bitecs
  base: './',
  
  build: {
    // Оптимизация для Telegram Web App
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'assets',
    // Генерация sourcemap отключена для продакшена
    sourcemap: false,
  },
  
  server: {
    port: 3000,
    open: true,
  },
});