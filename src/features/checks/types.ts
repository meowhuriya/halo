export type CheckFlowId =
  | 'bp'
  | 'spo2'
  | 'temperature'
  | 'glucose'
  | 'heart_rate'
  | 'respiratory'
  | 'sleep'
  | 'mood'
  | 'phq2_gad2'
  | 'exercise';

export interface CheckDefinition {
  id: CheckFlowId;
  title: string;
  shortTitle: string;
  category: 'Cardiovascular' | 'Pulmonary' | 'Metabolic' | 'Neuropsychology' | 'Behavioral' | 'Musculoskeletal';
  equipmentRequired: 'bpCuff' | 'pulseOx' | 'thermometer' | 'glucometer' | null;
  frequency: string;
  xp: number;
  unit: string;
  saneRangeDescription: string;
  guideSteps: string[];
  whyItMatters: string;
}

export const CHECK_DEFINITIONS: Record<CheckFlowId, CheckDefinition> = {
  bp: {
    id: 'bp',
    title: 'Resting Blood Pressure Cuff',
    shortTitle: 'Blood Pressure',
    category: 'Cardiovascular',
    equipmentRequired: 'bpCuff',
    frequency: 'Every 3 days',
    xp: 35,
    unit: 'mmHg',
    saneRangeDescription: 'Systolic: 50–260 mmHg, Diastolic: 30–160 mmHg',
    guideSteps: [
      'Rest seated quietly for at least 5 minutes before cuff inflation.',
      'Support bare arm on table or restraint at heart level.',
      'Wrap cuff snugly 2 cm above the elbow crease with sensor arrow aligned to brachial artery.',
      'Remain completely silent and stationary during measurement.',
      'Take 2 readings 1 minute apart and record the average value.',
    ],
    whyItMatters:
      'Cephalad fluid redistribution in microgravity alters systemic vascular resistance and baroreflex gain. Sustained hypertension elevates intracerebral pressure.',
  },
  spo2: {
    id: 'spo2',
    title: 'Pulse Oximeter (SpO₂)',
    shortTitle: 'SpO₂ Oxygenation',
    category: 'Pulmonary',
    equipmentRequired: 'pulseOx',
    frequency: 'Daily / Post-exercise',
    xp: 25,
    unit: '%',
    saneRangeDescription: 'SpO₂: 50–100 %',
    guideSteps: [
      'Ensure fingers are warm and dry (cold extremities induce vasoconstrictive artifact).',
      'Remove gloves or dark fingernail markings.',
      'Clip probe firmly onto middle or index fingertip.',
      'Rest hand flat on a fixed surface and breathe normally for 30 seconds.',
      'Record value once the plethysmograph waveform stabilizes.',
    ],
    whyItMatters:
      'Alveolar dead space and ventilation-perfusion matching shift in 0g. Detects silent hypoxia or micro-atmospheric environmental contamination.',
  },
  temperature: {
    id: 'temperature',
    title: 'Core Body Temperature',
    shortTitle: 'Core Temp',
    category: 'Metabolic',
    equipmentRequired: 'thermometer',
    frequency: 'Weekly / As needed',
    xp: 20,
    unit: '°C',
    saneRangeDescription: 'Temperature: 32.0–43.0 °C',
    guideSteps: [
      'Inspect probe sensor tip for debris or calibration flags.',
      'Place tympanic sensor in ear canal or scan temporal artery per flight medical kit manual.',
      'Maintain steady contact until the completion chime sounds.',
      'Wipe forehead sweat prior to temporal contact to avoid evaporative cooling artifact.',
    ],
    whyItMatters:
      'Long-duration spaceflight causes a gradual ~1 °C elevation in resting core temperature ("space fever") due to impaired convective heat dissipation and inflammatory resetting.',
  },
  glucose: {
    id: 'glucose',
    title: 'Blood Glucose (Fasting / Post-Meal)',
    shortTitle: 'Blood Glucose',
    category: 'Metabolic',
    equipmentRequired: 'glucometer',
    frequency: 'Weekly check',
    xp: 40,
    unit: 'mg/dL',
    saneRangeDescription: 'Glucose: 20–500 mg/dL',
    guideSteps: [
      'Disinfect fingertip with alcohol swab and allow skin to dry completely.',
      'Load fresh sterile lancet into lancing device set to depth level 2.',
      'Puncture lateral border of fingertip; discard first blood droplet with dry gauze.',
      'Touch test strip tip to second droplet until capillary channel fills completely.',
      'Mark toggle as Fasting (≥ 8h no caloric intake) or Post-Meal (within 2h of meal).',
    ],
    whyItMatters:
      'Microgravity reduces skeletal muscle glucose transporter activity, promoting progressive insulin resistance during extended space missions.',
  },
  heart_rate: {
    id: 'heart_rate',
    title: 'Resting Heart Rate (Manual Radial)',
    shortTitle: 'Resting HR',
    category: 'Cardiovascular',
    equipmentRequired: null,
    frequency: 'Daily (alternative to camera)',
    xp: 20,
    unit: 'bpm',
    saneRangeDescription: 'Heart Rate: 20–250 bpm',
    guideSteps: [
      'Sit comfortably and relax for 5 minutes without talking.',
      'Place tips of index and middle fingers on inside of wrist just below thumb base.',
      'Count arterial pulsations for 30 continuous seconds.',
      'Multiply counted beats by 2 to obtain resting beats per minute (bpm).',
    ],
    whyItMatters:
      'Heart rate directly indicates autonomic stress, plasma volume status, and cardiac workload. An unexplained increase often precedes clinical deconditioning.',
  },
  respiratory: {
    id: 'respiratory',
    title: 'Respiratory Rate (30s Tap Counter)',
    shortTitle: 'Respiratory Rate',
    category: 'Pulmonary',
    equipmentRequired: null,
    frequency: 'Weekly / On demand',
    xp: 20,
    unit: '/min',
    saneRangeDescription: 'Breaths: 4–60 /min',
    guideSteps: [
      'Sit upright in medical restraint with shoulders relaxed.',
      'Breathe spontaneously at your natural pace.',
      'Use the interactive HALO breath counter: tap the button at the beginning of each inhalation for 30 seconds.',
      'HALO automatically computes your breaths/minute (taps × 2).',
    ],
    whyItMatters:
      'Detects localized module CO₂ pockets, metabolic acidosis, or thoracic adaptation to zero gravity.',
  },
  sleep: {
    id: 'sleep',
    title: 'Daily Sleep Log & Recovery',
    shortTitle: 'Sleep Log',
    category: 'Neuropsychology',
    equipmentRequired: null,
    frequency: 'Daily morning',
    xp: 30,
    unit: 'hours',
    saneRangeDescription: 'Sleep Duration: 0.0–24.0 hours',
    guideSteps: [
      'Log total hours slept during your primary sleep opportunity and naps in the last 24h.',
      'Rate perceived sleep restoration from 1 (severely restless) to 5 (optimal recovery).',
      'Note any awakenings caused by tether slippage, noise, or temperature discomfort.',
    ],
    whyItMatters:
      'Circadian desynchronosis and sleep debt (< 6h/night) severely impair cognitive performance, motor coordination, and mood stability on deep-space journeys.',
  },
  mood: {
    id: 'mood',
    title: 'Daily Behavioral Health Check-In',
    shortTitle: 'Mood Check-in',
    category: 'Behavioral',
    equipmentRequired: null,
    frequency: 'Daily morning',
    xp: 30,
    unit: 'scale 1–5',
    saneRangeDescription: 'All ratings: 1–5 scale',
    guideSteps: [
      'Evaluate your current emotional valence (Mood: 1 unhappy → 5 happy).',
      'Assess somatic Energy level (1 exhausted → 5 energized).',
      'Rate operational Stress level (1 calm → 5 overwhelmed).',
      'Rate Confinement / Loneliness feelings (1 connected → 5 isolated).',
      'Optional: log private reflection note for your personal health record.',
    ],
    whyItMatters:
      'Confinement and isolation in extreme environments erode psychological stamina. Early tracking detects subclinical tension before interpersonal friction develops.',
  },
  phq2_gad2: {
    id: 'phq2_gad2',
    title: 'Weekly PHQ-2 & GAD-2 Mental Health Screen',
    shortTitle: 'PHQ-2 / GAD-2',
    category: 'Behavioral',
    equipmentRequired: null,
    frequency: 'Weekly',
    xp: 45,
    unit: 'score 0–6',
    saneRangeDescription: 'Scores: 0–3 per item (total 0–6 each)',
    guideSteps: [
      'Standardized validated clinical screening instruments for depression and anxiety.',
      'Reflect honestly on the past 2 weeks of mission operations.',
      'Select frequency from 0 (Not at all) to 3 (Nearly every day) for each statement.',
      'Confidential results: scores ≥ 3 trigger supportive psychological options.',
    ],
    whyItMatters:
      'Long-duration spaceflight places severe psychosocial burdens on crew. Validated weekly screens identify emerging mood or anxiety disorders early.',
  },
  exercise: {
    id: 'exercise',
    title: 'Exercise Countermeasure Session Log',
    shortTitle: 'Exercise Log',
    category: 'Musculoskeletal',
    equipmentRequired: null,
    frequency: 'Daily (target 2.5h)',
    xp: 50,
    unit: 'minutes',
    saneRangeDescription: 'Resistance: 0–300 min, Aerobic: 0–300 min',
    guideSteps: [
      'Log time completed on Advanced Resistive Exercise Device (ARED).',
      'Log aerobic time on T2 Cycle Ergometer or Treadmill with vibration isolation.',
      'Rate your Rate of Perceived Exertion (RPE) on Borg 1–10 scale.',
      'Target: 2.5 hours combined daily countermeasure protocol.',
    ],
    whyItMatters:
      'Without daily resistive countermeasure loading, astronauts lose 1–1.5% bone mineral density per month at hip and spine, alongside severe calf muscle atrophy.',
  },
};
