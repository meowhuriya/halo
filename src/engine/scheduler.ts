import type { MissionEnvironment } from '../config/environments';
import { db, type ScheduledTask } from '../data/db';

export type ScheduledTaskType = ScheduledTask['taskType'];

export interface TaskScheduleTemplate {
  taskType: ScheduledTaskType;
  title: string;
  frequency: 'daily' | '3_days' | 'weekly';
  xp: number;
  requiredEquipment?: keyof MissionEnvironment['equipment'];
  route: string;
}

/**
 * Standardized routine per HALO_SPEC §7.10:
 * - Daily: morning mood + sleep log, camera HR scan, PVT-B, exercise countermeasure
 * - Every 3 days: resting BP check (where bpCuff available)
 * - Weekly: PHQ-2/GAD-2, Amsler grid both eyes, blood glucose (where glucometer available)
 * (Gravity Transition Check §7.7 intentionally excluded for current scope.)
 */
export const DEFAULT_SCHEDULE: TaskScheduleTemplate[] = [
  {
    taskType: 'mood_sleep',
    title: 'Morning Sleep & Mood Log',
    frequency: 'daily',
    xp: 30,
    route: '/checks',
  },
  {
    taskType: 'camera_hr',
    title: 'Contactless HR Scan',
    frequency: 'daily',
    xp: 50,
    route: '/scan',
  },
  {
    taskType: 'pvt',
    title: 'PVT-B Reaction Task',
    frequency: 'daily',
    xp: 75,
    route: '/cognition',
  },
  {
    taskType: 'exercise',
    title: 'Countermeasure Exercise Log',
    frequency: 'daily',
    xp: 45,
    route: '/checks',
  },
  {
    taskType: 'bp',
    title: 'Resting BP Check',
    frequency: '3_days',
    xp: 35,
    requiredEquipment: 'bpCuff',
    route: '/checks',
  },
  {
    taskType: 'phq2_gad2',
    title: 'Weekly Behavioral Screen (PHQ-2/GAD-2)',
    frequency: 'weekly',
    xp: 35,
    route: '/checks',
  },
  {
    taskType: 'amsler',
    title: 'Amsler Grid SANS Screen',
    frequency: 'weekly',
    xp: 40,
    route: '/vision',
  },
  {
    taskType: 'glucose',
    title: 'Blood Glucose Check',
    frequency: 'weekly',
    xp: 40,
    requiredEquipment: 'glucometer',
    route: '/checks',
  },
];

export function getTaskRoute(taskType: ScheduledTaskType): string {
  switch (taskType) {
    case 'camera_hr':
      return '/scan';
    case 'pvt':
      return '/cognition';
    case 'amsler':
      return '/vision';
    case 'mood_sleep':
    case 'bp':
    case 'phq2_gad2':
    case 'glucose':
    case 'exercise':
    default:
      return '/checks';
  }
}

export function getScheduleTemplatesForEnvironment(
  environment: Pick<MissionEnvironment, 'equipment'>
): TaskScheduleTemplate[] {
  return DEFAULT_SCHEDULE.filter((tpl) => {
    if (!tpl.requiredEquipment) return true;
    return Boolean(environment.equipment[tpl.requiredEquipment]);
  });
}

/**
 * Determine cadence window in days for recurring tasks (§7.10).
 */
export function getFrequencyCadenceDays(frequency: ScheduledTask['frequency']): number {
  switch (frequency) {
    case 'daily':
      return 1;
    case '3_days':
      return 3;
    case 'weekly':
      return 7;
  }
}

/**
 * Effective status of a task relative to current mission day.
 */
export function getEffectiveTaskStatus(
  task: Pick<ScheduledTask, 'status' | 'dueDay'>,
  currentMissionDay: number
): 'completed' | 'overdue' | 'pending' {
  if (task.status === 'completed') return 'completed';
  if (task.status === 'overdue' || task.dueDay < currentMissionDay) return 'overdue';
  return 'pending';
}

/**
 * Compute new tasks needed for `currentMissionDay` without duplicating active/recent tasks.
 */
export function computeMissingRoutineTasks(
  existingTasks: ScheduledTask[],
  crewMemberId: number,
  currentMissionDay: number,
  environment: Pick<MissionEnvironment, 'equipment'>
): Omit<ScheduledTask, 'id'>[] {
  const templates = getScheduleTemplatesForEnvironment(environment);
  const toCreate: Omit<ScheduledTask, 'id'>[] = [];

  for (const tpl of templates) {
    const cadenceDays = getFrequencyCadenceDays(tpl.frequency);
    const matching = existingTasks.filter((t) => t.taskType === tpl.taskType);

    // Covered if a pending/overdue item already exists, or a task exists within cadence window
    const alreadyCovered = matching.some((t) => {
      if (t.status !== 'completed') return true;
      return currentMissionDay - t.dueDay < cadenceDays;
    });

    if (!alreadyCovered) {
      toCreate.push({
        crewMemberId,
        taskType: tpl.taskType,
        title: tpl.title,
        frequency: tpl.frequency,
        dueDay: currentMissionDay,
        status: 'pending',
        xpAwarded: tpl.xp,
      });
    }
  }

  return toCreate;
}

/**
 * Synchronize crew tasks in Dexie for the active mission day (§7.10):
 * - Marks pending tasks whose dueDay < missionDay as overdue
 * - Inserts any missing default routine checks for the current environment
 */
export async function syncCrewRoutineTasks(
  crewMemberId: number,
  currentMissionDay: number,
  environment: Pick<MissionEnvironment, 'equipment'>
): Promise<ScheduledTask[]> {
  const existing = await db.tasks.where('crewMemberId').equals(crewMemberId).toArray();

  // Promote past-due pending tasks cleanly to 'overdue'
  for (const task of existing) {
    if (task.id && task.status === 'pending' && task.dueDay < currentMissionDay) {
      await db.tasks.update(task.id, { status: 'overdue' });
      task.status = 'overdue';
    }
  }

  const missing = computeMissingRoutineTasks(existing, crewMemberId, currentMissionDay, environment);
  if (missing.length > 0) {
    await db.tasks.bulkAdd(missing as ScheduledTask[]);
  }

  const updated = await db.tasks.where('crewMemberId').equals(crewMemberId).toArray();
  return updated.sort((a, b) => a.dueDay - b.dueDay || (a.id ?? 0) - (b.id ?? 0));
}

/**
 * Get the set of tasks shown on "Today's checks" Orbit Ring & active checklist:
 * all overdue tasks, all pending tasks due today or earlier, plus tasks due/completed today.
 */
export function selectOrbitRingTasks(
  tasks: ScheduledTask[],
  currentMissionDay: number
): ScheduledTask[] {
  return tasks
    .filter((t) => {
      const effective = getEffectiveTaskStatus(t, currentMissionDay);
      if (effective === 'overdue') return true;
      if (t.dueDay <= currentMissionDay && effective === 'pending') return true;
      if (t.dueDay === currentMissionDay && effective === 'completed') return true;
      return false;
    })
    .sort((a, b) => {
      const rank = { overdue: 0, pending: 1, completed: 2 };
      const ra = rank[getEffectiveTaskStatus(a, currentMissionDay)];
      const rb = rank[getEffectiveTaskStatus(b, currentMissionDay)];
      return ra - rb || a.dueDay - b.dueDay;
    });
}

/**
 * Offline local browser reminder using Notification API when permitted.
 */
export function sendLocalNotificationIfPermitted(title: string, body: string): boolean {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      new Notification(title, { body, tag: 'halo-check-reminder' });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
