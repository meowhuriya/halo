import { Check, Eye, AlertTriangle, Octagon } from 'lucide-react';
import React from 'react';
import type { HealthStatus } from '../data/db';

export const COLORS = {
  bg: '#0B1628',
  surface: '#0B111E',
  glassFill: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(255, 255, 255, 0.10)',
  glassBorderHover: 'rgba(115, 179, 231, 0.35)',
  cyan: '#73B3E7',
  cyanGlow: 'rgba(115, 179, 231, 0.25)',
  nominal: '#22C55E',
  watch: '#F59E0B',
  alert: '#F97316',
  critical: '#EF4444',
} as const;

export interface StatusMeta {
  label: HealthStatus;
  color: string;
  bgColor: string;
  borderColor: string;
  pulseClass?: string;
  icon: React.ComponentType<{ className?: string; size?: number | string }>;
  description: string;
}

export const STATUS_MAP: Record<HealthStatus, StatusMeta> = {
  NOMINAL: {
    label: 'NOMINAL',
    color: '#22C55E',
    bgColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.35)',
    icon: Check,
    description: 'Values within healthy clinical limits and aligned with pre-flight baseline.',
  },
  WATCH: {
    label: 'WATCH',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.40)',
    icon: Eye,
    description: 'Borderline reading or statistical divergence from your personal baseline.',
  },
  ALERT: {
    label: 'ALERT',
    color: '#F97316',
    bgColor: 'rgba(249, 115, 22, 0.15)',
    borderColor: 'rgba(249, 115, 22, 0.50)',
    icon: AlertTriangle,
    description: 'Clinical threshold exceeded or pronounced adverse trend detected.',
  },
  CRITICAL: {
    label: 'CRITICAL',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.20)',
    borderColor: 'rgba(239, 68, 68, 0.65)',
    pulseClass: 'animate-pulse',
    icon: Octagon,
    description: 'Immediate risk threshold. Requires immediate intervention or rest protocol.',
  },
};
