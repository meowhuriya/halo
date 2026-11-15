/**
 * Validation page (§7.16): paired HALO camera heart rate vs a reference device.
 * Every number on this page comes from readings the team logged — nothing is pre-filled.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Trash2, FlaskConical } from 'lucide-react';
import { db, type ValidationLog } from '../../data/db';
import { computeValidationStats, toCsv } from './validationStats';

const EMPTY: Omit<ValidationLog, 'id' | 'timestamp'> = {
  method: 'fingertip', appBpm: 0, referenceBpm: 0, referenceDevice: 'counted wrist pulse (30 s × 2)',
  lighting: '', fitzpatrick: '', motion: 'still', notes: '',
};

export const ValidationView: React.FC = () => {
  const [logs, setLogs] = useState<ValidationLog[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [filter, setFilter] = useState<'all' | 'fingertip' | 'face'>('all');

  const reload = async () => setLogs((await db.validationLogs.toArray()).sort((a, b) => a.timestamp - b.timestamp));
  useEffect(() => { void reload(); }, []);

  const shown = useMemo(() => logs.filter((l) => filter === 'all' || l.method === filter), [logs, filter]);
  const stats = useMemo(() => computeValidationStats(shown), [shown]);

  const add = async () => {
    if (!(form.appBpm > 20 && form.appBpm < 250 && form.referenceBpm > 20 && form.referenceBpm < 250)) return;
    await db.validationLogs.add({ ...form, timestamp: Date.now() });
    setForm({ ...EMPTY, method: form.method, referenceDevice: form.referenceDevice, lighting: form.lighting, fitzpatrick: form.fitzpatrick });
    await reload();
  };
  const remove = async (id?: number) => { if (id != null) { await db.validationLogs.delete(id); await reload(); } };

  const exportCsv = () => {
    const csv = toCsv(logs.map((l) => ({
      timestamp: new Date(l.timestamp).toISOString(), method: l.method, app_bpm: l.appBpm, reference_bpm: l.referenceBpm,
      error_bpm: l.appBpm - l.referenceBpm, reference_device: l.referenceDevice, lighting: l.lighting ?? '',
      fitzpatrick: l.fitzpatrick ?? '', motion: l.motion ?? '', notes: l.notes ?? '',
    })));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'halo-validation.csv';
    a.click();
  };

  const num = (v: string) => (v === '' ? 0 : Number(v));
  const fmt = (v: number, d = 2) => (stats.n ? v.toFixed(d) : '—');

  // Bland-Altman plot geometry
  const W = 560, H = 220, PAD = 36;
  const means = shown.map((p) => (p.appBpm + p.referenceBpm) / 2);
  const diffs = shown.map((p) => p.appBpm - p.referenceBpm);
  const xMin = means.length ? Math.min(...means) - 5 : 40, xMax = means.length ? Math.max(...means) + 5 : 160;
  const yAbs = Math.max(10, ...diffs.map(Math.abs), Math.abs(stats.loaLow), Math.abs(stats.loaHigh)) + 2;
  const sx = (x: number) => PAD + ((x - xMin) / (xMax - xMin || 1)) * (W - 2 * PAD);
  const sy = (y: number) => H / 2 - (y / yAbs) * (H / 2 - PAD / 2);

  return (
    <div className="space-y-6" data-testid="validation-page">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-widest text-cyan-300/80 flex items-center gap-2"><FlaskConical size={12} /> Clinical evidence · §7.16</div>
          <h1 className="text-2xl font-bold text-white mt-1">Camera heart-rate validation</h1>
          <p className="text-sm text-slate-300 max-w-2xl mt-1">Paired readings: HALO's camera BPM against a reference at the same moment. MAE, RMSE, % within ±5 bpm and a Bland-Altman plot are computed from what the team logged. <span className="text-amber-300">No readings are pre-filled.</span></p>
        </div>
        <button type="button" onClick={exportCsv} disabled={!logs.length} className="min-h-[56px] px-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-sm font-semibold flex items-center gap-2"><Download size={16} /> Export CSV</button>
      </header>

      <div className="flex gap-2 text-xs font-mono">
        {(['all', 'fingertip', 'face'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`min-h-[44px] px-4 rounded-lg border ${filter === f ? 'bg-cyan-500/20 border-cyan-400 text-white' : 'border-white/10 text-slate-300'}`}>{f.toUpperCase()}</button>
        ))}
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Readings (n)', String(stats.n), ''],
          ['Mean absolute error', fmt(stats.mae), 'bpm'],
          ['Within ±5 bpm', stats.n ? stats.within5Pct.toFixed(0) : '—', '%'],
          ['RMSE', fmt(stats.rmse), 'bpm'],
        ].map(([label, value, unit]) => (
          <div key={label} className="glass-panel rounded-2xl p-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">{label}</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">{value} <span className="text-sm text-slate-400">{unit}</span></div>
          </div>
        ))}
      </section>

      <section className="glass-panel rounded-2xl p-4 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2"><Plus size={16} /> Log a paired reading</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
          <label className="flex flex-col gap-1"><span className="text-xs text-slate-400">Method</span>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as ValidationLog['method'] })} className="min-h-[48px] rounded-lg bg-black/40 border border-white/15 px-3">
              <option value="fingertip">Fingertip</option><option value="face">Face (experimental)</option>
            </select></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-slate-400">HALO bpm</span>
            <input type="number" inputMode="numeric" value={form.appBpm || ''} onChange={(e) => setForm({ ...form, appBpm: num(e.target.value) })} className="min-h-[48px] rounded-lg bg-black/40 border border-white/15 px-3 font-mono" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-slate-400">Reference bpm</span>
            <input type="number" inputMode="numeric" value={form.referenceBpm || ''} onChange={(e) => setForm({ ...form, referenceBpm: num(e.target.value) })} className="min-h-[48px] rounded-lg bg-black/40 border border-white/15 px-3 font-mono" /></label>
          <label className="flex flex-col gap-1 md:col-span-2"><span className="text-xs text-slate-400">Reference device</span>
            <input value={form.referenceDevice} onChange={(e) => setForm({ ...form, referenceDevice: e.target.value })} className="min-h-[48px] rounded-lg bg-black/40 border border-white/15 px-3" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-slate-400">Motion</span>
            <select value={form.motion} onChange={(e) => setForm({ ...form, motion: e.target.value as ValidationLog['motion'] })} className="min-h-[48px] rounded-lg bg-black/40 border border-white/15 px-3">
              <option value="still">Still</option><option value="some">Some</option><option value="moving">Moving</option>
            </select></label>
          <label className="flex flex-col gap-1 md:col-span-2"><span className="text-xs text-slate-400">Lighting (optional)</span>
            <input value={form.lighting} onChange={(e) => setForm({ ...form, lighting: e.target.value })} placeholder="e.g. window daylight, dim lamp" className="min-h-[48px] rounded-lg bg-black/40 border border-white/15 px-3" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-slate-400">Skin tone (opt.)</span>
            <select value={form.fitzpatrick} onChange={(e) => setForm({ ...form, fitzpatrick: e.target.value as ValidationLog['fitzpatrick'] })} className="min-h-[48px] rounded-lg bg-black/40 border border-white/15 px-3">
              <option value="">—</option>{['I', 'II', 'III', 'IV', 'V', 'VI'].map((t) => <option key={t} value={t}>Fitzpatrick {t}</option>)}
            </select></label>
          <label className="flex flex-col gap-1 md:col-span-2"><span className="text-xs text-slate-400">Notes (optional)</span>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-[48px] rounded-lg bg-black/40 border border-white/15 px-3" /></label>
          <div className="flex items-end"><button type="button" onClick={() => void add()} className="min-h-[48px] w-full rounded-lg bg-cyan-500 text-[#0B1628] font-bold hover:bg-cyan-400">Add</button></div>
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-bold text-white mb-2">Bland-Altman plot <span className="text-xs font-normal text-slate-400">(difference vs mean; dashed lines = bias ± 1.96 SD)</span></h2>
        {shown.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center">Log at least one paired reading to draw the plot.</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Bland-Altman plot">
            <line x1={PAD} x2={W - PAD} y1={sy(0)} y2={sy(0)} stroke="rgba(255,255,255,0.35)" />
            <line x1={PAD} x2={W - PAD} y1={sy(stats.meanBias)} y2={sy(stats.meanBias)} stroke="#73B3E7" strokeDasharray="4 3" />
            <line x1={PAD} x2={W - PAD} y1={sy(stats.loaHigh)} y2={sy(stats.loaHigh)} stroke="#F59E0B" strokeDasharray="4 3" />
            <line x1={PAD} x2={W - PAD} y1={sy(stats.loaLow)} y2={sy(stats.loaLow)} stroke="#F59E0B" strokeDasharray="4 3" />
            {shown.map((p, i) => (
              <circle key={i} cx={sx(means[i])} cy={sy(diffs[i])} r={5} fill={Math.abs(diffs[i]) <= 5 ? '#22C55E' : '#F97316'} stroke="#0B1628" />
            ))}
            <text x={PAD} y={H - 6} fill="#94A3B8" fontSize="10" fontFamily="monospace">mean of HALO & reference (bpm) →</text>
            <text x={6} y={12} fill="#94A3B8" fontSize="10" fontFamily="monospace">HALO − reference (bpm) ↑</text>
            <text x={W - PAD} y={sy(stats.meanBias) - 4} fill="#73B3E7" fontSize="10" fontFamily="monospace" textAnchor="end">bias {stats.meanBias.toFixed(1)}</text>
          </svg>
        )}
      </section>

      <section className="glass-panel rounded-2xl p-4 overflow-x-auto">
        <h2 className="text-sm font-bold text-white mb-2">Paired readings</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No readings logged yet.</p>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead className="text-slate-400 text-left"><tr><th className="py-2 px-2">#</th><th className="py-2 px-2">Method</th><th className="py-2 px-2">HALO</th><th className="py-2 px-2">Reference</th><th className="py-2 px-2">Δ</th><th className="py-2 px-2">Device</th><th className="py-2 px-2">Lighting</th><th className="py-2 px-2">Skin</th><th className="py-2 px-2"></th></tr></thead>
            <tbody>
              {shown.map((l, i) => {
                const d = l.appBpm - l.referenceBpm;
                return (
                  <tr key={l.id} className="border-t border-white/10">
                    <td className="py-2 px-2 text-slate-400">{i + 1}</td>
                    <td className="py-2 px-2">{l.method}</td>
                    <td className="py-2 px-2 text-cyan-300">{l.appBpm}</td>
                    <td className="py-2 px-2">{l.referenceBpm}</td>
                    <td className={`py-2 px-2 ${Math.abs(d) <= 5 ? 'text-emerald-400' : 'text-orange-400'}`}>{d > 0 ? '+' : ''}{d}</td>
                    <td className="py-2 px-2 text-slate-300">{l.referenceDevice}</td>
                    <td className="py-2 px-2 text-slate-400">{l.lighting || '—'}</td>
                    <td className="py-2 px-2 text-slate-400">{l.fitzpatrick || '—'}</td>
                    <td className="py-2 px-2"><button type="button" aria-label="Delete reading" onClick={() => void remove(l.id)} className="min-h-[36px] min-w-[36px] text-slate-500 hover:text-red-400"><Trash2 size={14} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default ValidationView;
