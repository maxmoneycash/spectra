import {
  LayoutDashboard,
  GraduationCap,
  Radio,
  Crosshair,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react';
import type { AppView } from '@/store/store';

/**
 * The five places in SPECTRA, in the order you'd progress through them.
 * Station is the board: what to do next, how ready you are, what you've
 * done. One list drives both the phone tab bar and the desktop header
 * tabs, so they can never disagree. View ids stay stable for deep links;
 * only the labels changed when the app became a training simulator.
 */
export interface NavItem {
  id: AppView;
  label: string;
  /** Short line under the label in roomy layouts. */
  hint: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { id: 'station', label: 'Station', hint: 'Your board', icon: LayoutDashboard },
  { id: 'academy', label: 'Train', hint: 'Learn the radio', icon: GraduationCap },
  { id: 'console', label: 'Receiver', hint: 'The live spectrum', icon: Radio },
  { id: 'ctf', label: 'Tasking', hint: 'Intercept missions', icon: Crosshair },
  { id: 'exam', label: 'Exam', hint: 'License prep', icon: ClipboardCheck },
];
