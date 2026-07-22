import type { ComponentType } from 'react';
import { AmModulationExplorer, FmModulationExplorer } from './Modulation';
import { SineExplorer, WavelengthConverter, PrefixConverter, DbCalculator } from './Basics';
import { OhmsLawPlot, VoltageDivider, ColourCodeDecoder, ResonanceCalc } from './Circuits';
import { SwrExplorer, DipoleLength } from './Antenna';
import { GridBeam, AntennaCalc } from './RadioTools';

/** All ported Radio Bench-style interactives. */
export const WIDGETS: Record<string, ComponentType> = {
  'am-explorer': AmModulationExplorer,
  'fm-explorer': FmModulationExplorer,
  'sine-explorer': SineExplorer,
  'wavelength-converter': WavelengthConverter,
  'prefix-converter': PrefixConverter,
  'db-calculator': DbCalculator,
  'ohms-law': OhmsLawPlot,
  'voltage-divider': VoltageDivider,
  'colour-code': ColourCodeDecoder,
  resonance: ResonanceCalc,
  'swr-explorer': SwrExplorer,
  'dipole-length': DipoleLength,
  'grid-beam': GridBeam,
  'antenna-calc': AntennaCalc,
};

/** Widgets embedded at the end of specific chapters. */
export const CHAPTER_WIDGETS: Record<string, string[]> = {
  '0-3': ['prefix-converter'],
  '0-4': ['db-calculator'],
  '1-2': ['ohms-law'],
  '1-3': ['sine-explorer'],
  '1-4': ['voltage-divider', 'colour-code'],
  '1-7': ['resonance'],
  '2-1': ['wavelength-converter'],
  '2-2': ['am-explorer', 'fm-explorer'],
  '3-3': ['swr-explorer', 'dipole-length'],
};

/** Playground order for the Reference tab. */
export const PLAYGROUND: string[] = [
  'sine-explorer',
  'wavelength-converter',
  'am-explorer',
  'fm-explorer',
  'db-calculator',
  'ohms-law',
  'voltage-divider',
  'colour-code',
  'resonance',
  'prefix-converter',
  'swr-explorer',
  'dipole-length',
  'antenna-calc',
  'grid-beam',
];
