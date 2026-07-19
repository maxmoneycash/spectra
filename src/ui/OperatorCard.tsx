import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, Link2, Share2 } from 'lucide-react';
import { useStore } from '../store/store';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { renderOperatorCard, rankFor, type CardData } from './card/renderOperatorCard';
import { cn } from '@/lib/utils';

const SITE_URL = 'https://spectra-one.vercel.app';
const SHARE_TEXT = `I'm learning radio on SPECTRA — a free software-defined radio lab in your browser. Just earned my operator card. Try it: ${SITE_URL} #hamradio`;

function coursePct(): number {
  try {
    const p = JSON.parse(localStorage.getItem('spectra.course.v1') || '{}');
    const done = Object.values(p as Record<string, { done?: boolean }>).filter((c) => c.done).length;
    return Math.round((done / 25) * 100);
  } catch {
    return 0;
  }
}

function useQrImage(url: string): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(url, { margin: 0, width: 360, color: { dark: '#18181b', light: '#ffffff' } }).then(
      (dataUrl) => {
        const im = new Image();
        im.onload = () => {
          if (alive) setImg(im);
        };
        im.src = dataUrl;
      },
    );
    return () => {
      alive = false;
    };
  }, [url]);
  return img;
}

/** Mint + share the operator card: preview, inputs, download/copy actions. */
export function OperatorCard() {
  const open = useStore((s) => s.cardOpen);
  const setOpen = useStore((s) => s.setCardOpen);
  const operator = useStore((s) => s.operator);

  const [callsign, setCallsign] = useState('M0RSE');
  const [name, setName] = useState('');
  const [copied, setCopied] = useState<'img' | 'link' | 'text' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qr = useQrImage(SITE_URL);

  const data: CardData = useMemo(
    () => ({
      callsign,
      name: name.trim(),
      signals: operator.identified.length,
      missions: operator.missions.length,
      coursePct: coursePct(),
      since: new Date(operator.since),
      qr,
    }),
    [callsign, name, operator, qr],
  );

  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!open) return;
    // The dialog portal mounts content in the same commit — defer one frame
    // so the canvas element exists before drawing.
    const id = requestAnimationFrame(() => {
      if (canvasRef.current) renderOperatorCard(canvasRef.current, dataRef.current);
    });
    return () => cancelAnimationFrame(id);
  }, [data, open]);

  const flash = (k: 'img' | 'link' | 'text') => {
    setCopied(k);
    setTimeout(() => setCopied(null), 1400);
  };

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `spectra-operator-${(callsign || 'M0RSE').toUpperCase()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  };

  const copyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flash('img');
    } catch {
      download(); // clipboard images unsupported (Firefox) → download instead
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(SITE_URL);
    flash('link');
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(SHARE_TEXT);
    flash('text');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[min(92vw,460px)] gap-0 overflow-hidden p-0">
        <div className="border-b border-line px-4 py-3">
          <DialogTitle className="text-[14px] font-medium">Your operator card</DialogTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Rank: {rankFor(operator.identified.length).toLowerCase()} — earned inside the
            simulator. Share it anywhere.
          </p>
        </div>

        <div className="bg-stage p-4">
          <canvas
            ref={canvasRef}
            className="block w-full rounded-md shadow-lg"
            aria-label="Operator card preview"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5 px-4 py-3">
          <label className="flex flex-col gap-1">
            <span className="mono-feats font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Callsign
            </span>
            <input
              value={callsign}
              onChange={(e) => setCallsign(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))}
              placeholder="M0RSE"
              className="mono-feats rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-[13px] uppercase text-foreground focus:outline-2 focus:outline-ring"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="mono-feats font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Name (optional)
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 26))}
              placeholder="Samuel Morse"
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground focus:outline-2 focus:outline-ring"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-line px-4 py-3">
          <Button onClick={download} className="gap-1.5">
            <Download className="size-4" /> PNG
          </Button>
          <Button variant="outline" onClick={copyImage} className="gap-1.5">
            {copied === 'img' ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied === 'img' ? 'Copied' : 'Copy image'}
          </Button>
          <Button variant="outline" onClick={copyLink} className="gap-1.5">
            {copied === 'link' ? <Check className="size-4" /> : <Link2 className="size-4" />}
            {copied === 'link' ? 'Copied' : 'Copy link'}
          </Button>
          <Button variant="outline" onClick={copyText} className="gap-1.5">
            {copied === 'text' ? <Check className="size-4" /> : <Share2 className="size-4" />}
            {copied === 'text' ? 'Copied' : 'Share text'}
          </Button>
        </div>

        <p
          className={cn(
            'border-t border-line px-4 py-2.5 text-[10.5px] text-muted-foreground',
            'mono-feats font-mono',
          )}
        >
          {operator.identified.length} signals · {operator.missions.length} missions ·{' '}
          {coursePct()}% course — every card links back here. That is how others find us.
        </p>
      </DialogContent>
    </Dialog>
  );
}
