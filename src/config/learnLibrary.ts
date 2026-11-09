export interface LearnTopic {
  id: string;
  category: 'hazard' | 'vital';
  title: string;
  whatItIs: string;
  whyInSpace: string;
  howToMeasure: string;
  normalRange: string;
  whenToAlertCmo: string;
}

export const LEARN_LIBRARY: LearnTopic[] = [
  {
    id: 'heart_rate',
    category: 'vital',
    title: 'Resting Heart Rate & Autonomic Tone',
    whatItIs: 'Basal contractions per minute when stationary, reflecting cardiac workload and autonomic nervous balance.',
    whyInSpace: 'Microgravity removes hydrostatic blood pressure column, shifting ~2 liters fluid toward head. Resting HR adapts.',
    howToMeasure: 'Front camera rPPG face scan (20s) or manual radial artery 30s count.',
    normalRange: '50–100 bpm (and within ±2 SD of personal pre-flight baseline).',
    whenToAlertCmo: '< 40 bpm or > 130 bpm, or unexplained rise > 30 bpm during post-flight/landing stand test.',
  },
  {
    id: 'blood_pressure',
    category: 'vital',
    title: 'Blood Pressure & Fluid Redistribution',
    whatItIs: 'Lateral hydrostatic force exerted by circulated blood on systemic arterial vascular walls.',
    whyInSpace: 'Fluid shifts cause transient central venous pressure increase followed by plasma volume contraction of 10–15%.',
    howToMeasure: 'Automatic arm cuff at heart level after 5 min seated rest.',
    normalRange: 'Systolic < 120 mmHg and Diastolic < 80 mmHg.',
    whenToAlertCmo: 'Systolic ≥ 140 mmHg, Diastolic ≥ 90 mmHg, or sudden orthostatic drop ≥ 20 mmHg upon standing.',
  },
  {
    id: 'radiation',
    category: 'hazard',
    title: 'Galactic Cosmic Rays & Solar Storms (SPE)',
    whatItIs: 'Omnidirectional high-energy protons and HZE nuclei outside Earth magnetosphere.',
    whyInSpace: 'Deep space transit lacks Earth geomagnetic shield, exposing crew to ~1.8 mSv/day (300x Earth sea level).',
    howToMeasure: 'Personal dosimeter and vehicle RAD telemetry logs.',
    normalRange: '< 300 mSv cumulative (< 50% of 600 mSv career limit).',
    whenToAlertCmo: 'SPE alarm trigger, visual light flashes (phosphenes), or dose trajectory approaching 480 mSv.',
  },
];
