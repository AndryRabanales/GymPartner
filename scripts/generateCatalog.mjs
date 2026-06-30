/**
 * generateCatalog.mjs
 * Run: npm run catalog
 *
 * Scans public/ejercicioimg/ejercicios/ and generates:
 *   src/data/imageManifest.ts  — flat list of all exercise images
 *   src/data/catalogData.ts    — structured catalog (replaces CURATED_EXERCISES hardcode)
 *
 * Folder convention:
 *   MuscleGroup/                     → muscle group root
 *     Image.png                      → standalone exercise (name = filename without ext)
 *     ExerciseName/                  → variant group (exercise name = folder name)
 *       Variant.png                  → variant (name = filename without ext)
 *       ocultos/Variant.png          → locked variant (not shown)
 *     ocultos/Image.png              → locked standalone
 *
 * SeedName format:
 *   Variant exercise:  "ExerciseName (VariantName)"
 *   Standalone:        "ExerciseName"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT   = path.join(__dirname, '..', 'public', 'ejercicioimg', 'ejercicios');
const OUT_MANIFEST = path.join(__dirname, '..', 'src', 'data', 'imageManifest.ts');
const OUT_CATALOG  = path.join(__dirname, '..', 'src', 'data', 'catalogData.ts');

// ── Maps ─────────────────────────────────────────────────────────────────────

/** Filesystem folder name → catalog muscle label */
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

/** Default emoji icon per muscle group (fallback when no image) */
const MUSCLE_ICON = {
  ABDOMINALES:    '🥨',
  ANTEBRAZO:      '🦾',
  'BÍCEPS':       '💪',
  CARDIO:         '🚴',
  CUELLO:         '💆',
  ESPALDA:        '🚣',
  PANTORRILLAS:   '🦵',
  'GLÚTEOS':      '🍑',
  HOMBRO:         '🐦',
  'ISQUIOTIBIALES':'🎋',
  PECHO:          '🏋️‍♂️',
  'CUÁDRICEPS':   '🍑',
  'TRÍCEPS':      '🏇',
};

/** Default metrics per muscle group */
const MUSCLE_METRICS = {
  CARDIO: { weight: false, reps: false, time: true, distance: true, rpe: false },
};
const DEFAULT_METRICS = { weight: true, reps: true, time: false, distance: false, rpe: false };

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDisplayName(filename) {
  let name = filename
    .replace(/\.png$/i, '')
    .replace(/-Photoroom/i, '')
    .replace(/ \(\d+\)$/, '')
    .trim();
  if (!name.includes(' ')) {
    name = name
      .replace(/([a-záéíóúüñ])([A-ZÁÉÍÓÚÜÑ])/g, '$1 $2')
      .replace(/([A-ZÁÉÍÓÚÜÑ]{2,})([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ])/g, '$1 $2');
  }
  return name.replace(/\s+/g, ' ').trim();
}

function toId(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function readPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.png'));
}

function imgUrl(muscleFolderName, ...parts) {
  return `/ejercicioimg/ejercicios/${muscleFolderName}/${parts.join('/')}`;
}

// ── Main scan ─────────────────────────────────────────────────────────────────

const manifestResults = [];  // flat list for imageManifest.ts
const catalogResults  = [];  // structured list for catalogData.ts

