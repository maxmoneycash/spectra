/**
 * Render spoken narration for every exam question.
 *
 * The question text is the NCVEC public-domain pool; the voice is synthesized
 * here, so the output is ours end to end. Rendering is incremental: a question
 * is only re-rendered when its narration text changes.
 *
 * Usage:
 *   node scripts/render-narration.mjs                      # all pools, macOS `say`
 *   node scripts/render-narration.mjs --pool technician
 *   node scripts/render-narration.mjs --voice Daniel --bitrate 24000
 *   node scripts/render-narration.mjs --limit 20           # smoke test
 *   node scripts/render-narration.mjs --engine openai      # needs OPENAI_API_KEY
 *
 * Output: public/exam/audio/<pool>/<ID>.m4a + manifest.json
 * These are generated assets — gitignored, not committed.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url)); // .pathname breaks on spaces
const SRC = join(ROOT, 'vendor/pools');
const OUT = join(ROOT, 'public/exam/audio');

const POOLS = {
  technician: 'technician-2026-2030.json',
  general: 'general-2023-2027.json',
  extra: 'extra-2024-2028.json',
};

// ---- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const opts = {
  pool: arg('pool', null),
  voice: arg('voice', 'Samantha'),
  bitrate: Number(arg('bitrate', 16000)),
  limit: Number(arg('limit', 0)),
  engine: arg('engine', 'say'),
  concurrency: Number(arg('concurrency', 4)),
  force: argv.includes('--force'),
  sample: argv.includes('--sample'),
};

const LETTERS = ['A', 'B', 'C', 'D'];

/** The exact words spoken for a question — also the cache key. */
function narrationText(q) {
  const choices = q.answers.map((a, i) => `${LETTERS[i]}. ${a}`).join(' ');
  return `${q.question} ${choices}`;
}

const hashOf = (text) =>
  createHash('sha1').update(`${opts.engine}|${opts.voice}|${opts.bitrate}|${text}`).digest('hex').slice(0, 12);

// ---- renderers ------------------------------------------------------------
// Each renderer takes (text, outPath) and writes an m4a. Swapping engines does
// not touch the rest of the pipeline.

async function renderWithSay(text, outPath) {
  const scratch = join(tmpdir(), `spectra-tts-${process.pid}-${Math.random().toString(36).slice(2)}.aiff`);
  try {
    await run('say', ['-v', opts.voice, '-o', scratch, text]);
    // Mono at a low bitrate: speech stays clear and the files stay small.
    await run('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', String(opts.bitrate), '-c', '1', scratch, outPath]);
  } finally {
    if (existsSync(scratch)) rmSync(scratch, { force: true });
  }
}

/** Write encoded audio bytes, transcoding to m4a so every engine lands the same. */
async function writeAsM4a(buf, outPath, ext) {
  const scratch = join(tmpdir(), `spectra-tts-${process.pid}-${Math.random().toString(36).slice(2)}.${ext}`);
  writeFileSync(scratch, buf);
  try {
    await run('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', String(opts.bitrate), '-c', '1', scratch, outPath]);
  } finally {
    if (existsSync(scratch)) rmSync(scratch, { force: true });
  }
}

