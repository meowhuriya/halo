import { chromium } from 'playwright';

async function testOfflinePwaCache() {
  console.log('🛰️  Testing PWA Offline Service Worker & Cache Storage (v3)...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Load initial page to let Service Worker register & precache
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

    // Wait for Service Worker registration
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return !!reg;
    });
    console.log('✓ Service Worker ready:', swRegistered);

    // Initialize session with demo mission so routes can be accessed
    const loadDemoBtn = page.getByText(/Load Demo Mission/i).first();
    if (await loadDemoBtn.isVisible()) {
      await loadDemoBtn.click();
      await page.waitForURL('http://localhost:5173/', { timeout: 6000 });
      console.log('✓ Seeded Demo Mission for session');
    }

    // Check CacheStorage
    const cacheKeys = await page.evaluate(async () => {
      if (!('caches' in window)) return [];
      return await window.caches.keys();
    });
    console.log('✓ Cache storage keys found:', cacheKeys);

    // 2. Cut network connection completely (offline interplanetary mode)
    console.log('\n--- Disabling Network (Deep Space Offline Mode) ---');
    await context.setOffline(true);

    // 3. Reload root while offline
    console.log('Reloading root http://localhost:5173/ with network disabled...');
    await page.reload({ waitUntil: 'networkidle' });
    const rootTitle = await page.title();
    console.log('✓ Offline reload successful. Title:', rootTitle);

    // 4. Navigate to /emergency while offline
    console.log('Navigating to /emergency with network disabled...');
    await page.goto('http://localhost:5173/emergency', { waitUntil: 'networkidle' });
    await page.getByText(/Is the person responsive and breathing normally\?/i).first().waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Offline /emergency route loaded successfully!');

    // 5. Navigate to /scan while offline
    console.log('Navigating to /scan with network disabled...');
    await page.goto('http://localhost:5173/scan', { waitUntil: 'networkidle' });
    await page.getByText(/Contactless Heart Rate Scan/i).first().waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Offline /scan route loaded successfully!');

    console.log('\n🎉 PWA OFFLINE LOADING FULLY VERIFIED ON `npm run build && npm run preview`!');
  } catch (err) {
    console.error('❌ Offline PWA verification failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testOfflinePwaCache();