for (const [folderName, muscle] of Object.entries(MUSCLE_MAP)) {
  const musclePath = path.join(ROOT, folderName);
  if (!fs.existsSync(musclePath)) continue;

  const metrics = MUSCLE_METRICS[muscle] ?? DEFAULT_METRICS;
  const icon    = MUSCLE_ICON[muscle] ?? '💪';
  const items   = fs.readdirSync(musclePath, { withFileTypes: true });

  for (const item of items) {
    if (item.isFile() && item.name.toLowerCase().endsWith('.png')) {
      // ── Standalone exercise ──────────────────────────────────────────────
      const displayName = toDisplayName(item.name);
      const seedName    = displayName;  // standalone: seedName = file name
      const imagePath   = imgUrl(folderName, item.name);

      manifestResults.push({
        id: toId(displayName), name: displayName, muscle, folderName,
        imagePath, isLocked: false, variantGroup: null, variants: [],
      });

      catalogResults.push({
        id:       toId(displayName + '_' + folderName),
        name:     displayName,
        muscle,
        icon,
        metrics,
        imagePath,
        isLocked: false,
        variants: [{ id: toId(displayName), label: displayName, seedName, imagePath, isLocked: false }],
        _standalone: true,
      });

    } else if (item.isDirectory() && item.name !== 'ocultos') {
      // ── Variant group ────────────────────────────────────────────────────
      const variantDir  = path.join(musclePath, item.name);
      const groupName   = item.name;
      const baseName    = groupName;  // folder name IS the exercise display name

      const visiblePngs = readPngs(variantDir);
      const lockedPngs  = readPngs(path.join(variantDir, 'ocultos'));

      const allVariants = [
        ...visiblePngs.map(f => {
          const variantLabel = toDisplayName(f);
          return {
            id:        toId(variantLabel),
            name:      variantLabel,
            imagePath: imgUrl(folderName, groupName, f),
            isLocked:  false,
            label:     variantLabel,
            seedName:  `${baseName} (${variantLabel})`,
          };
        }),
        ...lockedPngs.map(f => {
          const variantLabel = toDisplayName(f);
          return {
            id:        toId(variantLabel),
            name:      variantLabel,
            imagePath: imgUrl(folderName, groupName, 'ocultos', f),
            isLocked:  true,
            label:     variantLabel,
            seedName:  `${baseName} (${variantLabel})`,
          };
        }),
      ];

      if (allVariants.length === 0) continue;

      const firstVisible = allVariants.find(v => !v.isLocked) ?? allVariants[0];

      manifestResults.push({
        id:           toId(baseName + '_' + folderName),
        name:         baseName,
        muscle,
        folderName,
        imagePath:    firstVisible.imagePath,
        isLocked:     allVariants.every(v => v.isLocked),
        variantGroup: groupName,
        variants:     allVariants.map(({ id, name, imagePath, isLocked }) => ({ id, name, imagePath, isLocked })),
      });

      catalogResults.push({
        id:       toId(baseName + '_' + folderName),
        name:     baseName,
        muscle,
        icon,
        metrics,
        imagePath: firstVisible.imagePath,
        isLocked:  allVariants.every(v => v.isLocked),
        variants:  allVariants.map(({ id, label, seedName, imagePath, isLocked }) => ({ id, label, seedName, imagePath, isLocked })),
        _standalone: false,
      });
    }
  }

  // ── Locked standalones in ocultos/ ────────────────────────────────────────
  const lockedPngs = readPngs(path.join(musclePath, 'ocultos'));
  for (const f of lockedPngs) {
    const displayName = toDisplayName(f);
    const seedName    = displayName;
    const imagePath   = imgUrl(folderName, 'ocultos', f);

    manifestResults.push({
      id: toId(displayName), name: displayName, muscle, folderName,
      imagePath, isLocked: true, variantGroup: null, variants: [],
    });

    catalogResults.push({
      id:        toId(displayName + '_' + folderName),
      name:      displayName,
      muscle,
      icon,
      metrics,
      imagePath,
      isLocked:  true,
      variants:  [{ id: toId(displayName), label: displayName, seedName, imagePath, isLocked: true }],
      _standalone: true,
    });
  }
}

// ── Write imageManifest.ts ────────────────────────────────────────────────────

const manifestTs = `// AUTO-GENERATED by scripts/generateCatalog.mjs — DO NOT EDIT MANUALLY
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

export const IMAGE_MANIFEST: ManifestExercise[] = ${JSON.stringify(manifestResults, null, 2)};

/** All exercises that have variants (main card = base, arrows cycle variants) */
export const MANIFEST_WITH_VARIANTS = IMAGE_MANIFEST.filter(e => e.variants.length > 1);

/** Standalone exercises (single image, no variant cycling) */
export const MANIFEST_STANDALONE = IMAGE_MANIFEST.filter(e => e.variants.length <= 1);
`;

fs.writeFileSync(OUT_MANIFEST, manifestTs, 'utf8');
console.log(`✅ imageManifest.ts — ${manifestResults.length} exercises`);

// ── Write catalogData.ts ──────────────────────────────────────────────────────

// Strip the _standalone helper field before writing
const cleanCatalog = catalogResults.map(({ _standalone, ...rest }) => rest);

const catalogTs = `// AUTO-GENERATED by scripts/generateCatalog.mjs — DO NOT EDIT MANUALLY
// Run "npm run catalog" to regenerate after adding/moving images.
// Generated: ${new Date().toISOString()}
//
// HOW TO ADD AN EXERCISE:
//   1. Put the image in public/ejercicioimg/ejercicios/<MuscleFolder>/<Name>.png  (standalone)
//   2. Or create a folder: <MuscleFolder>/<ExerciseName>/<Variant>.png            (with variants)
//   3. Run: npm run catalog

export interface CatalogVariant {
  id: string;
  label: string;
  seedName: string;
  imagePath: string;
  isLocked: boolean;
}

export interface CatalogExercise {
  id: string;
  name: string;
  muscle: string;
  icon: string;
  metrics: {
    weight: boolean;
    reps: boolean;
    time: boolean;
    distance: boolean;
    rpe: boolean;
  };
  imagePath: string;
  isLocked: boolean;
  variants: CatalogVariant[];
}

export const CATALOG_DATA: CatalogExercise[] = ${JSON.stringify(cleanCatalog, null, 2)};
`;

fs.writeFileSync(OUT_CATALOG, catalogTs, 'utf8');
console.log(`✅ catalogData.ts    — ${cleanCatalog.length} exercises`);

// ── Summary ───────────────────────────────────────────────────────────────────
const byMuscle = {};
for (const e of cleanCatalog) {
  if (!e.isLocked) byMuscle[e.muscle] = (byMuscle[e.muscle] || 0) + 1;
}
for (const [m, c] of Object.entries(byMuscle).sort()) {
  console.log(`  ${m}: ${c} visible`);
}
