/**
 * Question narration via the Web Speech API. Reads the public-domain pool text
 * with the browser's own voices — no audio assets to ship or host.
 */

const LETTERS = ['A', 'B', 'C', 'D'];

let warmed = false;

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Voices load asynchronously in most browsers; nudge them early. */
export function warmVoices(): void {
  if (warmed || !speechSupported()) return;
  warmed = true;
  window.speechSynthesis.getVoices();
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
  const pool = en.length ? en : voices;
  // Prefer a natural-sounding local voice when the platform offers one.
  return (
    pool.find((v) => /samantha|serena|daniel|natural|neural|google us/i.test(v.name)) ??
    pool.find((v) => v.localService) ??
    pool[0]
  );
}

export function cancelSpeech(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

interface SpeakOptions {
  /** Read the answer choices after the question. */
  withAnswers?: boolean;
  onEnd?: () => void;
}

/**
 * Speak a question (and optionally its choices). Cancels anything in flight so
 * swiping quickly through reels never stacks up overlapping narration.
 */
export function speakQuestion(
  question: string,
  answers: readonly string[],
  opts: SpeakOptions = {},
): void {
  if (!speechSupported()) return;
  cancelSpeech();

  const parts = [question];
  if (opts.withAnswers) {
    answers.forEach((a, i) => parts.push(`${LETTERS[i]}. ${a}`));
  }

  const voice = pickVoice();
  const utterances = parts.map((text, i) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 1.02;
    u.pitch = 1;
    // A beat between the question and each choice reads more naturally.
    if (i === parts.length - 1 && opts.onEnd) u.onend = opts.onEnd;
    return u;
  });

  for (const u of utterances) window.speechSynthesis.speak(u);
}

export function speakText(text: string): void {
  if (!speechSupported()) return;
  cancelSpeech();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.rate = 1.02;
  window.speechSynthesis.speak(u);
}
