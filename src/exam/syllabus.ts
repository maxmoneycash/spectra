/**
 * Human-readable topic names for each NCVEC subelement, used to group reels
 * and label progress. Keys are subelement ids ("T1", "G5", "E9").
 */
export const SUBELEMENT_TITLES: Record<string, string> = {
  // Technician (Element 2)
  T1: 'FCC rules & station licensing',
  T2: 'Operating procedures',
  T3: 'Radio wave propagation',
  T4: 'Station setup & practices',
  T5: 'Electrical principles',
  T6: 'Components & circuit diagrams',
  T7: 'Station equipment & troubleshooting',
  T8: 'Modulation modes & digital',
  T9: 'Antennas & feed lines',
  T0: 'Electrical & RF safety',

  // General (Element 3)
  G1: "Commission's rules",
  G2: 'Operating procedures',
  G3: 'Radio wave propagation',
  G4: 'Amateur radio practices',
  G5: 'Electrical principles',
  G6: 'Circuit components',
  G7: 'Practical circuits',
  G8: 'Signals & emissions',
  G9: 'Antennas & feed lines',
  G0: 'Electrical & RF safety',

  // Extra (Element 4)
  E1: "Commission's rules",
  E2: 'Operating procedures',
  E3: 'Radio wave propagation',
  E4: 'Amateur practices',
  E5: 'Electrical principles',
  E6: 'Circuit components',
  E7: 'Practical circuits',
  E8: 'Signals & emissions',
  E9: 'Antennas & transmission lines',
  E0: 'Safety',
};

export const subelementTitle = (sub: string): string => SUBELEMENT_TITLES[sub] ?? sub;
