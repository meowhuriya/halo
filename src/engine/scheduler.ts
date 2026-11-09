export interface TaskScheduleTemplate {
  taskType: string;
  title: string;
  frequency: 'daily' | '3_days' | 'weekly';
  xp: number;
}

export const DEFAULT_SCHEDULE: TaskScheduleTemplate[] = [
  { taskType: 'mood_sleep', title: 'Morning Sleep & Mood Log', frequency: 'daily', xp: 30 },
  { taskType: 'camera_hr', title: 'Contactless HR Scan', frequency: 'daily', xp: 50 },
  { taskType: 'pvt', title: 'PVT-B Reaction Task', frequency: 'daily', xp: 75 },
  { taskType: 'bp', title: 'Resting BP Check', frequency: '3_days', xp: 35 },
  { taskType: 'amsler', title: 'Amsler Grid SANS Screen', frequency: 'weekly', xp: 40 },
];
