import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { db, type CrewMember, type MissionConfig } from '../data/db';
import {
  ENVIRONMENTS,
  getAutonomyLevel,
  type AutonomyLevel,
  type EnvironmentId,
  type MissionEnvironment,
} from '../config/environments';
import { seedDemoMission } from '../data/seed/demoMission';
import { computeReadinessFromReadings } from '../engine/readiness';
import { getEffectiveTaskStatus } from '../engine/scheduler';
import { buildDigitalTwinTelemetry } from '../features/bridge/digitalTwin';

interface MissionContextValue {
  crew: CrewMember | null;
  allCrew: CrewMember[];
  config: MissionConfig | null;
  environment: MissionEnvironment;
  autonomyLevel: AutonomyLevel;
  readinessScore: number;
  activeAlertCount: number;
  unreadGroundCount: number;
  isLoading: boolean;
  hasProfile: boolean;
  refreshMission: () => Promise<void>;
  updateDelay: (delaySeconds: number) => Promise<void>;
  setEnvironment: (envId: EnvironmentId) => Promise<void>;
  loadDemo: () => Promise<void>;
  resetToFresh: () => Promise<void>;
}

const MissionContext = createContext<MissionContextValue | null>(null);

export const MissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [crew, setCrew] = useState<CrewMember | null>(null);
  const [allCrew, setAllCrew] = useState<CrewMember[]>([]);
  const [config, setConfig] = useState<MissionConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [readinessScore, setReadinessScore] = useState(88);
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [unreadGroundCount, setUnreadGroundCount] = useState(1);

  const refreshMission = useCallback(async () => {
    try {
      setIsLoading(true);
      const members = await db.crewMembers.toArray();
      setAllCrew(members);

      const active = members.find((m) => m.isCurrent) || members[0] || null;
      setCrew(active);

      const savedConfig = await db.missionConfig.get('current');
      if (savedConfig) {
        // Recalculate mission day if start date is known
        if (savedConfig.missionStartDate) {
          const start = new Date(savedConfig.missionStartDate).getTime();
          const now = Date.now();
          const dayDiff = Math.max(1, Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1);
          if (dayDiff !== savedConfig.missionDay) {
            savedConfig.missionDay = dayDiff;
            await db.missionConfig.update('current', { missionDay: dayDiff });
          }
        }
        setConfig(savedConfig);
      } else {
        setConfig(null);
      }

      // Check ground unread
      const unread = await db.groundPackets.filter((p) => !p.read).count();
      setUnreadGroundCount(unread);

      // Compute accurate readiness score & active alert count from crew telemetry per §7.9
      const currentDay = savedConfig?.missionDay ?? 1;
      const currentEnv = ENVIRONMENTS[savedConfig?.environmentId || 'transit'] || ENVIRONMENTS.transit;

      const crewReadings = active?.id
        ? await db.healthReadings.where('crewMemberId').equals(active.id).toArray()
        : [];
      const crewBaselines = active?.id
        ? await db.baselines.where('crewMemberId').equals(active.id).toArray()
        : [];
      const crewTasks = active?.id
        ? await db.tasks.where('crewMemberId').equals(active.id).toArray()
        : [];

      const twin = buildDigitalTwinTelemetry({
        crew: active,
        readings: crewReadings,
        baselines: crewBaselines,
        tasks: crewTasks,
        config: savedConfig || null,
        environment: currentEnv,
      });

      const overdueTasks = crewTasks.filter(
        (t) => getEffectiveTaskStatus(t, currentDay) === 'overdue'
      );

      const readinessResult = computeReadinessFromReadings(
        twin.allLatestReadings,
        overdueTasks.map((t) => ({ title: t.title, dueDay: t.dueDay }))
      );

      setReadinessScore(readinessResult.score);
      setActiveAlertCount(
        twin.alerts.filter((a) => a.status === 'ALERT' || a.status === 'CRITICAL').length
      );
    } catch (err) {
      console.error('Failed to load mission from DB:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMission();
  }, [refreshMission]);

  const updateDelay = async (delaySeconds: number) => {
    if (!config) return;
    await db.missionConfig.update('current', {
      oneWayDelaySeconds: delaySeconds,
      updatedAt: Date.now(),
    });
    setConfig((prev) => (prev ? { ...prev, oneWayDelaySeconds: delaySeconds } : null));
  };

  const setEnvironment = async (envId: EnvironmentId) => {
    if (!config) return;
    const envMeta = ENVIRONMENTS[envId];
    const newDelay = envMeta.defaultDelaySeconds;
    await db.missionConfig.update('current', {
      environmentId: envId,
      oneWayDelaySeconds: newDelay,
      updatedAt: Date.now(),
    });
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            environmentId: envId,
            oneWayDelaySeconds: newDelay,
          }
        : null
    );
  };

  const loadDemo = async () => {
    setIsLoading(true);
    await seedDemoMission();
    await refreshMission();
    setIsLoading(false);
  };

  const resetToFresh = async () => {
    setIsLoading(true);
    await db.crewMembers.clear();
    await db.missionConfig.clear();
    await db.healthReadings.clear();
    await db.baselines.clear();
    await db.tasks.clear();
    await db.groundPackets.clear();
    await db.incidentReports.clear();
    setCrew(null);
    setAllCrew([]);
    setConfig(null);
    setIsLoading(false);
  };

  const currentEnvId = config?.environmentId || 'transit';
  const environment = ENVIRONMENTS[currentEnvId] || ENVIRONMENTS.transit;
  const currentDelay = config?.oneWayDelaySeconds ?? environment.defaultDelaySeconds;
  const autonomyLevel = getAutonomyLevel(currentDelay);
  const hasProfile = !!crew && !!config;

  return (
    <MissionContext.Provider
      value={{
        crew,
        allCrew,
        config,
        environment,
        autonomyLevel,
        readinessScore,
        activeAlertCount,
        unreadGroundCount,
        isLoading,
        hasProfile,
        refreshMission,
        updateDelay,
        setEnvironment,
        loadDemo,
        resetToFresh,
      }}
    >
      {children}
    </MissionContext.Provider>
  );
};

export const useMission = () => {
  const ctx = useContext(MissionContext);
  if (!ctx) {
    throw new Error('useMission must be used within a MissionProvider');
  }
  return ctx;
};
