import type { SVGProps } from 'react';

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M7 5.5 18 12 7 18.5V5.5Z" fill="currentColor" stroke="none" /></svg>
);
export const IconPause = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><rect x="7" y="6" width="3.4" height="12" rx="1" fill="currentColor" stroke="none" /><rect x="13.6" y="6" width="3.4" height="12" rx="1" fill="currentColor" stroke="none" /></svg>
);
export const IconStop = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none" /></svg>
);
export const IconRecord = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /></svg>
);
export const IconEye = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.7" /></svg>
);
export const IconBack = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
);
export const IconGear = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3" /></svg>
);
export const IconHeart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M12 20s-7-4.4-7-9.4A3.9 3.9 0 0 1 12 7a3.9 3.9 0 0 1 7 3.6c0 5-7 9.4-7 9.4Z" /></svg>
);
export const IconHeartFilled = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M12 20s-7-4.4-7-9.4A3.9 3.9 0 0 1 12 7a3.9 3.9 0 0 1 7 3.6c0 5-7 9.4-7 9.4Z" fill="currentColor" stroke="none" /></svg>
);
export const IconThumbUp = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M7 11v8H4v-8h3ZM7 11l4-7a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 19H7" /></svg>
);
export const IconThumbDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} style={{ transform: 'scale(1,-1)' }}><path d="M7 11v8H4v-8h3ZM7 11l4-7a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 19H7" /></svg>
);
export const IconSave = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M3 6h12M3 11h8M3 16h6" /><path d="M17.5 16.5s-2.6-1.6-2.6-3.4a1.5 1.5 0 0 1 2.6-1 1.5 1.5 0 0 1 2.6 1c0 1.8-2.6 3.4-2.6 3.4Z" /></svg>
);
export const IconShare = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><circle cx="6" cy="12" r="2.4" /><circle cx="17" cy="6" r="2.4" /><circle cx="17" cy="18" r="2.4" /><path d="M8.1 10.9 14.9 7.1M8.1 13.1l6.8 3.8" /></svg>
);
export const IconShuffle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M17 4h4v4M21 4l-6 6M17 20h4v-4M21 20l-5.5-5.5M3 5l4.5 4.5M3 19l14-14" /></svg>
);
export const IconPrev = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M17 5 10 12l7 7M8 5v14" /></svg>
);
export const IconNext = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M7 5l7 7-7 7M16 5v14" /></svg>
);
export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M4 6h9M4 11h6M4 16h4" /><circle cx="16" cy="14" r="3.6" /><path d="m19 17 2.5 2.5" /></svg>
);
export const IconDisc = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.3" /></svg>
);
export const IconRadio = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" /><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" /><path d="M6 6a9 9 0 0 0 0 12M18 6a9 9 0 0 1 0 12" /></svg>
);
export const IconSliders = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2.1" /><circle cx="9" cy="17" r="2.1" /></svg>
);
export const IconWaveform = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M3 12h2l1.5-5 3 12 3-15 2.5 9 1.5-3H21" /></svg>
);
export const IconLibrary = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconGrid = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const IconTune = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" /></svg>
);
