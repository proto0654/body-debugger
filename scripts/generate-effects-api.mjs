#!/usr/bin/env node
/**
 * Generate the shared sound effects through the ElevenLabs Sound Effects API.
 *
 * Usage:
 *   node scripts/generate-effects-api.mjs --dry-run
 *   node scripts/generate-effects-api.mjs --event popup,done --limit 2
 *   node scripts/generate-effects-api.mjs --skip-existing
 *
 * The catalog (src/assets/sounds/production.json) owns prompts, target and maximum
 * durations and output names. The Sound Effects API rejects durations below 0.5 s,
 * so a shorter target is requested at 0.5 s and trimmed afterwards. This script never
 * edits the catalog; it appends take records to src/assets/sounds/api-report.json.
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
const MIN_DURATION_SEC = 0.5;

function parseArgs(argv) {
  const out = { take: 1, events: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      return value;
    };
    if (arg === '--event') out.events = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--take') out.take = Number(next());
    else if (arg === '--limit') out.limit = Number(next());
    else if (arg === '--model') out.model = next();
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--skip-existing') out.skipExisting = true;
    else if (arg === '--retrim') out.retrim = true;
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

function probeDuration(file) {
  const raw = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file],
    { encoding: 'utf8' },
  ).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

// Short cues decay quickly, so only leading silence is removed: a trailing cut
// removes the tail of the sound itself and can leave a click.
function trimSilence(raw, target) {
  execFileSync(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', raw,
      '-af', 'silenceremove=start_periods=1:start_threshold=-40dB',
      '-c:a', 'libmp3lame', '-b:a', '192k',
      target,
    ],
    { stdio: 'inherit' },
  );
}

async function synthesize(key, prompt, durationSeconds, model) {
  const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': key, Accept: 'audio/mpeg', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: prompt,
      duration_seconds: durationSeconds,
      prompt_influence: 0.5,
      model_id: model,
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) return { ok: false, status: response.status, detail: await response.text() };
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

function updateReportDuration(effectId, takeNumber, duration, max) {
  if (!fs.existsSync(REPORT_PATH)) return null;
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const record = report.find((item) => item.effectId === effectId && item.takeNumber === takeNumber);
  if (!record) return null;
  const status = duration && max && duration > max + 0.05 ? 'over-budget' : 'pending';
  record.measuredDurationSec = duration;
  record.status = status;
  record.retrimmedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return status;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const key = readKey();
  const model = args.model || catalog.candidateEffectsModel || 'eleven_text_to_sound_v2';

  const queue = catalog.effects.filter((effect) => !args.events || args.events.includes(effect.event));
  console.log(`effects=${catalog.effects.length} selected=${queue.length} model=${model}`);
  for (const effect of queue) {
    const target = path.join(SOUNDS_ROOT, 'system', effect.outputFile.replace(/__take-\d+\.mp3$/i, `__take-${args.take}.mp3`));
    console.log(`  ${effect.id}  target ${effect.targetDurationSec}s  max ${effect.maxDurationSec}s  ${path.relative(ROOT, target)}`);
  }
  if (args.dryRun) return;

  if (args.retrim) {
    const sourceDir = path.join(SOUNDS_ROOT, 'system', 'source');
    for (const effect of queue) {
      const prefix = `api__${effect.id}__take-`;
      const files = fs.existsSync(sourceDir)
        ? fs.readdirSync(sourceDir).filter((name) => name.startsWith(prefix) && name.endsWith('.mp3'))
        : [];
      for (const file of files) {
        const take = Number(file.slice(prefix.length).replace(/\.mp3$/, ''));
        const delivery = path.join(
          SOUNDS_ROOT, 'system', effect.outputFile.replace(/__take-\d+\.mp3$/i, `__take-${take}.mp3`),
        );
        trimSilence(path.join(sourceDir, file), delivery);
        const duration = probeDuration(delivery);
        const status = updateReportDuration(effect.id, take, duration, Number(effect.maxDurationSec) || null) ?? 'pending';
        console.log(`retrim ${path.basename(delivery)} ${duration?.toFixed(2)}s (max ${effect.maxDurationSec}s) -> ${status}`);
      }
    }
    console.log('done');
    return;
  }

  for (const effect of queue.slice(0, args.limit)) {
    const delivery = path.join(SOUNDS_ROOT, 'system', effect.outputFile.replace(/__take-\d+\.mp3$/i, `__take-${args.take}.mp3`));
    if (fs.existsSync(delivery) && !args.force) {
      console.log(`skip existing ${path.relative(ROOT, delivery)} (use --force to overwrite)`);
      continue;
    }
    if (args.skipExisting && fs.existsSync(delivery)) continue;

    const requested = Math.min(Math.max(Number(effect.targetDurationSec), MIN_DURATION_SEC), 30);
    const raw = path.join(SOUNDS_ROOT, 'system', 'source', `api__${effect.id}__take-${args.take}.mp3`);
    fs.mkdirSync(path.dirname(raw), { recursive: true });

    console.log(`generate ${effect.id} at ${requested}s ...`);
    const result = await synthesize(key, effect.prompt, requested, model);
    if (!result.ok) {
      console.log(`  FAILED ${result.status}: ${String(result.detail).slice(0, 300)}`);
      appendReport({
        effectId: effect.id,
        kind: 'effect',
        characterId: 'system',
        event: effect.event,
        takeNumber: args.take,
        model,
        inputText: effect.prompt,
        requestedDurationSec: requested,
        status: `failed-${result.status}`,
        generatedAt: new Date().toISOString(),
      });
      continue;
    }

    fs.writeFileSync(raw, result.bytes);
    try {
      trimSilence(raw, delivery);
    } catch (error) {
      console.log(`  ffmpeg failed: ${error.message}`);
      fs.copyFileSync(raw, delivery);
    }

    const duration = probeDuration(delivery);
    const max = Number(effect.maxDurationSec) || null;
    const status = duration && max && duration > max + 0.05 ? 'over-budget' : 'pending';
    console.log(`  ok ${duration?.toFixed(2)}s (target ${effect.targetDurationSec}s, max ${max}s) -> ${status}`);
    appendReport({
      effectId: effect.id,
      kind: 'effect',
      characterId: 'system',
      event: effect.event,
      takeNumber: args.take,
      model,
      inputText: effect.prompt,
      requestedDurationSec: requested,
      rawFile: path.relative(ROOT, raw).replace(/\\/g, '/'),
      deliveryFile: path.relative(ROOT, delivery).replace(/\\/g, '/'),
      measuredDurationSec: duration,
      maxDurationSec: max,
      status,
      generatedAt: new Date().toISOString(),
    });
  }
  console.log('done');
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
