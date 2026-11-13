import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  FileText,
  Printer,
  Radio,
  Send,
  X,
} from 'lucide-react';
import { formatSbarPlainText, type SbarReportData } from './emergencyLogic';

interface SbarReportViewProps {
  sbar: SbarReportData;
  isPacketQueued: boolean;
  onTransmitToGround: () => Promise<void>;
  onClose: () => void;
}

export const SbarReportView: React.FC<SbarReportViewProps> = ({
  sbar,
  isPacketQueued,
  onTransmitToGround,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);

  const plainText = formatSbarPlainText(sbar);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleTransmit = async () => {
    setIsTransmitting(true);
    try {
      await onTransmitToGround();
    } finally {
      setIsTransmitting(false);
    }
  };

  return (
    <div
      data-testid="sbar-report-view"
      className="fixed inset-0 z-50 bg-black/95 text-white flex flex-col p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:text-black"
      role="dialog"
      aria-labelledby="sbar-title"
    >
      <div className="max-w-4xl w-full mx-auto space-y-5 my-auto pb-8 print:max-w-none print:w-full print:my-0">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-red-500/40 pb-4 print:border-black">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shrink-0 print:border print:border-black">
              <FileText size={22} className="text-white print:text-black" />
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-widest text-red-400 uppercase font-bold print:text-gray-600">
                CLINICAL MEDICAL INCIDENT HANDOVER
              </div>
              <h2 id="sbar-title" className="text-xl sm:text-2xl font-black tracking-wide text-white print:text-black">
                SBAR Incident Report · {sbar.id}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handleCopy}
              data-testid="sbar-copy-btn"
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
              title="Copy SBAR text to clipboard"
            >
              <Copy size={15} />
              <span>{copied ? 'COPIED!' : 'COPY TEXT'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              data-testid="sbar-print-btn"
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
              title="Print SBAR Report"
            >
              <Printer size={15} />
              <span>PRINT VIEW</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              data-testid="sbar-close-btn"
              className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md"
            >
              <X size={15} />
              <span>CLOSE TO BRIDGE</span>
            </button>
          </div>
        </div>

        {/* Transmission Status Card */}
        <div
          data-testid="sbar-transmit-status-card"
          className="p-4 rounded-2xl bg-gradient-to-r from-red-950/80 via-black to-red-950/80 border-2 border-red-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden"
        >
          <div className="flex items-center gap-3">
            <Radio size={22} className={isPacketQueued ? 'text-emerald-400' : 'text-amber-400 animate-pulse'} />
            <div>
              <div className="text-xs font-bold text-white uppercase font-mono">
                {isPacketQueued
                  ? 'High-Priority Ground Packet Queued in Outbox'
                  : 'Pending High-Priority Transmission to Earth'}
              </div>
              <div className="text-[11px] text-slate-300 font-mono">
                Downlink latency: {Math.round(sbar.oneWayDelaySeconds)} s ({Math.round(sbar.oneWayDelaySeconds * 2)} s round-trip earliest response)
              </div>
            </div>
          </div>

          {!isPacketQueued && (
            <button
              type="button"
              disabled={isTransmitting}
              onClick={handleTransmit}
              data-testid="sbar-transmit-btn"
              className="h-[48px] px-5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 text-white font-mono font-black text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.6)] border border-red-300 cursor-pointer disabled:opacity-50"
            >
              <Send size={15} />
              <span>{isTransmitting ? 'TRANSMITTING...' : 'TRANSMIT TO GROUND LINK (HIGH PRIORITY)'}</span>
            </button>
          )}

          {isPacketQueued && (
            <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40">
              <CheckCircle2 size={16} />
              <span>QUEUED FOR FLIGHT SURGEON</span>
            </span>
          )}
        </div>

        {/* SBAR Section Cards */}
        <div className="space-y-4 print:space-y-3 font-mono text-xs sm:text-sm">
          {/* [S] SITUATION */}
          <div className="p-4 sm:p-5 rounded-2xl bg-black/80 border border-red-500/40 print:border-black print:bg-white print:p-2 space-y-2">
            <div className="flex items-center gap-2 text-red-400 print:text-black font-black uppercase text-sm border-b border-white/10 pb-1.5">
              <span>[S] SITUATION</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-200 print:text-black">
              <div>
                <strong>Patient:</strong> {sbar.situation.patientName} [{sbar.situation.patientCallSign}] (Age {sbar.background.patientAge}{sbar.background.patientSex})
              </div>
              <div>
                <strong>Role:</strong> {sbar.situation.patientRole}
              </div>
              <div>
                <strong>Emergency Category:</strong> {sbar.situation.emergencyType.replace(/_/g, ' ')}
              </div>
              <div>
                <strong>Mission Day &amp; Env:</strong> Day {sbar.missionDay} · {sbar.environmentName}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 print:bg-gray-100 print:border-gray-300 text-xs text-red-100 print:text-black">
              <strong>Clinical Summary:</strong> {sbar.situation.summary}
            </div>
          </div>

          {/* [B] BACKGROUND */}
          <div className="p-4 sm:p-5 rounded-2xl bg-black/80 border border-red-500/40 print:border-black print:bg-white print:p-2 space-y-2">
            <div className="flex items-center gap-2 text-red-400 print:text-black font-black uppercase text-sm border-b border-white/10 pb-1.5">
              <span>[B] BACKGROUND</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {sbar.background.baselines.map((b) => (
                <div key={b.indicator} className="p-2 rounded bg-black/50 border border-white/10 print:border-gray-300">
                  <div className="text-[10px] text-slate-400 uppercase">{b.label} Baseline</div>
                  <div className="font-bold text-white print:text-black">{b.normal}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-300 print:text-black">
              <strong>Recent EVA Activity:</strong> {sbar.background.recentEva ? 'YES (Within past 48h - DCS Risk)' : 'No recent spacewalk'}
            </div>
            {sbar.background.recentFlags.length > 0 && (
              <div className="text-xs text-amber-200 print:text-black">
                <strong>Pre-Event Flags (Past 7 Days):</strong>
                <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[11px] text-slate-300 print:text-black">
                  {sbar.background.recentFlags.map((f, i) => (
                    <li key={i}>Day {f.day}: [{f.status}] {f.indicator} — {f.note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* [A] ASSESSMENT */}
          <div className="p-4 sm:p-5 rounded-2xl bg-black/80 border border-red-500/40 print:border-black print:bg-white print:p-2 space-y-3">
            <div className="flex items-center gap-2 text-red-400 print:text-black font-black uppercase text-sm border-b border-white/10 pb-1.5">
              <span>[A] ASSESSMENT</span>
            </div>

            {/* Red Flags Identified */}
            {sbar.assessment.redFlags.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] uppercase font-bold text-red-300 print:text-black">Active Red Flags:</span>
                <div className="space-y-1">
                  {sbar.assessment.redFlags.map((rf, i) => (
                    <div key={i} className="p-2 rounded bg-red-950/60 border border-red-500/50 print:bg-gray-100 text-xs text-red-100 print:text-black">
                      [!] {rf}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vitals Timeline */}
            {sbar.assessment.vitalsTimeline.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] uppercase font-bold text-slate-300 print:text-black">Captured Vitals Timeline:</span>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  {sbar.assessment.vitalsTimeline.map((v, i) => (
                    <div key={i} className="p-2 rounded bg-black/60 border border-white/10 flex items-center justify-between print:border-gray-300">
                      <span><strong>{v.timeOffset}</strong> · HR {v.heartRate ?? '—'} bpm · BP {v.bloodPressure ?? '—'} · SpO₂ {v.spo2 ?? '—'}%</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${v.status === 'CRITICAL' ? 'bg-red-600 text-white' : v.status === 'ALERT' ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'}`}>
                        {v.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Executed Protocol Steps */}
            {sbar.assessment.protocolStepsCompleted.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] uppercase font-bold text-slate-300 print:text-black">Protocol Actions Logged:</span>
                <div className="space-y-1 text-xs text-slate-300 print:text-black">
                  {sbar.assessment.protocolStepsCompleted.map((step, i) => (
                    <div key={i} className="p-1.5 rounded bg-black/40 border border-white/10 print:border-gray-200">
                      <strong>{step.timeOffset}</strong> · {step.step}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* [R] REQUEST */}
          <div className="p-4 sm:p-5 rounded-2xl bg-black/80 border border-red-500/40 print:border-black print:bg-white print:p-2 space-y-2">
            <div className="flex items-center gap-2 text-red-400 print:text-black font-black uppercase text-sm border-b border-white/10 pb-1.5">
              <span>[R] REQUEST</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-200 print:text-black">
              {sbar.request.immediateNeeds.map((need, i) => (
                <div key={i} className="p-2 rounded bg-red-950/30 border border-red-500/30 print:bg-gray-100 flex items-start gap-2">
                  <span className="text-red-400 font-bold">{i + 1}.</span>
                  <span>{need}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-300 print:text-black pt-1">
              <strong>Follow-up Strategy:</strong> {sbar.request.flightSurgeonAction}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
