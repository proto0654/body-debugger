#!/usr/bin/env node
/**
 * Cast a character voice through the ElevenLabs Voice Design API.
 *
 * Usage:
 *   node scripts/cast-voices-api.mjs --character punk --dry-run
 *   node scripts/cast-voices-api.mjs --character punk
 *   node scripts/cast-voices-api.mjs --missing --preview 1
 *
 * Voice Design returns its previews in one response; there is no request option
 * for a single preview. The script archives every preview and saves the numbered
 * one (default: the first) as a permanent account voice, then patches the catalog
 * with the saved voice ID, candidates and selection history.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'src', 'assets', 'sounds', 'production.json');
const SOUNDS_ROOT = path.join(ROOT, 'src', 'assets', 'sounds');
const ENV_PATH = path.join(ROOT, '.env');
const API = 'https://api.elevenlabs.io/v1';
const VOICE_DESIGN_MODEL = 'eleven_multilingual_ttv_v2';
const VOICE_NAME_PREFIX = 'Body Debugger - ';
const METADATA_DESCRIPTION_LIMIT = 500;

function parseArgs(argv) {
  const out = { preview: 1 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      return value;
    };
    if (arg === '--character') out.character = next();
    else if (arg === '--preview') out.preview = Number(next());
    else if (arg === '--missing') out.missing = true;
    else if (arg === '--dry-run') out.dryRun = true;
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

function voiceName(characterId) {
  return `${VOICE_NAME_PREFIX}${characterId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')}`;
}

async function api(key, url, body, accept) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: accept },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${url} ${response.status}: ${text.slice(0, 400)}`);
  return response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : { text };
}

function writeCatalog(catalog) {
  fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
}

async function castCharacter(key, catalog, character, options) {
  const name = voiceName(character.id);
  console.log(`${character.id}: designing "${name}" (${character.voiceDesignPrompt.length} chars)`);
  const design = await api(
    key,
    `${API}/text-to-voice/design`,
    {
      voice_description: character.voiceDesignPrompt,
      text: character.previewText,
      model_id: VOICE_DESIGN_MODEL,
      quality: 0.9,
      loudness: 0.5,
    },
    'application/json',
  );

  const previews = design.previews ?? [];
  if (!previews.length) throw new Error(`${character.id}: no previews returned`);
  const selected = previews[options.preview - 1];
  if (!selected) throw new Error(`${character.id}: preview ${options.preview} does not exist (${previews.length})`);

  const sourceDir = path.join(SOUNDS_ROOT, character.id, 'source');
  fs.mkdirSync(sourceDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  previews.forEach((preview, index) => {
    const file = path.join(sourceDir, `design__${character.id}__candidate-${index + 1}__${date}.mp3`);
    fs.writeFileSync(file, Buffer.from(preview.audio_base_64, 'base64'));
    console.log(`  preview ${index + 1}: ${preview.duration_secs?.toFixed(2)}s -> ${path.relative(ROOT, file)}`);
  });

  const description = character.voiceDesignPrompt.slice(0, METADATA_DESCRIPTION_LIMIT);
  const created = await api(
    key,
    `${API}/text-to-voice`,
    { voice_name: name, voice_description: description, generated_voice_id: selected.generated_voice_id },
    'application/json',
  );
  if (!created.voice_id) throw new Error(`${character.id}: voice creation returned no voice_id`);
  console.log(`  saved ${created.voice_id} as "${name}"`);

  character.selectedVoiceId = created.voice_id;
  character.usedModel = catalog.candidateSpeechModel;
  character.castingCandidates = previews.map((_, index) => ({
    previewNumber: index + 1,
    voiceId: index + 1 === options.preview ? created.voice_id : null,
    selected: index + 1 === options.preview,
  }));
  character.selectionHistory = [
    ...(character.selectionHistory ?? []),
    {
      date,
      voiceId: created.voice_id,
      model: catalog.candidateSpeechModel,
      candidateNumber: options.preview,
      method: 'api-first-preview',
      notes:
        `Voice Design API (${VOICE_DESIGN_MODEL}) returned ${previews.length} previews in one response; ` +
        `the request has no option for a single preview, so preview ${options.preview} was saved without auditioning. ` +
        `All previews are archived under source/design__${character.id}__candidate-<n>__${date}.mp3. ` +
        `Provider voice description truncated to ${METADATA_DESCRIPTION_LIMIT} characters; generation prompt unchanged.`,
    },
  ];
  return created.voice_id;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.character && !args.missing) throw new Error('Pass --character <id> or --missing');
  const key = readKey();
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

  const targets = catalog.characters.filter((character) => {
    if (args.character) return character.id === args.character;
    return !character.selectedVoiceId;
  });
  if (!targets.length) throw new Error(`No matching character: ${args.character ?? 'all already cast'}`);
  for (const character of targets) {
    if (character.selectedVoiceId) throw new Error(`${character.id} already has selectedVoiceId ${character.selectedVoiceId}`);
    console.log(`${character.id} -> ${voiceName(character.id)}`);
  }
  if (args.dryRun) return;

  for (const character of targets) {
    await castCharacter(key, catalog, character, args);
    writeCatalog(catalog);
  }
  console.log(`cast ${targets.length} voice(s); catalog updated`);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
