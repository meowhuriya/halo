export interface IndicatorRange {
  indicator: string;
  unit: string;
  nominal: string;
  watch: string;
  alert: string;
  critical: string;
}

export const CLINICAL_THRESHOLDS: Record<string, IndicatorRange> = {
  heartRate: {
    indicator: 'Resting heart rate',
    unit: 'bpm',
    nominal: '50–100',
    watch: '40–49 or 101–110',
    alert: '111–130',
    critical: '< 40 or > 130',
  },
  bloodPressure: {
    indicator: 'Blood pressure (sys/dia)',
    unit: 'mmHg',
    nominal: '< 120 and < 80',
    watch: '120–129 and < 80',
    alert: '130–139 or 80–89 (sys < 90 or ≥ 140 or dia ≥ 90)',
    critical: '> 180 or > 120',
  },
  spo2: {
    indicator: 'SpO₂',
    unit: '%',
    nominal: '≥ 95',
    watch: '93–94',
    alert: '91–92',
    critical: '≤ 90',
  },
  temperature: {
    indicator: 'Body temperature',
    unit: '°C',
    nominal: '36.1–37.2',
    watch: '37.3–37.9 or 35.5–36.0',
    alert: '38.0–39.4',
    critical: '≥ 39.5 or < 35.0',
  },
  glucose: {
    indicator: 'Blood glucose',
    unit: 'mg/dL',
    nominal: '70–140 (fasting) / 180 (post-meal)',
    watch: '141–180 or 55–69',
    alert: '181–250',
    critical: '< 54 or > 250',
  },
  respiratoryRate: {
    indicator: 'Respiratory rate',
    unit: '/min',
    nominal: '12–20',
    watch: '21–24 or 10–11',
    alert: '25–29',
    critical: '< 10 or ≥ 30',
  },
  sleep: {
    indicator: 'Sleep (24 h)',
    unit: 'hours',
    nominal: '≥ 7',
    watch: '6–6.9',
    alert: '< 6 for 3+ consecutive days',
    critical: '< 4 for 2+ consecutive days',
  },
  radiation: {
    indicator: 'Cumulative radiation',
    unit: 'mSv',
    nominal: '< 300 (< 50% limit)',
    watch: '300–479 (50–79% limit)',
    alert: '480–599 (80–99% limit)',
    critical: '≥ 600 (NASA 2022 career limit 600 mSv)',
  },
};
