#!/usr/bin/env node
/**
 * Generate character voice clips through the ElevenLabs API, one clip per request.
 *
 * Usage:
 *   node scripts/generate-audio-api.mjs --character desk-hulk --event ready --limit 3 --dry-run
 *   node scripts/generate-audio-api.mjs --character desk-hulk --event ready,done --limit 3
 *   node scripts/generate-audio-api.mjs --character punk --all --skip-existing
 *
 * The catalog (src/assets/sounds/production.json) is the source of truth for text,
 * output names and duration budgets. This script never edits the catalog; it writes
 * a take report to src/assets/sounds/api-report.json instead.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'src', 'assets', 'sounds', 'production.json');
const REPORT_PATH = path.join(ROOT, 'src', 'assets', 'sounds', 'api-report.json');
const SOUNDS_ROOT = path.join(ROOT, 'src', 'assets', 'sounds');
const ENV_PATH = path.join(ROOT, '.env');

const RUNTIME_EVENTS = ['ready', 'done', 'skipped', 'snoozed', 'stage-up', 'error', 'alert'];
const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true,
};

function parseArgs(argv) {
  const out = { take: 1, limit: Infinity, events: null, all: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      return value;
    };
    if (arg === '--character') out.character = next();
    else if (arg === '--event') out.events = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--limit') out.limit = Number(next());
    else if (arg === '--take') out.take = Number(next());
    else if (arg === '--model') out.model = next();
    else if (arg === '--output-format') out.outputFormat = next();
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--skip-existing') out.skipExisting = true;
    else if (arg === '--no-trim') out.noTrim = true;
    else if (arg === '--all') out.all = true;
    else if (arg === '--force') out.force = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function readKey() {
  if (!fs.existsSync(ENV_PATH)) throw new Error(`Missing ${ENV_PATH}`);
  const line = fs
    .readFileSync(ENV_PATH, 'utf8')
    .split(/\r?\n/)
    .filter((row) => /^\s*ELEVENLABS_API_KEY\s*=/.test(row))
    .pop();
  if (!line) throw new Error('ELEVENLABS_API_KEY is not set in .env');
  const key = line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  if (!key) throw new Error('ELEVENLABS_API_KEY is empty in .env');
  return key;
}

function outputPath(clip, characterId, take) {
  const name = String(clip.outputFile).replace(/__take-\d+\.mp3$/i, `__take-${take}.mp3`);
  return path.join(SOUNDS_ROOT, characterId, name);
}

function rawPath(clip, characterId, take) {
  return path.join(SOUNDS_ROOT, characterId, 'source', `api__${clip.id}__take-${take}.mp3`);
}

function probeDuration(file) {
  const raw = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file],
    { encoding: 'utf8' },
  ).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function trimSilence(raw, target) {
  execFileSync(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', raw,
      '-af', 'silenceremove=start_periods=1:start_threshold=-40dB:stop_periods=1:stop_threshold=-40dB:stop_duration=0.1',
      '-c:a', 'libmp3lame', '-b:a', '192k',
      target,
    ],
    { stdio: 'inherit' },
  );
}

async function apiJson(key, url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { 'xi-api-key': key, Accept: 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(120000),
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { response, body };
}

async function credits(key) {
  const { response, body } = await apiJson(key, 'https://api.elevenlabs.io/v1/user/subscription');
  if (!response.ok) throw new Error(`subscription ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return Number(body.character_count);
}

async function synthesize(key, voiceId, text, model, format) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(format)}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, model_id: model, voice_settings: DEFAULT_VOICE_SETTINGS }),
      signal: AbortSignal.timeout(180000),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    return { ok: false, status: response.status, detail };
  }
  return { ok: true, bytes: Buffer.from(await response.arrayBuffer()) };
}

function appendReport(entry) {
  let report = [];
  if (fs.existsSync(REPORT_PATH)) {
    try { report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')); } catch { report = []; }
  }
  report.push(entry);
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const key = readKey();

  const events = args.all ? null : args.events || RUNTIME_EVENTS;
  const characters = catalog.characters.filter((c) => !args.character || c.id === args.character);
  if (!characters.length) throw new Error(`Unknown character: ${args.character}`);

  const selected = [];
  for (const character of characters) {
    if (!character.selectedVoiceId) {
      console.log(`skip ${character.id}: no selectedVoiceId (cast the voice first)`);
      continue;
    }
    for (const clip of character.clips || []) {
      if (events && !events.includes(clip.event)) continue;
      const target = outputPath(clip, character.id, args.take);
      if (args.skipExisting && fs.existsSync(target)) continue;
      selected.push({ character, clip, target });
    }
  }

  const queue = selected.slice(0, args.limit);
  console.log(`characters=${characters.length} selected=${queue.length} take=${args.take}`);
  for (const item of queue) {
    console.log(`  ${item.clip.id}  ${item.clip.maxDurationSec}s  ${path.relative(ROOT, item.target)}`);
  }
  if (args.dryRun) return;
  if (!queue.length) return;

  const model = args.model || catalog.candidateSpeechModel || 'eleven_v4';
  const format = args.outputFormat || 'mp3_44100_192';
  const before = await credits(key);
  console.log(`credits before: ${before}`);

  const results = [];
  for (const item of queue) {
    const { character, clip, target } = item;
    if (fs.existsSync(target) && !args.force) {
      console.log(`skip existing ${path.relative(ROOT, target)} (use --force to overwrite)`);
      continue;
    }
    const raw = rawPath(clip, character.id, args.take);
    fs.mkdirSync(path.dirname(raw), { recursive: true });

    console.log(`generate ${clip.id} ...`);
    let result = await synthesize(key, character.selectedVoiceId, clip.taggedText, model, format);
    if (!result.ok && result.status === 422 && format !== 'mp3_44100_128') {
      console.log('  format rejected, retrying mp3_44100_128');
      result = await synthesize(key, character.selectedVoiceId, clip.taggedText, model, 'mp3_44100_128');
    }
    if (!result.ok) {
      console.log(`  FAILED ${result.status}: ${String(result.detail).slice(0, 300)}`);
      results.push({ clipId: clip.id, status: `failed-${result.status}` });
      continue;
    }

    fs.writeFileSync(raw, result.bytes);
    try {
      if (args.noTrim) {
        fs.copyFileSync(raw, target);
      } else {
        trimSilence(raw, target);
      }
    } catch (error) {
      console.log(`  ffmpeg failed: ${error.message}`);
      fs.copyFileSync(raw, target);
    }

    const duration = probeDuration(target);
    const max = Number(clip.maxDurationSec) || null;
    const status = duration && max && duration > max + 0.05 ? 'over-budget' : 'pending';
    console.log(`  ok ${duration?.toFixed(2)}s (max ${max}s) -> ${status}`);
    results.push({ clipId: clip.id, duration, max, status });
    appendReport({
      clipId: clip.id,
      characterId: character.id,
      event: clip.event,
      takeNumber: args.take,
      voiceId: character.selectedVoiceId,
      model,
      outputFormat: format,
      inputText: clip.taggedText,
      rawFile: path.relative(ROOT, raw).replace(/\\/g, '/'),
      deliveryFile: path.relative(ROOT, target).replace(/\\/g, '/'),
      measuredDurationSec: duration,
      maxDurationSec: max,
      status,
      generatedAt: new Date().toISOString(),
    });
  }

  const after = await credits(key);
  console.log(`credits after: ${after}  delta: ${after - before}`);
  const ok = results.filter((r) => r.status !== 'failed-401' && !String(r.status).startsWith('failed')).length;
  console.log(`done: ${ok}/${results.length}`);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
