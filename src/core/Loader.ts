import { showScreen } from '../ui/ScreenManager';

export async function startLoader() {
  console.log('[LOADER] Запуск визуальной загрузки');
  const progressBar = document.getElementById('progress-bar');
  const statusText = document.getElementById('loader-status');
  
  const steps = [
    { p: 20, t: 'ENGINE START...' },
    { p: 50, t: 'WARP DRIVE ON...' },
    { p: 100, t: 'READY' }
  ];

  for (const step of steps) {
    console.log(`[LOADER] Этап: ${step.t} (${step.p}%)`);
    await new Promise(resolve => setTimeout(resolve, 100));
    if (progressBar) progressBar.style.width = `${step.p}%`;
    if (statusText) statusText.innerText = step.t;
  }

  console.log('[LOADER] Загрузка завершена. Вызываю showScreen(main-menu)');
  showScreen('main-menu');
}