async function renderWithOpenAI(text, outPath) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: opts.voice, input: text, response_format: 'mp3' }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${await res.text()}`);
  await writeAsM4a(Buffer.from(await res.arrayBuffer()), outPath, 'mp3');
}

/** ElevenLabs — `--voice` is a voice_id from your voice library. */
async function renderWithElevenLabs(text, outPath) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${opts.voice}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2' }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  await writeAsM4a(Buffer.from(await res.arrayBuffer()), outPath, 'mp3');
}

/** Google Cloud TTS — `--voice` is a full name like en-US-Neural2-D. */
async function renderWithGoogle(text, outPath) {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) throw new Error('GOOGLE_TTS_API_KEY is not set');
  const languageCode = opts.voice.split('-').slice(0, 2).join('-') || 'en-US';
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode, name: opts.voice },
      audioConfig: { audioEncoding: 'MP3' },
    }),
  });
  if (!res.ok) throw new Error(`Google TTS ${res.status}: ${await res.text()}`);
  const { audioContent } = await res.json();
  await writeAsM4a(Buffer.from(audioContent, 'base64'), outPath, 'mp3');
}

/** Azure Speech — `--voice` is a short name like en-US-GuyNeural. Needs AZURE_TTS_REGION. */
async function renderWithAzure(text, outPath) {
  const key = process.env.AZURE_TTS_KEY;
  const region = process.env.AZURE_TTS_REGION;
  if (!key || !region) throw new Error('AZURE_TTS_KEY and AZURE_TTS_REGION must be set');
  const lang = opts.voice.split('-').slice(0, 2).join('-') || 'en-US';
  const ssml =
    `<speak version='1.0' xml:lang='${lang}'><voice xml:lang='${lang}' name='${opts.voice}'>` +
    `${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</voice></speak>`;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${await res.text()}`);
  await writeAsM4a(Buffer.from(await res.arrayBuffer()), outPath, 'mp3');
}

/**
 * Piper — local neural TTS. Free, offline, and far more natural than `say`.
 * Point PIPER_BIN / PIPER_MODEL at your install; `--voice` is ignored here
 * because the model file *is* the voice.
 */
async function renderWithPiper(text, outPath) {
  const bin = process.env.PIPER_BIN ?? join(homedir(), '.local/share/piper-venv/bin/piper');
  const model =
    process.env.PIPER_MODEL ??
    join(homedir(), '.local/share/piper-voices', `${opts.voice}.onnx`);
  if (!existsSync(model)) {
    throw new Error(`Piper model not found: ${model} (set PIPER_MODEL or --voice <model-name>)`);
  }
  const stem = join(tmpdir(), `spectra-piper-${process.pid}-${Math.random().toString(36).slice(2)}`);
  const txt = `${stem}.txt`;
  const wav = `${stem}.wav`;
  try {
    writeFileSync(txt, text);
    await run(bin, ['-m', model, '-i', txt, '-f', wav]);
    await run('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', String(opts.bitrate), '-c', '1', wav, outPath]);
  } finally {
    for (const f of [txt, wav]) if (existsSync(f)) rmSync(f, { force: true });
  }
}

const RENDERERS = {
  say: renderWithSay,
  piper: renderWithPiper,
  openai: renderWithOpenAI,
  elevenlabs: renderWithElevenLabs,
  google: renderWithGoogle,
  azure: renderWithAzure,
};
const render = RENDERERS[opts.engine];
if (!render) {
  console.error(`Unknown engine "${opts.engine}". Available: ${Object.keys(RENDERERS).join(', ')}`);
  process.exit(1);
}

// ---- pipeline -------------------------------------------------------------
async function renderPool(poolId, file) {
  const path = join(SRC, file);
  if (!existsSync(path)) {
    console.error(`MISSING ${path} — run the pool download first.`);
    return null;
  }
  const questions = JSON.parse(readFileSync(path, 'utf8'));
  const dir = join(OUT, poolId);
  mkdirSync(dir, { recursive: true });

  const manifestPath = join(dir, 'manifest.json');
  const prev = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { items: {} };
  const manifest = {
    engine: opts.engine,
    voice: opts.voice,
    bitrate: opts.bitrate,
    // A partial run (--limit) must not drop clips it didn't look at.
    items: opts.limit ? { ...(prev.items ?? {}) } : {},
  };

  const work = (opts.limit ? questions.slice(0, opts.limit) : questions).map((q) => {
    const text = narrationText(q);
    return { id: q.id, text, hash: hashOf(text) };
  });

  let done = 0;
  let rendered = 0;
  let skipped = 0;
  let failed = 0;

  // Fixed-size worker pool; `say` is CPU-bound so a few at a time is plenty.
  const queue = [...work];
  const workers = Array.from({ length: Math.max(1, opts.concurrency) }, async () => {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      const outPath = join(dir, `${item.id}.m4a`);
      const cached = prev.items?.[item.id];
      const upToDate =
        !opts.force && cached?.hash === item.hash && existsSync(outPath) && statSync(outPath).size > 0;

      if (upToDate) {
        manifest.items[item.id] = cached;
        skipped++;
      } else {
        try {
          await render(item.text, outPath);
          manifest.items[item.id] = { hash: item.hash, bytes: statSync(outPath).size };
          rendered++;
        } catch (err) {
          console.error(`  ! ${item.id}: ${err.message}`);
          failed++;
        }
      }
      if (++done % 25 === 0 || done === work.length) {
        process.stdout.write(`\r  ${poolId}: ${done}/${work.length}   `);
      }
    }
  });
  await Promise.all(workers);

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const bytes = Object.values(manifest.items).reduce((s, i) => s + (i.bytes ?? 0), 0);
  process.stdout.write('\r');
  console.log(
    `${poolId.padEnd(11)} rendered ${rendered}  cached ${skipped}  failed ${failed}  ` +
      `total ${(bytes / 1e6).toFixed(1)} MB`,
  );
  return bytes;
}

