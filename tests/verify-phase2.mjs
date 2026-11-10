import { chromium } from 'playwright';
import { spawn } from 'child_process';

async function main() {
  console.log('--- HALO Phase 2 In-Browser Verification ---');

  // Start vite preview server on port 5174
  const server = spawn('npm', ['run', 'preview', '--', '--port', '5174'], {
    shell: true,
    stdio: 'pipe',
  });

  server.stdout.on('data', (d) => process.stdout.write(`[Server] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[Server Err] ${d}`));

  // Wait for server to be responsive
  await new Promise((r) => setTimeout(r, 2000));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  try {
    console.log('Navigating to http://localhost:5174...');
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');

    // 1. Load Demo Mission if on onboarding
    const loadDemoBtn = page.getByRole('button', { name: /Load Demo Mission/i });
    if (await loadDemoBtn.isVisible()) {
      console.log('Clicking Load Demo Mission...');
      await loadDemoBtn.click();
      await page.waitForTimeout(1000);
    }

    // Verify top bar loaded
    await page.waitForSelector('text=DAY 142');
    console.log('✓ Demo mission loaded (DAY 142)');

    // 2. Navigate to Guided Manual Checks (/checks)
    console.log('Navigating to /checks...');
    await page.goto('http://localhost:5174/checks');
    await page.waitForSelector('text=Guided Manual Vitals Checks');
    console.log('✓ Checks view loaded');

    // 3. Test Phase 2 Criterion: Entering BP 150/95 shows ALERT with a reason
    console.log('Testing Blood Pressure check flow (150/95 mmHg)...');
    const bpCard = page.locator('.rounded-2xl, .rounded-3xl').filter({ hasText: 'Resting Blood Pressure Cuff' }).last();
    const launchBpBtn = bpCard.getByRole('button', { name: /Launch Flow/i });
    await launchBpBtn.click();
    await page.waitForTimeout(500);

    // Verify Step 1: Guide
    await page.waitForSelector('text=How to Measure');
    console.log('✓ BP Step 1 (How to Measure guide & diagram) visible');

    // Go to Step 2: Input
    await page.getByRole('button', { name: /Begin Measurement Entry/i }).click();
    await page.waitForSelector('text=Systolic (mmHg)');

    // Fill 150 / 95
    const sysInput = page.locator('input[placeholder="120"]');
    const diaInput = page.locator('input[placeholder="80"]');
    await sysInput.fill('150');
    await diaInput.fill('95');
    console.log('Entered BP 150 / 95 mmHg');

    // Click Evaluate
    await page.getByRole('button', { name: /Evaluate & Review Result/i }).click();
    await page.waitForTimeout(500);

    // Verify Step 3: Result Card shows ALERT and reason
    await page.waitForSelector('text=ALERT');
    const reasonsText = await page.locator('text=150/95').first().innerText();
    console.log(`✓ Result Card shows ALERT with reason: "${reasonsText}"`);

    // Verify What to do now section exists
    await page.waitForSelector('text=What to do now');
    console.log('✓ Action guidance recommendations rendered');

    // Save reading
    await page.getByRole('button', { name: /Save to Health Record/i }).click();
    await page.waitForTimeout(1500);
    console.log('✓ BP 150/95 saved to mission log');

    // 4. Test Phase 2 Criterion: 5 normal HR entries then 85 bpm (baseline 62 ± 3) shows WATCH "unusual for you"
    console.log('Testing Heart Rate check flow (85 bpm with baseline)...');
    const hrCard = page.locator('.rounded-2xl, .rounded-3xl').filter({ hasText: 'Resting Heart Rate (Manual Radial)' }).last();
    await hrCard.getByRole('button', { name: /Launch Flow/i }).click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: /Begin Measurement Entry/i }).click();
    const hrInput = page.locator('input[placeholder="68"]');
    await hrInput.fill('85');
    console.log('Entered HR 85 bpm');

    await page.getByRole('button', { name: /Evaluate & Review Result/i }).click();
    await page.waitForTimeout(500);

    // Verify result shows WATCH "unusual for you"
    await page.waitForSelector('text=WATCH');
    const unusualText = await page.getByText(/unusual for you/i).first().innerText();
    console.log(`✓ Result Card shows WATCH: "${unusualText}"`);

    // Save reading
    await page.getByRole('button', { name: /Save to Health Record/i }).click();
    await page.waitForTimeout(1500);
    console.log('✓ HR 85 bpm saved to health record');

    // 5. Navigate to /learn and verify Learn Library
    console.log('Navigating to /learn...');
    await page.goto('http://localhost:5174/learn');
    await page.waitForSelector('text=Spaceflight Medical & Hazards Library');
    console.log('✓ Learn Library loaded');

    // Verify topic count
    await page.waitForSelector('text=All Topics');
    const topicCards = await page.locator('h3').allInnerTexts();
    console.log(`✓ Found ${topicCards.length} articles displayed`);

    // Search for "radiation"
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('radiation');
    await page.waitForTimeout(300);
    await page.waitForSelector('text=Galactic Cosmic Rays');
    console.log('✓ Search for "radiation" matched successfully');

    // Expand radiation modal
    await page.locator('h3:has-text("Radiation: Galactic Cosmic Rays")').click();
    await page.waitForSelector('text=1. What It Is');
    await page.waitForSelector('text=2. Why It Changes In Space');
    await page.waitForSelector('text=3. How To Measure It Here');
    await page.waitForSelector('text=4. Clinical Normal Range');
    await page.waitForSelector('text=5. When To Alert CMO / Flight Surgeon');
    console.log('✓ Learn modal expanded with all 5 structured fields');

    // Close modal
    await page.getByRole('button', { name: /Close Reference/i }).click();
    await page.waitForTimeout(300);

    console.log('--- ALL PHASE 2 ACCEPTANCE CRITERIA VERIFIED IN BROWSER! ---');
  } catch (err) {
    console.error('Verification failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
}

main();
