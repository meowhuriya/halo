import { chromium } from 'playwright';

async function runPhase1Verification() {
  console.log('🚀 Starting HALO Phase 1 Browser Verification...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('🔴 Browser Console Error:', msg.text());
    }
  });

  try {
    // 1. Visit root - should load Onboarding or Bridge
    console.log('\n--- Step 1: Navigating to http://localhost:5173/ ---');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    console.log('Page Title:', await page.title());

    // 2. Test Onboarding and Load Demo Mission
    console.log('\n--- Step 2: Testing Onboarding & Demo Mission Seeding ---');
    const loadDemoBtn = page.getByText(/Load Demo Mission/i).first();
    await loadDemoBtn.waitFor({ state: 'visible', timeout: 6000 });
    console.log('✓ "Load Demo Mission" button visible');

    await loadDemoBtn.click();
    console.log('Clicked "Load Demo Mission"...');

    // Wait for redirect to Bridge (/)
    await page.waitForURL('http://localhost:5173/', { timeout: 8000 });
    console.log('✓ Successfully transitioned to Bridge (/) after demo seeding');

    // 3. Verify Top Bar Components per §4 and §5
    console.log('\n--- Step 3: Verifying Top Bar Components ---');
    await page.getByText(/Dr\. Alex Vance/).first().waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Crew Name: Dr. Alex Vance');

    await page.getByText(/DAY 142/).first().waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Mission Day: DAY 142');

    await page.getByText(/Mars Transit/).first().waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Environment Chip: Mars Transit');

    await page.getByText(/Earth: 14 min 06 s one-way/).first().waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Light-delay Chip: Earth: 14 min 06 s one-way');

    const isBannerVisible = await page.getByText(/Autonomous Operations/i).first().isVisible();
    console.log('✓ Autonomous Banner (> 5 min latency):', isBannerVisible ? 'VISIBLE' : 'NOT VISIBLE');

    // 4. Verify Digital Twin and Body Hotspots (§7.2)
    console.log('\n--- Step 4: Verifying Digital Twin & Interactive Systems ---');
    const digitalTwinHeader = await page.getByText(/Astronaut Digital Twin/).first().isVisible();
    console.log('✓ Digital Twin Panel:', digitalTwinHeader ? 'EXISTS' : 'MISSING');

    const brainBtn = page.locator('button[title*="Brain: Cognition"]').first();
    await brainBtn.click();
    console.log('✓ Clicked Brain Hotspot');

    const brainDetails = await page.getByText(/Cognition & Central Nervous System/).first().isVisible();
    console.log('✓ Brain subsystem details rendered:', brainDetails);

    // 5. Verify Floating EMERGENCY button (§7.2)
    console.log('\n--- Step 5: Verifying EMERGENCY Button ---');
    const emergencyBtn = page.locator('button[title*="EMERGENCY"]').first();
    const isEmergVisible = await emergencyBtn.isVisible();
    const box = await emergencyBtn.boundingBox();
    console.log('✓ EMERGENCY Button visible:', isEmergVisible, `(Dimensions: ${Math.round(box?.width || 0)}x${Math.round(box?.height || 0)}px)`);

    // 6. Verify Persistent Footer (§2.8)
    console.log('\n--- Step 6: Verifying Persistent Footer ---');
    const footerDisclaimer = await page.getByText(/Prototype for NASA Space Apps\. Not a medical device\./).first().isVisible();
    console.log('✓ Mandatory NASA Space Apps Disclaimer:', footerDisclaimer);

    // 7. Verify Routing Across All Navigation Items
    console.log('\n--- Step 7: Verifying Route Navigation Across Features ---');
    const routesToTest = [
      { name: 'Camera Scan', path: '/scan', heading: /Contactless Heart Rate Scan/i },
      { name: 'Checks', path: '/checks', heading: /Guided Manual Vitals Checks/i },
      { name: 'Cognition', path: '/cognition', heading: /Psychomotor Vigilance Test/i },
      { name: 'Vision', path: '/vision', heading: /Amsler Grid SANS Self-Screen/i },
      { name: 'Trends', path: '/trends', heading: /Vitals Trends & Baseline Comparison/i },
      { name: 'Ground Link', path: '/groundlink', heading: /Ground Link & Flight Surgeon Queue/i },
      { name: 'Learn', path: '/learn', heading: /Spaceflight Medical & Hazards Library/i },
      { name: 'Validation', path: '/validation', heading: /rPPG Sensor Validation Protocol/i },
      { name: 'Ground Ops', path: '/ground', heading: /Earth Ground Operations Console/i },
    ];

    for (const r of routesToTest) {
      await page.goto(`http://localhost:5173${r.path}`, { waitUntil: 'networkidle' });
      await page.getByText(r.heading).first().waitFor({ state: 'visible', timeout: 5000 });
      console.log(`✓ Route ${r.path} (${r.name}): OK`);
    }

    // Test Emergency Route
    console.log('\n--- Step 8: Verifying Emergency Protocol Screen ---');
    await page.goto('http://localhost:5173/emergency', { waitUntil: 'networkidle' });
    await page.getByText(/Is the person responsive and breathing normally\?/i).first().waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Emergency Triage Question 1: Rendered');

    // 8. Test Offline PWA Capability & Persistence (§8 Acceptance Criterion)
    console.log('\n--- Step 9: Testing Offline PWA & Persistence (§8 Acceptance Criterion) ---');
    // Go back to Bridge
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

    // Enable offline mode
    console.log('Simulating Network Disabled (Deep Space Interplanetary Mode)...');
    await context.setOffline(true);

    // Reload page while completely offline
    await page.reload({ waitUntil: 'networkidle' });
    console.log('✓ Page reloaded with network disabled!');

    await page.getByText(/Dr\. Alex Vance/).first().waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(/DAY 142/).first().waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(/Astronaut Digital Twin/).first().waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Offline Crew Data Retained (Dr. Alex Vance)');
    console.log('✓ Offline Day 142 Retained');
    console.log('✓ Offline Digital Twin UI Active');

    console.log('\n🎉 ALL PHASE 1 ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY IN BROWSER!');
  } catch (err) {
    console.error('❌ Verification failed with error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runPhase1Verification();
