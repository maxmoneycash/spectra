import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { renderOgCard } from './renderOperatorCard';

const SITE_URL = 'https://spectra-one.vercel.app';

/**
 * Dev-only OG image capture page (loaded via ?ogcard=1 by scripts/make-og.mjs).
 * Renders the wide 1200×630 operator card full-screen with a strong demo stat line.
 */
export function OgCardCapture() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void QRCode.toDataURL(SITE_URL, {
      margin: 0,
      width: 360,
      color: { dark: '#18181b', light: '#ffffff' },
    }).then((dataUrl) => {
      const im = new Image();
      im.onload = () => {
        if (ref.current) {
          renderOgCard(ref.current, {
            callsign: 'M0RSE',
            name: 'Samuel Morse',
            signals: 11,
            missions: 5,
            coursePct: 64,
            since: new Date('2026-07-18'),
            qr: im,
          });
          setReady(true);
        }
      };
      im.src = dataUrl;
    });
  }, []);

  return (
    <div className="grid min-h-dvh place-items-center bg-white">
      <canvas ref={ref} data-ready={ready} style={{ width: 1200, height: 630 }} />
    </div>
  );
}
