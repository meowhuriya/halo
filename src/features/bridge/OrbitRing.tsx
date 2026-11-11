import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Flame,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { ScheduledTask } from '../../data/db';
import type { AdherenceMetrics } from '../../engine/gamification';
import {
  getEffectiveTaskStatus,
  getTaskRoute,
  type ScheduledTaskType,
} from '../../engine/scheduler';

interface OrbitRingProps {
  tasks: ScheduledTask[];
  missionDay: number;
  adherence: AdherenceMetrics;
  onToggleTaskComplete: (task: ScheduledTask) => Promise<void>;
  onAddTask: (title: string, taskType: ScheduledTaskType, frequency: ScheduledTask['frequency']) => Promise<void>;
  onUpdateTask: (taskId: number, updates: Partial<ScheduledTask>) => Promise<void>;
  onDeleteTask: (taskId: number) => Promise<void>;
  onTriggerReminder: () => void;
}

export const OrbitRing: React.FC<OrbitRingProps> = ({
  tasks,
  missionDay,
  adherence,
  onToggleTaskComplete,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onTriggerReminder,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<ScheduledTaskType>('mood_sleep');
  const [newFreq, setNewFreq] = useState<ScheduledTask['frequency']>('daily');

  const taskNodes = useMemo(() => {
    const count = Math.max(1, tasks.length);
    const radius = 56;
    const cx = 72;
    const cy = 72;

    return tasks.map((task, idx) => {
      const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      const effectiveStatus = getEffectiveTaskStatus(task, missionDay);
      return { task, x, y, effectiveStatus };
    });
  }, [tasks, missionDay]);

  const completedCount = taskNodes.filter((n) => n.effectiveStatus === 'completed').length;
  const overdueCount = taskNodes.filter((n) => n.effectiveStatus === 'overdue').length;
  const progressFraction = tasks.length > 0 ? completedCount / tasks.length : 0;

  const circumference = 2 * Math.PI * 56;
  const dashOffset = circumference * (1 - progressFraction);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    await onAddTask(trimmed, newTaskType, newFreq);
    setNewTitle('');
  };

  return (
    <div className="space-y-4">
      {/* Gamification XP & Daily Streak Header (§7.10 — XP + Streak only) */}
      <div className="grid grid-cols-2 gap-2.5">
        <div
          data-testid="adherence-xp-card"
          className="p-3 rounded-2xl bg-cyan-500/[0.06] border border-cyan-500/20 flex items-center gap-2.5"
        >
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0">
            <Sparkles size={17} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase text-slate-400">Adherence XP</div>
            <div className="text-base font-extrabold font-mono text-white tabular-nums">
              {adherence.totalXp} XP
            </div>
          </div>
        </div>

        <div
          data-testid="adherence-streak-card"
          className="p-3 rounded-2xl bg-amber-500/[0.06] border border-amber-500/20 flex items-center gap-2.5"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
            <Flame size={17} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase text-slate-400">Daily Streak</div>
            <div className="text-base font-extrabold font-mono text-white tabular-nums">
              {adherence.dailyStreakOrbits} {adherence.dailyStreakOrbits === 1 ? 'orbit' : 'orbits'}
            </div>
          </div>
        </div>
      </div>

      {/* Orbit Ring Graphic + Summary Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 rounded-2xl bg-slate-950/60 border border-white/10">
        <div className="relative w-[144px] h-[144px] shrink-0" data-testid="checks-orbit-ring">
          <svg viewBox="0 0 144 144" className="w-full h-full">
            {/* Orbital Track */}
            <circle
              cx="72"
              cy="72"
              r="56"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="4"
            />
            <circle
              cx="72"
              cy="72"
              r="56"
              fill="none"
              stroke={overdueCount > 0 ? '#F59E0B' : '#38E1FF'}
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 72 72)"
              className="transition-all duration-500"
            />

            {/* Task Dots Along Orbit */}
            {taskNodes.map(({ task, x, y, effectiveStatus }, idx) => {
              const fill =
                effectiveStatus === 'completed'
                  ? '#22C55E'
                  : effectiveStatus === 'overdue'
                    ? '#F97316'
                    : '#0B111E';
              const stroke =
                effectiveStatus === 'completed'
                  ? '#86EFAC'
                  : effectiveStatus === 'overdue'
                    ? '#FDBA74'
                    : '#38E1FF';

              return (
                <g key={task.id ?? `${task.taskType}-${idx}`}>
                  {effectiveStatus === 'overdue' && (
                    <circle
                      cx={x}
                      cy={y}
                      r="10"
                      fill="none"
                      stroke="#F97316"
                      strokeWidth="1.5"
                      strokeOpacity="0.6"
                    />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r="6.5"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="2.2"
                  />
                </g>
              );
            })}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-xl font-extrabold font-mono text-white tabular-nums">
              {completedCount}/{tasks.length}
            </span>
            <span className="text-[10px] font-mono uppercase text-slate-400">
              {overdueCount > 0 ? `${overdueCount} Overdue` : 'Today'}
            </span>
          </div>
        </div>

        <div className="flex-1 w-full space-y-2.5 text-center sm:text-left">
          <div className="text-xs text-slate-300 leading-relaxed">
            {overdueCount > 0 ? (
              <span className="text-amber-300 font-semibold">
                {overdueCount} overdue check{overdueCount > 1 ? 's' : ''} deducting −{overdueCount * 3} readiness pts.
              </span>
            ) : completedCount === tasks.length && tasks.length > 0 ? (
              <span className="text-emerald-300 font-semibold">
                All scheduled checks completed for Day {missionDay}.
              </span>
            ) : (
              <span>
                Complete scheduled checks on time to earn Adherence XP (values never affect XP).
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onTriggerReminder}
              data-testid="trigger-reminder-btn"
              className="min-h-[56px] flex-1 px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/35 text-xs font-semibold text-cyan-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Bell size={15} />
              <span>Remind</span>
            </button>
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              data-testid="edit-routine-btn"
              className="min-h-[56px] flex-1 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 text-xs font-semibold text-slate-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Edit3 size={15} />
              <span>{editMode ? 'Done Editing' : 'Edit Routine'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Task Checklist */}
      {tasks.length === 0 ? (
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 text-xs text-center text-slate-400">
          No checks scheduled yet. Use Edit Routine to add checks.
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {taskNodes.map(({ task, effectiveStatus }, idx) => {
            const route = getTaskRoute(task.taskType);
            return (
              <div
                key={task.id ?? `${task.taskType}-${idx}`}
                data-testid={`orbit-task-${task.taskType}`}
                className={`rounded-2xl border p-2.5 transition-colors ${
                  effectiveStatus === 'completed'
                    ? 'bg-emerald-500/[0.07] border-emerald-500/25'
                    : effectiveStatus === 'overdue'
                      ? 'bg-amber-500/[0.08] border-amber-500/35'
                      : 'bg-white/[0.03] border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Checkbox toggle button (56px hit height) */}
                  <button
                    type="button"
                    onClick={() => void onToggleTaskComplete(task)}
                    aria-label={
                      effectiveStatus === 'completed'
                        ? `Mark ${task.title} incomplete`
                        : `Mark ${task.title} complete`
                    }
                    className="min-h-[56px] min-w-[56px] rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                  >
                    {effectiveStatus === 'completed' ? (
                      <CheckCircle2 size={22} className="text-emerald-400" />
                    ) : effectiveStatus === 'overdue' ? (
                      <AlertTriangle size={20} className="text-amber-400" />
                    ) : (
                      <Clock size={20} className="text-cyan-400" />
                    )}
                  </button>

                  {/* Center: Title, due/frequency meta */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-xs sm:text-sm font-semibold truncate ${
                        effectiveStatus === 'completed'
                          ? 'text-slate-300 line-through'
                          : 'text-white'
                      }`}
                    >
                      {task.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                      <span>+{task.xpAwarded} XP</span>
                      <span>· {task.frequency.replace('_', ' ')}</span>
                      {effectiveStatus === 'overdue' && (
                        <span className="text-amber-300 font-bold">OVERDUE (Day {task.dueDay})</span>
                      )}
                    </div>
                  </div>

                  {/* Right: Action link or delete in edit mode */}
                  {editMode && task.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        aria-label={`Frequency for ${task.title}`}
                        value={task.frequency}
                        onChange={(e) =>
                          void onUpdateTask(task.id!, {
                            frequency: e.target.value as ScheduledTask['frequency'],
                          })
                        }
                        className="h-11 px-2 rounded-xl bg-slate-900 border border-white/15 text-[11px] font-mono text-white"
                      >
                        <option value="daily">Daily</option>
                        <option value="3_days">3 days</option>
                        <option value="weekly">Weekly</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void onDeleteTask(task.id!)}
                        aria-label={`Remove ${task.title}`}
                        className="min-h-[56px] min-w-[48px] px-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : effectiveStatus === 'completed' ? (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-mono uppercase inline-flex items-center gap-1 shrink-0">
                      <Check size={12} />
                      Done
                    </span>
                  ) : (
                    <Link
                      to={route}
                      className="min-h-[56px] px-3 rounded-xl bg-white/[0.06] hover:bg-cyan-500/20 border border-white/15 hover:border-cyan-400/40 text-xs font-semibold text-cyan-200 inline-flex items-center justify-center shrink-0 transition-colors"
                    >
                      Open
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editable Routine: Add Task Form */}
      {editMode && (
        <form
          onSubmit={(e) => void handleCreateTask(e)}
          className="p-3.5 rounded-2xl bg-slate-950/75 border border-cyan-500/25 space-y-2.5"
        >
          <div className="text-[11px] font-mono uppercase text-cyan-300">
            Add Custom Scheduled Check
          </div>
          <input
            type="text"
            placeholder="Check title (e.g., Post-EVA SpO₂ Check)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full h-11 px-3 rounded-xl bg-black/50 border border-white/15 text-sm text-white focus:border-cyan-400 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Check category"
              value={newTaskType}
              onChange={(e) => setNewTaskType(e.target.value as ScheduledTaskType)}
              className="h-11 px-2.5 rounded-xl bg-black/50 border border-white/15 text-xs text-white"
            >
              <option value="mood_sleep">Checks / Vitals</option>
              <option value="camera_hr">Camera HR</option>
              <option value="pvt">PVT-B Cognition</option>
              <option value="amsler">Amsler Vision</option>
              <option value="exercise">Exercise</option>
              <option value="bp">Blood Pressure</option>
              <option value="glucose">Blood Glucose</option>
              <option value="phq2_gad2">PHQ-2 / GAD-2</option>
            </select>
            <select
              aria-label="Check cadence"
              value={newFreq}
              onChange={(e) => setNewFreq(e.target.value as ScheduledTask['frequency'])}
              className="h-11 px-2.5 rounded-xl bg-black/50 border border-white/15 text-xs text-white"
            >
              <option value="daily">Daily</option>
              <option value="3_days">Every 3 days</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <button
            type="submit"
            className="min-h-[56px] w-full rounded-xl bg-cyan-400 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 hover:bg-cyan-300 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>Add to Orbit Schedule</span>
          </button>
        </form>
      )}
    </div>
  );
};
