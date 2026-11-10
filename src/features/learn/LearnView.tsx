import React, { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  ShieldAlert, 
  Activity, 
  Info, 
  AlertTriangle, 
  CheckCircle2, 
  Gauge, 
  X
} from 'lucide-react';
import { GlassCard } from '../../design/components/GlassCard';
import { LEARN_LIBRARY, type LearnTopic } from '../../config/learnLibrary';

type CategoryFilter = 'all' | 'vital' | 'hazard';

export const LearnView: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [selectedTopic, setSelectedTopic] = useState<LearnTopic | null>(null);

  const filteredTopics = LEARN_LIBRARY.filter((topic) => {
    const matchesFilter = filter === 'all' || topic.category === filter;
    if (!matchesFilter) return false;

    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return (
      topic.title.toLowerCase().includes(query) ||
      topic.badge.toLowerCase().includes(query) ||
      topic.whatItIs.toLowerCase().includes(query) ||
      topic.whyInSpace.toLowerCase().includes(query) ||
      topic.howToMeasure.toLowerCase().includes(query) ||
      topic.normalRange.toLowerCase().includes(query) ||
      topic.whenToAlertCmo.toLowerCase().includes(query)
    );
  });

  const vitalsCount = LEARN_LIBRARY.filter((t) => t.category === 'vital').length;
  const hazardsCount = LEARN_LIBRARY.filter((t) => t.category === 'hazard').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <BookOpen size={16} className="text-cyan-400" />
            <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase">
              NASA HUMAN RESEARCH PROGRAM · CLINICAL COMPENDIUM
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Spaceflight Medical &amp; Hazards Library
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Operational reference for astronauts. All 11 biometric indicators and the 5 Hazards of Human Spaceflight.
          </p>
        </div>

        {/* Search */}
        <div className="relative min-w-[280px]">
          <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search vitals, hazards, symptoms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
            filter === 'all'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-950/40'
              : 'bg-white/[0.03] text-slate-400 border border-white/5 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <span>All Topics</span>
          <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] font-mono">
            {LEARN_LIBRARY.length}
          </span>
        </button>

        <button
          onClick={() => setFilter('vital')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
            filter === 'vital'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-950/40'
              : 'bg-white/[0.03] text-slate-400 border border-white/5 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <Activity size={14} />
          <span>Vitals &amp; Biometrics</span>
          <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] font-mono">
            {vitalsCount}
          </span>
        </button>

        <button
          onClick={() => setFilter('hazard')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
            filter === 'hazard'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-950/40'
              : 'bg-white/[0.03] text-slate-400 border border-white/5 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <ShieldAlert size={14} />
          <span>The 5 Space Hazards</span>
          <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] font-mono">
            {hazardsCount}
          </span>
        </button>
      </div>

      {/* Topics Grid */}
      {filteredTopics.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white/[0.02] border border-white/10">
          <Info size={32} className="mx-auto text-slate-500 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No topics found</h3>
          <p className="text-xs text-slate-400">
            No library articles matched &quot;{search}&quot;. Try searching for &quot;blood pressure&quot;, &quot;radiation&quot;, or &quot;SANS&quot;.
          </p>
          <button
            onClick={() => {
              setSearch('');
              setFilter('all');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-white/10 text-xs font-semibold text-white hover:bg-white/20"
          >
            Reset Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTopics.map((topic) => (
            <GlassCard
              key={topic.id}
              variant="default"
              padded="md"
              className="flex flex-col justify-between hover:border-cyan-400/40 transition-all cursor-pointer group"
              onClick={() => setSelectedTopic(topic)}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${
                      topic.category === 'vital'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {topic.badge}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 group-hover:text-cyan-300 transition-colors">
                    Click to expand details →
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-cyan-200 transition-colors">
                  {topic.title}
                </h3>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-0.5">
                      What It Is:
                    </span>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      {topic.whatItIs}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 block mb-0.5">
                      Why It Changes In Space:
                    </span>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      {topic.whyInSpace}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Reference */}
              <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  <span className="text-[11px] font-mono truncate">
                    <strong className="text-white">Normal:</strong> {topic.normalRange}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-amber-300/90">
                  <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                  <span className="text-[11px] font-mono truncate">
                    <strong className="text-amber-200">Alert CMO:</strong> {topic.whenToAlertCmo}
                  </span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Expanded Modal */}
      {selectedTopic && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedTopic(null)}
        >
          <div
            className="w-full max-w-2xl bg-[#090D18] border border-cyan-500/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl shadow-cyan-950/60 overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <span
                  className={`text-[11px] font-mono px-2.5 py-0.5 rounded border uppercase tracking-wider mb-2 inline-block ${
                    selectedTopic.category === 'vital'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {selectedTopic.badge}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  {selectedTopic.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedTopic(null)}
                className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </div>

            {/* Structured Fields */}
            <div className="space-y-4 text-xs sm:text-sm">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 uppercase tracking-wider">
                  <Info size={14} />
                  <span>1. What It Is</span>
                </div>
                <p className="text-slate-200 leading-relaxed pt-1">
                  {selectedTopic.whatItIs}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 uppercase tracking-wider">
                  <Gauge size={14} />
                  <span>2. Why It Changes In Space</span>
                </div>
                <p className="text-slate-200 leading-relaxed pt-1">
                  {selectedTopic.whyInSpace}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 uppercase tracking-wider">
                  <Activity size={14} />
                  <span>3. How To Measure It Here</span>
                </div>
                <p className="text-slate-200 leading-relaxed pt-1">
                  {selectedTopic.howToMeasure}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 uppercase tracking-wider">
                  <CheckCircle2 size={14} />
                  <span>4. Clinical Normal Range</span>
                </div>
                <p className="text-emerald-100 font-mono text-xs leading-relaxed pt-1">
                  {selectedTopic.normalRange}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-mono text-amber-400 uppercase tracking-wider">
                  <AlertTriangle size={14} />
                  <span>5. When To Alert CMO / Flight Surgeon</span>
                </div>
                <p className="text-amber-100 text-xs leading-relaxed pt-1">
                  {selectedTopic.whenToAlertCmo}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedTopic(null)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-cyan-500 text-black font-bold text-xs uppercase tracking-wider hover:bg-cyan-400 transition-colors min-h-[48px]"
              >
                Close Reference
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
