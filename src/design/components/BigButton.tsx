import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

export interface BigButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass';
  size?: 'md' | 'lg' | 'xl';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export const BigButton: React.FC<BigButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  fullWidth = false,
  children,
  className = '',
  disabled = false,
  ...props
}) => {
  // Glove-friendly minimum tap height is 56px across all sizes
  const sizeStyles = {
    md: 'min-h-[56px] px-6 py-3.5 text-base font-semibold',
    lg: 'min-h-[64px] px-8 py-4 text-lg font-bold',
    xl: 'min-h-[72px] px-10 py-5 text-xl font-extrabold',
  }[size];

  const variantStyles = {
    primary:
      'bg-cyan-400 text-slate-950 hover:bg-cyan-300 active:bg-cyan-200 shadow-[0_0_25px_-4px_rgba(115, 179, 231,0.4)] border border-cyan-300/60',
    secondary:
      'bg-white/10 text-slate-100 hover:bg-white/15 active:bg-white/20 border border-white/20 backdrop-blur-md shadow-lg',
    glass:
      'bg-white/[0.05] text-slate-200 hover:text-white hover:bg-white/[0.1] hover:border-cyan-400/40 active:bg-white/15 border border-white/10 backdrop-blur-xl',
    danger:
      'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 shadow-[0_0_30px_-4px_rgba(239,68,68,0.5)] border border-red-400/50',
    ghost:
      'bg-transparent text-slate-300 hover:text-white hover:bg-white/5 active:bg-white/10 border border-transparent',
  }[variant];

  const disabledStyles = disabled
    ? 'opacity-40 cursor-not-allowed pointer-events-none filter grayscale'
    : 'cursor-pointer active:scale-[0.98]';

  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12 }}
      disabled={disabled}
      className={`relative inline-flex items-center justify-center gap-3 rounded-2xl select-none transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1628] ${sizeStyles} ${variantStyles} ${disabledStyles} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...props}
    >
      {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
      <span className="tracking-wide text-center">{children}</span>
      {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
    </motion.button>
  );
};
