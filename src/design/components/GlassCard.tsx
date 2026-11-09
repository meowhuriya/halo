import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

export interface GlassCardProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'cyan' | 'subtle' | 'interactive' | 'alert' | 'critical';
  glow?: boolean;
  padded?: boolean | 'sm' | 'md' | 'lg' | 'none';
  children: React.ReactNode;
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  variant = 'default',
  glow = false,
  padded = 'md',
  children,
  className = '',
  ...motionProps
}) => {
  const paddingMap = {
    none: '',
    sm: 'p-3 sm:p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
    true: 'p-5 sm:p-6',
    false: '',
  };

  const variantStyles = {
    default: 'bg-white/[0.04] border-white/10 text-slate-100',
    subtle: 'bg-white/[0.02] border-white/5 text-slate-200',
    cyan: 'bg-cyan-500/[0.04] border-cyan-400/25 text-slate-100 shadow-[0_0_20px_-5px_rgba(56,225,255,0.15)]',
    interactive: 'bg-white/[0.04] border-white/10 hover:border-cyan-400/40 hover:bg-white/[0.06] transition-all cursor-pointer',
    alert: 'bg-orange-500/[0.05] border-orange-500/30 text-slate-100',
    critical: 'bg-red-500/[0.08] border-red-500/40 text-slate-100 shadow-[0_0_25px_-5px_rgba(239,68,68,0.25)]',
  }[variant];

  const glowStyles = glow ? 'shadow-[0_0_25px_-5px_rgba(56,225,255,0.2)] border-cyan-400/40' : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`rounded-2xl border backdrop-blur-xl ${variantStyles} ${glowStyles} ${
        typeof padded === 'boolean' ? paddingMap[padded ? 'md' : 'none'] : paddingMap[padded]
      } ${className}`}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
};
