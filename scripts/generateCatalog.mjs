/**
 * generateCatalog.mjs
 * Run: npm run catalog
 *
 * Scans public/ejercicioimg/ejercicios/ and generates
 * src/data/imageManifest.ts — the single source of truth for
 * which exercises appear in the workout catalog.
 *
 * Folder convention:
 *   Muscle/                     → muscle group root
 *     Image.png                 → standalone (no variants), VISIBLE
 *     ocultos/Image.png         → standalone, LOCKED
 *     VariantGroup/             → variant group
 *       Image.png               → variant, VISIBLE
 *       ocultos/Image.png       → variant, LOCKED
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'public', 'ejercicioimg', 'ejercicios');
const OUTPUT = path.join(__dirname, '..', 'src', 'data', 'imageManifest.ts');

// Folder name → catalog muscle label (getMuscleGroup-compatible)
const MUSCLE_MAP = {
  'Abdomen':        'ABDOMINALES',
  'Antebrazo':      'ANTEBRAZO',
  'Biceps':         'BÍCEPS',
  'Cardio':         'CARDIO',
  'Cuello':         'CUELLO',
  'Espalda':        'ESPALDA',
  'Gemelos':        'PANTORRILLAS',
  'Gluteo':         'GLÚTEOS',
  'Hombro':         'HOMBRO',
  'Isquiotibiales': 'ISQUIOTIBIALES',
  'pecho':          'PECHO',
  'Pierna':         'CUÁDRICEPS',
  'Trapecios':      'ESPALDA',
  'Triceps':        'TRÍCEPS',
};

/** Convert a filename to a human-readable display name */
function toDisplayName(filename) {
  let name = filename
    .replace(/\.png$/i, '')
    .replace(/-Photoroom/i, '')
    .replace(/ \(\d+\)$/, '')     // remove trailing "(2)" etc.
    .trim();

  // Split CamelCase only when letters are directly adjacent (no spaces)
  if (!name.includes(' ')) {
    name = name
      .replace(/([a-záéíóúüñ])([A-ZÁÉÍÓÚÜÑ])/g, '$1 $2')
      .replace(/([A-ZÁÉÍÓÚÜÑ]{2,})([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ])/g, '$1 $2');
  }
  return name.replace(/\s+/g, ' ').trim();
}

/** Make a filesystem-safe id from a display name */
function toId(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Read .png files from a directory (non-recursive) */
function readPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.png'));
}

/** Build the image path relative to /public */
function imgUrl(muscleFolderName, ...parts) {
  return `/ejercicioimg/ejercicios/${muscleFolderName}/${parts.join('/')}`;
}

// ── Main scan ────────────────────────────────────────────────────────────────

const results = [];

for (const [folderName, muscle] of Object.entries(MUSCLE_MAP)) {
  const musclePath = path.join(ROOT, folderName);
  if (!fs.existsSync(musclePath)) continue;

  const items = fs.readdirSync(musclePath, { withFileTypes: true });

  for (const item of items) {
    if (item.isFile() && item.name.toLowerCase().endsWith('.png')) {
      // ── Standalone exercise (no variants) ──────────────────────────────
      const name = toDisplayName(item.name);
      results.push({
        id:           toId(name),
        name,
        muscle,
        folderName,
        imagePath:    imgUrl(folderName, item.name),
        isLocked:     false,
        variantGroup: null,
        variants:     [],
      });

    } else if (item.isDirectory() && item.name !== 'ocultos') {
      // ── Variant group ────────────────────────────────────────────────────
      const variantDir = path.join(musclePath, item.name);
      const groupName  = item.name;
      const visiblePngs = readPngs(variantDir);
      const lockedPngs  = readPngs(path.join(variantDir, 'ocultos'));

      const variants = [
        ...visiblePngs.map(f => ({
          id:        toId(toDisplayName(f)),
          name:      toDisplayName(f),
          imagePath: imgUrl(folderName, groupName, f),
          isLocked:  false,
        })),
        ...lockedPngs.map(f => ({
          id:        toId(toDisplayName(f)),
          name:      toDisplayName(f),
          imagePath: imgUrl(folderName, groupName, 'ocultos', f),
          isLocked:  true,
        })),
      ];

      if (variants.length === 0) continue;

      // The base exercise name = variant group folder name (cleaned)
      const baseName = toDisplayName(groupName);
      results.push({
        id:           toId(baseName + '_' + folderName),
        name:         baseName,
        muscle,
        folderName,
        imagePath:    variants.find(v => !v.isLocked)?.imagePath ?? variants[0].imagePath,
        isLocked:     variants.every(v => v.isLocked),
        variantGroup: groupName,
        variants,
      });
    }
  }

  // ── Locked standalones in ocultos/ ────────────────────────────────────────
  const lockedPngs = readPngs(path.join(musclePath, 'ocultos'));
  for (const f of lockedPngs) {
    const name = toDisplayName(f);
    results.push({
      id:           toId(name),
      name,
      muscle,
      folderName,
      imagePath:    imgUrl(folderName, 'ocultos', f),
      isLocked:     true,
      variantGroup: null,
      variants:     [],
    });
  }
}

// ── Write output ─────────────────────────────────────────────────────────────

const ts = `// AUTO-GENERATED by scripts/generateCatalog.mjs — DO NOT EDIT MANUALLY
// Run "npm run catalog" to regenerate after moving images.
// Generated: ${new Date().toISOString()}

export interface ManifestVariant {
  id: string;
  name: string;
  imagePath: string;
  isLocked: boolean;
}

export interface ManifestExercise {
  id: string;
  name: string;
  muscle: string;
  folderName: string;
  imagePath: string;
  isLocked: boolean;
  variantGroup: string | null;
  variants: ManifestVariant[];
}

export const IMAGE_MANIFEST: ManifestExercise[] = ${JSON.stringify(results, null, 2)};

/** All exercises that have variants (main card = base, arrows cycle variants) */
export const MANIFEST_WITH_VARIANTS = IMAGE_MANIFEST.filter(e => e.variants.length > 1);

/** Standalone exercises (single image, no variant cycling) */
export const MANIFEST_STANDALONE = IMAGE_MANIFEST.filter(e => e.variants.length <= 1);
`;

fs.writeFileSync(OUTPUT, ts, 'utf8');
console.log(`✅ Generated ${results.length} exercises → ${OUTPUT}`);

// Summary
const byMuscle = {};
for (const e of results) {
  byMuscle[e.muscle] = (byMuscle[e.muscle] || 0) + 1;
}
for (const [m, c] of Object.entries(byMuscle).sort()) {
  const locked = results.filter(e => e.muscle === m && e.isLocked).length;
  console.log(`  ${m}: ${c} (${locked} locked)`);
}
