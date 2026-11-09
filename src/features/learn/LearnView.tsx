import React, { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { GlassCard } from '../../design/components/GlassCard';

interface LearnArticle {
  id: string;
  hazard: string;
  title: string;
  summary: string;
  spaceflightEffect: string;
  countermeasures: string;
  whenToAlert: string;
}

const NASA_HAZARDS: LearnArticle[] = [
  {
    id: 'radiation',
    hazard: 'Space Radiation',
    title: 'Galactic Cosmic Rays & Solar Particle Events',
    summary: 'High-energy protons and atomic nuclei penetrate vehicle shielding, causing ionization in living tissue.',
    spaceflightEffect: 'Chronic micro-damage increases lifetime cancer morbidity and acute SPE doses pose radiation sickness risks.',
    countermeasures: 'Internal habitat storm shelter, personal dosimeter tracking, hydration, and medical antioxidants.',
    whenToAlert: 'Alert flight surgeon when cumulative career dose reaches 80% (480 mSv) or upon acute high-flux alarm.',
  },
  {
    id: 'isolation',
    hazard: 'Isolation & Confinement',
    title: 'Behavioral Health & Circadian Drift',
    summary: 'Prolonged sensory deprivation and confinement with small crew groups thousands of miles from Earth.',
    spaceflightEffect: 'Sleep architecture degradation, cognitive fatigue, mood blunting, and social friction.',
    countermeasures: 'Daily sleep logs, weekly PHQ-2/GAD-2 screens, routine crew conferences, and Earth family uplink audio.',
    whenToAlert: 'PHQ-2 or GAD-2 score ≥ 3, persistent sleep < 6h for 3+ consecutive days, or mood withdrawal.',
  },
  {
    id: 'distance',
    hazard: 'Distance from Earth',
    title: 'Communication Blackouts & Autonomy',
    summary: 'Mars distance introduces up to 22 minutes one-way speed-of-light comm delay (44 min round-trip).',
    spaceflightEffect: 'No real-time Earth medical consultation is possible during critical resuscitation or surgical events.',
    countermeasures: 'HALO autonomous on-device diagnostic algorithms, offline voice-guided CPR, and CMO leadership.',
    whenToAlert: 'Any CRITICAL vital status flag or unresponsive medical situation requires immediate protocol execution.',
  },
  {
    id: 'gravity',
    hazard: 'Gravity Fields',
    title: 'Microgravity & Orthostatic Intolerance',
    summary: 'Transitioning between 1g, 0g, 0.166g (Moon), and 0.38g (Mars) alters cardiovascular hydrostatics.',
    spaceflightEffect: 'Headward fluid shift causes nasal congestion, "puffy face", baroreceptor reset, and landing syncope.',
    countermeasures: 'Amsler grid for SANS visual check, orthostatic stand test, fluid loading, and daily resistance exercise.',
    whenToAlert: 'Post-standing systolic drop ≥ 20 mmHg or HR rise ≥ 30 bpm, or new visual distortion on Amsler grid.',
  },
  {
    id: 'environment',
    hazard: 'Hostile Closed Environment',
    title: 'Cabin Atmosphere & Microbial Flora',
    summary: 'Living inside a hermetically sealed aluminum pressure vessel with recycled air and water.',
    spaceflightEffect: 'Elevated ambient CO₂ levels cause headaches and lethargy; microbiome changes alter immune defenses.',
    countermeasures: 'Continuous air quality scrubbing, SpO₂ pulse oximetry, surface sanitization, and nutrition logs.',
    whenToAlert: 'SpO₂ ≤ 92%, acute respiratory distress, or localized air contamination alarm.',
  },
];

export const LearnView: React.FC = () => {
  const [search, setSearch] = useState('');

  const filtered = NASA_HAZARDS.filter(
    (h) =>
      h.title.toLowerCase().includes(search.toLowerCase()) ||
      h.hazard.toLowerCase().includes(search.toLowerCase()) ||
      h.summary.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <BookOpen size={16} className="text-cyan-400" />
            <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase">
              NASA HUMAN RESEARCH PROGRAM (HRP)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Spaceflight Medical &amp; Hazards Library
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            The 5 Hazards of Human Spaceflight. Plain-language operational guidance (≤ 120 words per topic).
          </p>
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search hazards & vitals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* Hazards Cards Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filtered.map((item) => (
          <GlassCard key={item.id} variant="default" padded="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold uppercase">
                {item.hazard}
              </span>
              <span className="text-[11px] font-mono text-slate-400">NASA HRP Reference</span>
            </div>

            <h3 className="text-lg font-bold text-white">{item.title}</h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              {item.summary}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="font-semibold text-slate-200 block text-[11px]">Spaceflight Adaptation:</span>
                <p className="text-[11px] text-slate-400 leading-normal">{item.spaceflightEffect}</p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="font-semibold text-cyan-300 block text-[11px]">Primary Countermeasures:</span>
                <p className="text-[11px] text-slate-400 leading-normal">{item.countermeasures}</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs text-amber-200/90 font-medium">
              <strong>When to notify CMO / Flight Surgeon:</strong> {item.whenToAlert}
            </div>
          </GlassCard>
        ))}
      </div>

    </div>
  );
};
