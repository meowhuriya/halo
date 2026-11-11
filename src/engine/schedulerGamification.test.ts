import { describe, it, expect } from 'vitest';
import { ENVIRONMENTS } from '../config/environments';
import type { ScheduledTask } from '../data/db';
import {
  computeMissingRoutineTasks,
  getEffectiveTaskStatus,
  getScheduleTemplatesForEnvironment,
  selectOrbitRingTasks,
} from './scheduler';
import { computeAdherenceMetrics } from './gamification';

describe('Scheduler routine & Orbit Ring logic per HALO_SPEC §7.10', () => {
  it('filters routine tasks by available onboard equipment (rover hides BP & glucose)', () => {
    const transitRoutine = getScheduleTemplatesForEnvironment(ENVIRONMENTS.transit);
    const transitTypes = transitRoutine.map((t) => t.taskType);
    expect(transitTypes).toContain('mood_sleep');
    expect(transitTypes).toContain('camera_hr');
    expect(transitTypes).toContain('pvt');
    expect(transitTypes).toContain('bp');
    expect(transitTypes).toContain('amsler');
    expect(transitTypes).toContain('phq2_gad2');
    expect(transitTypes).toContain('glucose');
    expect(transitTypes).toContain('exercise');

    const roverRoutine = getScheduleTemplatesForEnvironment(ENVIRONMENTS.rover);
    const roverTypes = roverRoutine.map((t) => t.taskType);
    expect(roverTypes).not.toContain('bp');
    expect(roverTypes).not.toContain('glucose');
    expect(roverTypes).toContain('camera_hr');
    expect(roverTypes).toContain('pvt');
  });

  it('respects 3-day & weekly cadence windows without duplicating recently completed tasks', () => {
    const existing: ScheduledTask[] = [
      {
        id: 1,
        crewMemberId: 1,
        taskType: 'bp',
        title: 'Resting BP Check',
        frequency: '3_days',
        dueDay: 10,
        status: 'completed',
        xpAwarded: 35,
      },
      {
        id: 2,
        crewMemberId: 1,
        taskType: 'amsler',
        title: 'Amsler Grid SANS Screen',
        frequency: 'weekly',
        dueDay: 10,
        status: 'completed',
        xpAwarded: 40,
      },
    ];

    // On Day 12 (2 days later): bp (3_days) and amsler (weekly) still within cadence
    const day12Missing = computeMissingRoutineTasks(existing, 1, 12, ENVIRONMENTS.transit);
    const day12Types = day12Missing.map((t) => t.taskType);
    expect(day12Types).not.toContain('bp');
    expect(day12Types).not.toContain('amsler');
    expect(day12Types).toContain('camera_hr');

    // On Day 13 (3 days later): bp becomes due again, amsler still covered
    const day13Missing = computeMissingRoutineTasks(existing, 1, 13, ENVIRONMENTS.transit);
    const day13Types = day13Missing.map((t) => t.taskType);
    expect(day13Types).toContain('bp');
    expect(day13Types).not.toContain('amsler');
  });

  it('marks past-due pending checks as overdue and orders orbit ring checks cleanly', () => {
    const tasks: ScheduledTask[] = [
      {
        id: 1,
        crewMemberId: 1,
        taskType: 'camera_hr',
        title: 'HR Scan',
        frequency: 'daily',
        dueDay: 142,
        status: 'completed',
        xpAwarded: 50,
      },
      {
        id: 2,
        crewMemberId: 1,
        taskType: 'bp',
        title: 'BP Check',
        frequency: '3_days',
        dueDay: 140,
        status: 'pending',
        xpAwarded: 35,
      },
      {
        id: 3,
        crewMemberId: 1,
        taskType: 'pvt',
        title: 'PVT-B',
        frequency: 'daily',
        dueDay: 142,
        status: 'pending',
        xpAwarded: 75,
      },
    ];

    expect(getEffectiveTaskStatus(tasks[1], 142)).toBe('overdue');
    const ring = selectOrbitRingTasks(tasks, 142);
    expect(ring.map((t) => t.taskType)).toEqual(['bp', 'pvt', 'camera_hr']);
  });
});

