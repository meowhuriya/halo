import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMission } from '../../app/MissionContext';
import { db, type CrewMember, type PersonalBaseline } from '../../data/db';
import { getLocalVoice, speakOffline } from '../../utils/speech';
import { createVoiceListener, isVoiceCommandSupported, matchIntent, type VoiceListener } from '../../utils/voiceCommands';
import { CprCoachProtocol } from './CprCoachProtocol';
import { ChestPainProtocol } from './ChestPainProtocol';
import { DecisionClockBar } from './DecisionClockBar';
import {
  buildSbarReport,
  type EmergencyType,
  type SbarReportData,
  type VitalsSnapshot,
} from './emergencyLogic';
import { PatientSelectStep } from './PatientSelectStep';
import { RadiationStormProtocol } from './RadiationStormProtocol';
import { SbarReportView } from './SbarReportView';
import { SpeechCaptionBanner } from './SpeechCaptionBanner';
import { ToxicBreathingProtocol } from './ToxicBreathingProtocol';
import { TriageStep } from './TriageStep';

type FlowStage = 'PATIENT_SELECT' | 'TRIAGE' | 'PROTOCOL' | 'SBAR';

export const EmergencyView: React.FC = () => {
  const navigate = useNavigate();
  const { crew, allCrew, config, environment } = useMission();

  // Navigation & Flow state
  const [stage, setStage] = useState<FlowStage>('PATIENT_SELECT');
  const [activeEmergencyType, setActiveEmergencyType] = useState<EmergencyType>('CPR');

  // Emergency Session Timing
  const [startedAt] = useState<number>(Date.now());
  const oneWayDelaySeconds = config?.oneWayDelaySeconds ?? environment.defaultDelaySeconds;
  const missionDay = config?.missionDay ?? 1;
  const [searchParams] = useSearchParams();
  const isSimulatedTour = searchParams.get('simulated') === 'true';

  // Patient & Medical Record Data
  const [patient, setPatient] = useState<CrewMember | null>(crew || allCrew[0] || null);
  const [patientBaselines, setPatientBaselines] = useState<PersonalBaseline[]>([]);

  // Hook for Judge Mode Step 5: simulated crewmate chest pain / CPR coach preview
  useEffect(() => {
    if (isSimulatedTour && allCrew.length > 1) {
      const crewmate = allCrew.find((c) => !c.isCurrent) || allCrew[1];
      setPatient(crewmate);
      setStage('PROTOCOL');
      setActiveEmergencyType('CPR');
    }
  }, [isSimulatedTour, allCrew]);

  // Protocol Execution Log & Telemetry Timeline
  const [protocolSteps, setProtocolSteps] = useState<Array<{ timestamp: number; step: string }>>([]);
  const [capturedVitals, setCapturedVitals] = useState<VitalsSnapshot[]>([]);

  // SBAR Report & Outbox State
  const [sbarData, setSbarData] = useState<SbarReportData | null>(null);
  const [isPacketQueued, setIsPacketQueued] = useState(false);

  // Audio Speech & Captions State
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasLocalVoice, setHasLocalVoice] = useState(false);
  const [currentCaption, setCurrentCaption] = useState(
    'HALO Emergency Medical Rescue activated. Step zero: Who needs help?'
  );

  const lastSpokenRef = useRef(currentCaption);

  // Hands-free voice commands (Chrome/Edge). Buttons always remain available.
  const voiceSupported = isVoiceCommandSupported();
  const [voiceCommandsOn, setVoiceCommandsOn] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [heardText, setHeardText] = useState('');
  const listenerRef = useRef<VoiceListener | null>(null);
  const stageRef = useRef(stage);
  const patientRef = useRef(patient);
  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { patientRef.current = patient; }, [patient]);

  // Load local voice capability on mount per §3 (v3)
  useEffect(() => {
    const voice = getLocalVoice();
    setHasLocalVoice(Boolean(voice?.localService));
  }, []);

  // Load active patient baselines whenever patient selection changes
  useEffect(() => {
    if (!patient?.id) return;
    void db.baselines
      .where('crewMemberId')
      .equals(patient.id)
      .toArray()
      .then((records) => {
        setPatientBaselines(records);
      });
  }, [patient?.id]);

  // Voice utterance handler with offline local voice fallback per §3 & §7.11
  const speak = useCallback(
    (text: string) => {
      setCurrentCaption(text);
      lastSpokenRef.current = text;
      if (isMuted) return;

      setIsSpeaking(true);
      listenerRef.current?.stop();
      const resume = () => {
        setIsSpeaking(false);
        if (voiceCommandsOn) listenerRef.current?.start();
      };
      speakOffline(text, {
        onStart: () => setIsSpeaking(true),
        onEnd: resume,
        onError: resume,
      });
    },
    [isMuted, voiceCommandsOn]
  );

  // Speak initial prompt on stage transitions
  useEffect(() => {
    if (stage === 'PATIENT_SELECT') {
      speak('HALO Emergency Mode active. Step zero: Who needs emergency medical help?');
    } else if (stage === 'TRIAGE') {
      const patientName = patient ? patient.name : 'the crew member';
      speak(`Is ${patientName} responsive and breathing normally? Check verbal call and chest rise.`);
    }
  }, [stage, patient, speak]);

  const handleRepeatVoice = () => {
    speak(lastSpokenRef.current);
  };

  const handleLogProtocolStep = useCallback((step: string) => {
    setProtocolSteps((prev) => [...prev, { timestamp: Date.now(), step }]);
  }, []);

  const handleRecordVitals = useCallback((snapshot: VitalsSnapshot) => {
    setCapturedVitals((prev) => [...prev, snapshot]);
  }, []);

  // ---- Voice intent router: the spoken equivalent of pressing a button ----
  const handlersRef = useRef<{ confirm: () => void; unresponsive: () => void; conscious: (t: EmergencyType) => void }>({
    confirm: () => {}, unresponsive: () => {}, conscious: () => {},
  });

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setHeardText(transcript);
    const intent = matchIntent(transcript);
    if (!intent) return;
    const st = stageRef.current;
    const who = patientRef.current?.name ?? 'the patient';

    if (intent === 'REPEAT') { speak(lastSpokenRef.current); return; }

    if (st === 'PATIENT_SELECT') {
      if (intent === 'ME') { if (crew) setPatient(crew); speak('Understood, you need help. Confirming.'); setTimeout(() => handlersRef.current.confirm(), 900); }
      else if (intent === 'CREWMATE') { speak('Okay. Tap the crewmate who needs help, or say their first name.'); }
      else if (intent === 'CONFIRM' || intent === 'YES' || intent === 'NEXT') { handlersRef.current.confirm(); }
      else {
        const named = allCrew.find((c) => transcript.toLowerCase().includes(c.name.split(' ').pop()!.toLowerCase()) || transcript.toLowerCase().includes(c.name.split(' ')[0].toLowerCase()));
        if (named) { setPatient(named); speak(`Got it, ${named.name}. Confirming.`); setTimeout(() => handlersRef.current.confirm(), 900); }
      }
      return;
    }

    if (st === 'TRIAGE') {
      if (intent === 'NO') { speak(`Understood. ${who} is unresponsive. Starting CPR coach now. Call the crew and get the AED.`); setTimeout(() => handlersRef.current.unresponsive(), 1200); }
      else if (intent === 'CHEST_PAIN') { speak('Chest pain. Keep them still and at rest. Opening the chest pain protocol.'); setTimeout(() => handlersRef.current.conscious('CHEST_PAIN'), 1000); }
      else if (intent === 'BREATHING') { speak('Breathing trouble. Masks on first. Opening the toxic atmosphere protocol.'); setTimeout(() => handlersRef.current.conscious('TOXIC_BREATHING'), 1000); }
      else if (intent === 'RADIATION') { speak('Radiation storm. Opening the shelter protocol.'); setTimeout(() => handlersRef.current.conscious('SOLAR_STORM'), 1000); }
      else if (intent === 'YES') { speak(`Good, ${who} is conscious. What is the main problem: chest pain, breathing trouble, or a radiation storm?`); }
      return;
    }

    if (st === 'PROTOCOL') {
      const lower = transcript.toLowerCase();
      const metro = document.querySelector<HTMLButtonElement>('[data-voice="metronome"]');
      if (metro && /\b(start|stop|pause|metronome|compressions|beat)\b/.test(lower)) {
        metro.click();
        speak(/\b(stop|pause)\b/.test(lower) ? 'Metronome stopped.' : 'Metronome running. Push hard, push fast, to the beat.');
        return;
      }
      if (intent === 'NEXT' || intent === 'YES' || intent === 'CONFIRM') speak('Okay. Keep going. Say repeat if you need the instruction again.');
    }
  }, [speak, crew, allCrew]);

  // Start/stop the listener when the user toggles voice commands
  useEffect(() => {
    if (!voiceSupported) return;
    if (voiceCommandsOn) {
      if (!listenerRef.current) listenerRef.current = createVoiceListener(handleVoiceTranscript, setIsListening);
      if (!isSpeaking) listenerRef.current?.start();
      speak('Voice commands on. You can answer me by speaking.');
    } else {
      listenerRef.current?.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceCommandsOn]);

  useEffect(() => () => { listenerRef.current?.stop(); }, []);

  // Step 0 confirmation -> go to Triage
  const handleConfirmPatient = () => {
    if (!patient) return;
    setStage('TRIAGE');
    handleLogProtocolStep(`Patient confirmed: ${patient.name} [${patient.callSign}] (${patient.role}).`);
  };

  // Triage Question 1 -> Unresponsive -> Protocol 1 (CPR)
  const handleSelectUnresponsive = () => {
    setActiveEmergencyType('CPR');
    setStage('PROTOCOL');
    handleLogProtocolStep('Triage: Patient unresponsive with absent normal breathing. CPR protocol initiated.');
    speak('Patient is unresponsive. Call crew and CMO immediately. Initiate microgravity CPR metronome at 110 beats per minute.');
  };

  // Triage Question 1 -> Conscious -> Choose protocol
  const handleSelectConsciousProtocol = (type: EmergencyType) => {
    setActiveEmergencyType(type);
    setStage('PROTOCOL');
    handleLogProtocolStep(`Triage: Conscious emergency protocol ${type} selected.`);
    if (type === 'CHEST_PAIN') {
      speak('Conscious patient reporting chest pain. Begin acute coronary and decompression screening.');
    } else if (type === 'TOXIC_BREATHING') {
      speak('Toxic atmosphere or smoke reported. Don emergency oxygen masks immediately and evacuate module.');
    } else if (type === 'SOLAR_STORM') {
      speak('Solar Particle Event radiation alert. Move entire crew to the core storm shelter immediately.');
    }
  };

  // Generate SBAR incident report per §7.11
  const handleGenerateSbarAndExit = useCallback(async () => {
    if (!patient) {
      navigate('/');
      return;
    }

    const summaryMap: Record<EmergencyType, string> = {
      CPR: 'Cardiac arrest / unresponsive crewmember. 110/min CPR metronome and AED staging conducted.',
      CHEST_PAIN: 'Acute chest pain triage. Red-flag coronary and decompression screening performed.',
      TOXIC_BREATHING: 'Toxic atmosphere / smoke inhalation event. Mask donned and compartment sealed.',
      SOLAR_STORM: 'Solar Particle Event (SPE) radiation storm shelter evacuation protocol executed.',
      GENERAL: 'Autonomous emergency medical rescue guidance protocol completed.',
    };

    // Load recent flags from patient healthReadings for Background section
    const recentReadings = await db.healthReadings
      .where('crewMemberId')
      .equals(patient.id!)
      .toArray();

    const recentFlags = recentReadings
      .filter((r) => r.status === 'ALERT' || r.status === 'CRITICAL')
      .slice(-5)
      .map((r) => ({
        day: r.missionDay,
        indicator: r.indicator,
        status: r.status,
        note: r.reasons?.[0] || 'Abnormal indicator value',
      }));

    const sbar = buildSbarReport({
      patient,
      emergencyType: activeEmergencyType,
      startedAt,
      endedAt: Date.now(),
      missionDay,
      environmentName: environment.name,
      oneWayDelaySeconds,
      summary: summaryMap[activeEmergencyType] || 'Autonomous emergency medical protocol executed.',
      baselines: patientBaselines,
      recentFlags,
      recentEva: activeEmergencyType === 'CHEST_PAIN',
      protocolStepsCompleted: protocolSteps,
      vitalsTimeline: capturedVitals,
    });

    setSbarData(sbar);
    setStage('SBAR');
    speak('Emergency protocol concluded. Generating clinical SBAR incident report for Ground Link handover.');
  }, [
    activeEmergencyType,
    capturedVitals,
    environment.name,
    missionDay,
    navigate,
    oneWayDelaySeconds,
    patient,
    patientBaselines,
    protocolSteps,
    speak,
    startedAt,
  ]);

  // Transmit SBAR to Ground Link outbox (db.groundPackets) & log to db.incidentReports
  const handleTransmitToGround = async () => {
    if (!sbarData || !patient) return;

    // 1. Add to groundPackets as a HIGH priority downlink packet per §7.11 & §7.12
    await db.groundPackets.add({
      direction: 'downlink',
      priority: 'HIGH',
      type: 'INCIDENT',
      title: `EMERGENCY SBAR REPORT: ${sbarData.situation.emergencyType} - ${patient.name} (${patient.callSign})`,
      payload: sbarData as unknown as Record<string, unknown>,
      sentAt: Date.now(),
      arrivalAt: Date.now() + oneWayDelaySeconds * 1000,
      delivered: false,
      read: false,
    });

    // 2. Add to incidentReports Dexie table
    await db.incidentReports.add({
      timestamp: Date.now(),
      missionDay,
      emergencyType: sbarData.situation.emergencyType as 'CPR' | 'CHEST_PAIN' | 'TOXIC_BREATHING' | 'SOLAR_STORM',
      summary: sbarData.situation.summary,
      timeline: protocolSteps.map((p) => ({ time: p.timestamp, event: p.step })),
      vitalsCaptured: (capturedVitals[capturedVitals.length - 1] as unknown as Record<string, unknown>) || {},
      status: 'ongoing',
    });

    setIsPacketQueued(true);
    speak('SBAR Incident Report queued to Ground Link with high priority.');
  };

  useEffect(() => {
    handlersRef.current = {
      confirm: handleConfirmPatient,
      unresponsive: handleSelectUnresponsive,
      conscious: handleSelectConsciousProtocol,
    };
  });

  return (
    <div
      data-testid="emergency-screen"
      className="fixed inset-0 z-50 bg-[#120204] text-white flex flex-col overflow-y-auto selection:bg-red-500 selection:text-white"
    >
      {/* Pinned Decision Clock on Every Emergency Screen (§7.11 v3) */}
      <DecisionClockBar
        startedAt={startedAt}
        oneWayDelaySeconds={oneWayDelaySeconds}
        patient={patient}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted((prev) => !prev)}
        onExitAndReport={() => void handleGenerateSbarAndExit()}
      />

      {/* Main Protocol Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6 flex flex-col justify-start">
        {/* On-Screen Speech Caption Banner with Repeat button per §7.11 */}
        <SpeechCaptionBanner
          caption={currentCaption}
          hasLocalVoice={hasLocalVoice}
          isSpeaking={isSpeaking}
          onRepeat={handleRepeatVoice}
        />

        {/* Hands-free voice commands (Chrome/Edge). Buttons remain available. */}
        <div className="flex flex-wrap items-center gap-3 -mt-2">
          {voiceSupported ? (
            <button
              type="button"
              data-testid="voice-commands-toggle"
              onClick={() => setVoiceCommandsOn((v) => !v)}
              aria-pressed={voiceCommandsOn}
              className={`min-h-[56px] px-5 rounded-xl border-2 font-bold tracking-wide transition-all ${
                voiceCommandsOn
                  ? 'bg-emerald-700/40 border-emerald-300 text-white'
                  : 'bg-black/50 border-red-500/40 text-red-100 hover:border-emerald-400'
              }`}
            >
              {voiceCommandsOn ? (isListening ? '● LISTENING — speak your answer' : '● VOICE COMMANDS ON') : '○ ANSWER BY VOICE'}
            </button>
          ) : (
            <span className="text-xs font-mono text-red-200/60">Voice answers need Chrome or Edge. Use the buttons.</span>
          )}
          {voiceCommandsOn && heardText && (
            <span className="text-sm font-mono text-emerald-200/80">Heard: "{heardText}"</span>
          )}
        </div>

        {/* Step 0: Who needs help? Me / a crewmate */}
        {stage === 'PATIENT_SELECT' && (
          <PatientSelectStep
            currentCrew={crew}
            allCrew={allCrew}
            selectedPatient={patient}
            baselines={patientBaselines}
            onSelectPatient={(p) => setPatient(p)}
            onConfirm={handleConfirmPatient}
          />
        )}

        {/* Step 1: Is person responsive and breathing normally? */}
        {stage === 'TRIAGE' && patient && (
          <TriageStep
            patient={patient}
            onSelectUnresponsive={handleSelectUnresponsive}
            onSelectConsciousProtocol={handleSelectConsciousProtocol}
          />
        )}

        {/* Active Protocols */}
        {stage === 'PROTOCOL' && patient && (
          <>
            {activeEmergencyType === 'CPR' && (
              <CprCoachProtocol
                patient={patient}
                environment={environment}
                onLogStep={handleLogProtocolStep}
                speak={speak}
              />
            )}

            {activeEmergencyType === 'CHEST_PAIN' && (
              <ChestPainProtocol
                patient={patient}
                missionDay={missionDay}
                baselines={patientBaselines}
                onLogStep={handleLogProtocolStep}
                onRecordVitals={handleRecordVitals}
                speak={speak}
              />
            )}

            {activeEmergencyType === 'TOXIC_BREATHING' && (
              <ToxicBreathingProtocol
                patient={patient}
                onLogStep={handleLogProtocolStep}
                speak={speak}
              />
            )}

            {activeEmergencyType === 'SOLAR_STORM' && (
              <RadiationStormProtocol
                patient={patient}
                missionDay={missionDay}
                onLogStep={handleLogProtocolStep}
                speak={speak}
              />
            )}
          </>
        )}
      </main>

      {/* Full-Screen Clinical SBAR Modal / Handover Report (Part C) */}
      {stage === 'SBAR' && sbarData && (
        <SbarReportView
          sbar={sbarData}
          isPacketQueued={isPacketQueued}
          onTransmitToGround={handleTransmitToGround}
          onClose={() => navigate('/')}
        />
      )}
    </div>
  );
};
