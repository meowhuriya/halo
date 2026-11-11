import type { ScheduledTask } from '../data/db';

export interface AdherenceMetrics {
  totalXp: number;
  dailyStreakOrbits: number;
  onTimeCompletions: number;
  totalCompleted: number;
  todayCompleted: number;
  todayTotal: number;
}

function getMissionDayFromTimestamp(missionStartDate: string | undefined, timestampMs: number): number | null {
  if (!missionStartDate) return null;
  const start = new Date(missionStartDate).getTime();
  if (!Number.isFinite(start)) return null;
  return Math.max(1, Math.floor((timestampMs - start) / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * Compute adherence-only XP and daily streak ("orbits") per HALO_SPEC §2 #5 & §7.10.
 * XP is earned strictly for completing scheduled checks on time, never for "good" vital values.
 * Badges and crew adherence pages are omitted per Phase 5 scope.
 */
export function computeAdherenceMetrics(
  tasks: ScheduledTask[],
  currentMissionDay: number,
  missionStartDate?: string
): AdherenceMetrics {
  let totalXp = 0;
  let onTimeCompletions = 0;
  let totalCompleted = 0;

  const activeDaysWithCompletion = new Set<number>();

  for (const task of tasks) {
    if (task.status !== 'completed') continue;
    totalCompleted += 1;

    const completedDay =
      typeof task.completedAt === 'number'
        ? getMissionDayFromTimestamp(missionStartDate, task.completedAt)
        : null;

    // On time if completed on or before dueDay (or when missionStartDate unknown, not marked overdue)
    const isOnTime = completedDay !== null ? completedDay <= task.dueDay : true;
    if (isOnTime) {
      totalXp += Math.max(0, task.xpAwarded);
      onTimeCompletions += 1;
    }

    const recordedDay = completedDay ?? task.dueDay;
    activeDaysWithCompletion.add(recordedDay);
  }

  // Daily streak ("orbits"): consecutive days ending at currentMissionDay
  // (or yesterday if today is still underway with no completion yet).
  let cursorDay = activeDaysWithCompletion.has(currentMissionDay)
    ? currentMissionDay
    : currentMissionDay - 1;

  let dailyStreakOrbits = 0;
  while (cursorDay >= 1 && activeDaysWithCompletion.has(cursorDay)) {
    dailyStreakOrbits += 1;
    cursorDay -= 1;
  }

  const todayTasks = tasks.filter(
    (t) => t.dueDay <= currentMissionDay && (t.dueDay === currentMissionDay || t.status !== 'completed')
  );
  const todayCompleted = tasks.filter(
    (t) => t.dueDay === currentMissionDay && t.status === 'completed'
  ).length;

  return {
    totalXp,
    dailyStreakOrbits,
    onTimeCompletions,
    totalCompleted,
    todayCompleted,
    todayTotal: todayTasks.length,
  };
}