describe('Gamification adherence metrics (XP & daily streak only)', () => {
  it('awards XP strictly for on-time completions and computes multi-day orbit streak', () => {
    const startMs = new Date('2026-01-01T08:00:00Z').getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    const tasks: ScheduledTask[] = [
      {
        id: 1,
        crewMemberId: 1,
        taskType: 'camera_hr',
        title: 'Day 3 HR',
        frequency: 'daily',
        dueDay: 3,
        status: 'completed',
        completedAt: startMs + 2 * dayMs + 3600_000, // Mission Day 3 (on time)
        xpAwarded: 50,
      },
      {
        id: 2,
        crewMemberId: 1,
        taskType: 'pvt',
        title: 'Day 4 PVT',
        frequency: 'daily',
        dueDay: 4,
        status: 'completed',
        completedAt: startMs + 3 * dayMs + 3600_000, // Mission Day 4 (on time)
        xpAwarded: 75,
      },
      {
        id: 3,
        crewMemberId: 1,
        taskType: 'bp',
        title: 'Late Day 2 BP finished Day 4',
        frequency: '3_days',
        dueDay: 2,
        status: 'completed',
        completedAt: startMs + 3 * dayMs + 5000_000, // Completed on Day 4 > dueDay 2 -> late!
        xpAwarded: 35,
      },
      {
        id: 4,
        crewMemberId: 1,
        taskType: 'mood_sleep',
        title: 'Day 5 Mood & Sleep',
        frequency: 'daily',
        dueDay: 5,
        status: 'completed',
        completedAt: startMs + 4 * dayMs + 1000_000, // Mission Day 5 (on time)
        xpAwarded: 30,
      },
      {
        id: 5,
        crewMemberId: 1,
        taskType: 'camera_hr',
        title: 'Day 5 Pending HR',
        frequency: 'daily',
        dueDay: 5,
        status: 'pending',
        xpAwarded: 50,
      },
    ];

    const metrics = computeAdherenceMetrics(tasks, 5, '2026-01-01');
    // Day 3 (50) + Day 4 (75) + Day 5 (30) = 155 XP; late Day 2 task (35) does not add XP
    expect(metrics.totalXp).toBe(155);
    expect(metrics.onTimeCompletions).toBe(3);
    expect(metrics.totalCompleted).toBe(4);
    // Streak ends cleanly across Days 5, 4, 3 -> 3 orbits
    expect(metrics.dailyStreakOrbits).toBe(3);
    expect(metrics.todayCompleted).toBe(1);
    expect(metrics.todayTotal).toBe(2);
  });

  it('preserves yesterday streak if today has not yet started completing checks', () => {
    const startMs = new Date('2026-01-01T08:00:00Z').getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    const tasks: ScheduledTask[] = [
      {
        id: 1,
        crewMemberId: 1,
        taskType: 'camera_hr',
        title: 'Day 1',
        frequency: 'daily',
        dueDay: 1,
        status: 'completed',
        completedAt: startMs + 1000,
        xpAwarded: 50,
      },
      {
        id: 2,
        crewMemberId: 1,
        taskType: 'camera_hr',
        title: 'Day 2',
        frequency: 'daily',
        dueDay: 2,
        status: 'completed',
        completedAt: startMs + dayMs + 1000,
        xpAwarded: 50,
      },
      {
        id: 3,
        crewMemberId: 1,
        taskType: 'camera_hr',
        title: 'Day 3 Pending',
        frequency: 'daily',
        dueDay: 3,
        status: 'pending',
        xpAwarded: 50,
      },
    ];

    const metrics = computeAdherenceMetrics(tasks, 3, '2026-01-01');
    expect(metrics.dailyStreakOrbits).toBe(2);
    expect(metrics.totalXp).toBe(100);
  });
});
