import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Camera, 
  ClipboardCheck, 
  Brain, 
  Eye, 
  LineChart, 
  Radio, 
  BookOpen, 
  CheckCircle2, 
  Home,
  Monitor,
  type LucideIcon
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Bridge', icon: Home },
  { to: '/scan', label: 'Camera Scan', icon: Camera },
  { to: '/checks', label: 'Checks', icon: ClipboardCheck },
  { to: '/cognition', label: 'Cognition', icon: Brain },
  { to: '/vision', label: 'Vision', icon: Eye },
  { to: '/trends', label: 'Trends', icon: LineChart },
  { to: '/groundlink', label: 'Ground Link', icon: Radio },
  { to: '/learn', label: 'Learn', icon: BookOpen },
  { to: '/validation', label: 'Validation', icon: CheckCircle2 },
  { to: '/ground', label: 'Ground Ops', icon: Monitor },
];

export const NavigationBar: React.FC = () => {
  return (
    <nav className="border-b border-white/5 bg-[#080D18]/90 backdrop-blur-md sticky top-16 z-30 overflow-x-auto no-scrollbar">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 flex items-center justify-start sm:justify-center gap-1 sm:gap-2 h-13 py-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 select-none ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_15px_-4px_rgba(56,225,255,0.4)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                }`
              }
            >
              <Icon size={15} className="shrink-0" />
              <span>{item.label}</span>
              {item.badge && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-orange-500/30 text-orange-300 border border-orange-500/40">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
