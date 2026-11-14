import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { seedDemoMission } from '../../data/seed/demoMission';
import {
  getLiveJudgeScriptData,
  buildJudgeTourSteps,
  playNarration,
} from './judgeScript';

describe('Judge Mode 90-Second Guided Story per HALO_SPEC §7.18', () => {
  beforeEach(async () => {
    await seedDemoMission();
  });

  it('reads all dynamic values live from the engine and demo telemetry with no hardcoding (§7.18 v3)', async () => {
    const data = await getLiveJudgeScriptData();

    // 1. Mission and Comm Delay values
    expect(data.missionDay).toBe(142);
    expect(data.lightMinutes).toBe(14);
    expect(data.oneWayDelaySec).toBe(846);
    expect(data.commDelayStr).toContain('14 min');
    expect(data.autonomyLevel).toBe('AUTONOMOUS');

    // 2. Readiness and Fatigue Story values
    expect(data.day110Readiness).toBe(92);
    expect(data.todayReadiness).toBeLessThan(80); // Real readiness calculated by rules engine
    expect(data.todayReadiness).toBeGreaterThan(0);
    expect(data.sleepHours).toBe(5.5);
    expect(data.sleepConsecutiveDays).toBe(3);

    // 3. PVT Cognitive Slowdown values
    expect(data.pvtSpeed).toBe(3.2);
    expect(data.pvtBaselineSpeed).toBe(4.2);
    expect(data.pvtSlowdownPercent).toBeGreaterThan(20); // > 20% slowdown vs baseline

    // 4. SANS Vision values
    expect(data.amslerDay).toBe(135);
    expect(data.amslerEye).toBe('right eye');
    expect(data.amslerDistortionCount).toBe(1);

    // 5. Emergency Decision Clock and CPR values
    expect(data.decisionClockStr).toContain('28 min'); // 2 x 14 min 06 s
    expect(data.cprRate).toBe(110); // 110 beats/min
    expect(data.compressedDelaySec).toBe(28); // 30x compression
  });

  it('builds exactly 6 structured steps totaling 90 seconds', async () => {
    const data = await getLiveJudgeScriptData();
    const steps = buildJudgeTourSteps(data);

    expect(steps.length).toBe(6);

    // Verify total duration equals 90 seconds (90000 ms)
    const totalDurationMs = steps.reduce((sum, s) => sum + s.durationMs, 0);
    expect(totalDurationMs).toBe(90000);

    // Step 1: (0–10 s) Starfield / Space Context
    const step1 = steps[0];
    expect(step1.stepIndex).toBe(1);
    expect(step1.route).toBe('/');
    expect(step1.durationMs).toBe(10000);
    expect(step1.captionText).toContain('Day 142');
    expect(step1.captionText).toContain('14 light-minutes');
    expect(step1.captionText).toContain('AUTONOMOUS');

    // Step 2: (10–25 s) Readiness drop & Brain ALERT
    const step2 = steps[1];
    expect(step2.stepIndex).toBe(2);
    expect(step2.route).toBe('/');
    expect(step2.durationMs).toBe(15000);
    expect(step2.captionText).toContain(String(data.day110Readiness));
    expect(step2.captionText).toContain(String(data.todayReadiness));
    expect(step2.captionText).toContain('5.5 h');
    expect(step2.captionText).toContain('3 days');
    expect(step2.captionText).toContain('PVT');

    // Step 3: (25–40 s) SANS / Eyes distortion
    const step3 = steps[2];
    expect(step3.stepIndex).toBe(3);
    expect(step3.route).toBe('/');
    expect(step3.durationMs).toBe(15000);
    expect(step3.captionText).toContain('Day 135');
    expect(step3.captionText).toContain('right eye');
    expect(step3.captionText).toContain('SANS');

    // Step 4: (40–55 s) Ground Link arc
    const step4 = steps[3];
    expect(step4.stepIndex).toBe(4);
    expect(step4.route).toBe('/groundlink');
    expect(step4.durationMs).toBe(15000);
    expect(step4.captionText).toContain('14-minute');
    expect(step4.captionText).toContain('HALO acts now');

    // Step 5: (55–80 s) Emergency chest pain & CPR coach
    const step5 = steps[4];
    expect(step5.stepIndex).toBe(5);
    expect(step5.route).toBe('/emergency?simulated=true');
    expect(step5.durationMs).toBe(25000);
    expect(step5.captionText).toContain('Earliest Earth answer: 28 min');
    expect(step5.captionText).toContain('110/min CPR metronome');
    expect(step5.captionText).toContain('Evetts-Russomano');

    // Step 6: (80–90 s) Split view (/split) & Ground Console
    const step6 = steps[5];
    expect(step6.stepIndex).toBe(6);
    expect(step6.route).toBe('/split');
    expect(step6.durationMs).toBe(10000);
    expect(step6.captionText).toContain('Ground Console');
    expect(step6.captionText).toContain('/split view');
  });

  it('runs offline narration handler safely without throwing in headless environments', () => {
    let finished = false;
    const handle = playNarration('Test narration for judge mode.', () => {
      finished = true;
    });

    expect(handle).toBeDefined();
    expect(finished).toBe(false);
    expect(typeof handle.stop).toBe('function');
    expect(typeof handle.pause).toBe('function');
    expect(typeof handle.resume).toBe('function');

    handle.pause();
    handle.resume();
    handle.stop();
  });
});
