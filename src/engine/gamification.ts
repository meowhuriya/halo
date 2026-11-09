export interface AdherenceBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const BADGES: AdherenceBadge[] = [
  { id: 'first_light', name: 'First Light', description: 'First contactless rPPG scan completed', icon: '✨' },
  { id: 'iron_body', name: 'Iron Body', description: '7-day countermeasure exercise streak', icon: '🛡️' },
  { id: 'clear_sight', name: 'Clear Sight', description: 'Both-eye Amsler grid screen completed', icon: '👁️' },
  { id: 'steady_hand', name: 'Steady Hand', description: '5 consecutive PVT-B sessions completed on schedule', icon: '🎯' },
];