/**
 * Voice audition: speak one identical line in every candidate voice, so you can
 * play them against a reference recording and pick the match by ear. Nothing is
 * downloaded or copied — we just render the same sentence many ways.
 */
async function renderSamples() {
  const dir = join(OUT, '_samples');
  mkdirSync(dir, { recursive: true });
  const line =
    'Which agency regulates and enforces the rules for the Amateur Radio Service in the United States? ' +
    'A. ARRL. B. Homeland Security. C. The FCC. D. All these choices are correct.';

  /** @type {{engine: string, voice: string}[]} */
  const candidates = [];

  if (opts.engine === 'say') {
    const { stdout } = await run('say', ['-v', '?']);
    const voices = stdout
      .split('\n')
      .map((l) => l.match(/^(.+?)\s{2,}(en_[A-Z]{2})\s/))
      .filter(Boolean)
      .map((m) => m[1].trim())
      // Skip the novelty voices — they're not narration candidates.
      .filter((v) => !/bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert/i.test(v));
    for (const v of voices) candidates.push({ engine: 'say', voice: v });
  } else {
    candidates.push({ engine: opts.engine, voice: opts.voice });
  }

  console.log(`auditioning ${candidates.length} voice(s) -> ${dir}`);
  for (const c of candidates) {
    const outPath = join(dir, `${c.engine}-${c.voice.replace(/\s+/g, '_')}.m4a`);
    try {
      const savedVoice = opts.voice;
      opts.voice = c.voice;
      await RENDERERS[c.engine](line, outPath);
      opts.voice = savedVoice;
      console.log(`  ${c.engine.padEnd(11)} ${c.voice.padEnd(16)} ${(statSync(outPath).size / 1024).toFixed(0)} KB`);
    } catch (err) {
      console.error(`  ! ${c.voice}: ${err.message}`);
    }
  }
  console.log(`\nPlay them:  open ${dir}`);
  console.log('Pick the closest match, then render everything with:');
  console.log('  npm run narrate -- --engine <engine> --voice "<voice>"');
}

if (opts.sample) {
  await renderSamples();
  process.exit(0);
}

const pools = opts.pool ? { [opts.pool]: POOLS[opts.pool] } : POOLS;
if (opts.pool && !POOLS[opts.pool]) {
  console.error(`Unknown pool "${opts.pool}". Available: ${Object.keys(POOLS).join(', ')}`);
  process.exit(1);
}

console.log(`engine=${opts.engine} voice=${opts.voice} bitrate=${opts.bitrate} concurrency=${opts.concurrency}`);
let grand = 0;
for (const [id, file] of Object.entries(pools)) {
  const bytes = await renderPool(id, file);
  if (bytes) grand += bytes;
}
console.log(`total audio ${(grand / 1e6).toFixed(1)} MB in public/exam/audio/`);
