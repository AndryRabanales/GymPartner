#!/usr/bin/env node

/**
 * Script para eliminar COMPLETAMENTE el sistema de tutorial de todos los archivos
 */

import fs from 'fs';
import path from 'path';

const files = [
    'src/pages/MyArsenal.tsx',
    'src/pages/WorkoutSession.tsx',
    'src/components/map/GymMap.tsx'
];

const rootDir = process.cwd();

files.forEach(filePath => {
    const fullPath = path.join(rootDir, filePath);

    if (!fs.existsSync(fullPath)) {
        console.log(`❌ File not found: ${filePath}`);
        return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // 1. Remove InteractiveOverlay import
    const importPattern = /import\s+{\s*InteractiveOverlay\s*}\s+from\s+['"].*InteractiveOverlay['"];?\s*\n/g;
    if (content.match(importPattern)) {
        content = content.replace(importPattern, '');
        modified = true;
        console.log(`✅ Removed InteractiveOverlay import from ${filePath}`);
    }

    // 2. Remove tutorial useState
    const statePattern = /const\s+\[tutorialStep,\s*setTutorialStep\]\s*=\s*useState\(0\);?\s*\n/g;
    if (content.match(statePattern)) {
        content = content.replace(statePattern, '');
        modified = true;
        console.log(`✅ Removed tutorialStep useState from ${filePath}`);
    }

    // 3. Remove tutorial useEffect blocks
    const effectPattern = /\/\/\s*TUTORIAL.*?\n\s*const\s+\[tutorialStep,.*?\n\s*useEffect\(\(\)\s*=>\s*{\n\s*const\s+step\s*=\s*localStorage\.getItem\('tutorial_step'\);?\s*\n.*?if\s*\(step\)\s*setTutorialStep\(parseInt\(step\)\);?\s*\n\s*},\s*\[\]\);?\s*\n/gs;
    if (content.match(effectPattern)) {
        content = content.replace(effectPattern, '');
        modified = true;
        console.log(`✅ Removed tutorial useEffect from ${filePath}`);
    }

    // 4. Remove tutorial localStorage calls
    content = content.replace(/localStorage\.(getItem|setItem)\s*\(['"]tutorial_step['"]\s*(,\s*['"][^'"]*['"])?\s*\);?\s*/g, '');

    // Remove tutorial advance comments
    content = content.replace(/\/\/\s*TUTORIAL\s*ADVANCE:.*?\n/g, '');
    content = content.replace(/\/\/\s*Tutorial.*?\n/g, '');

    // 5. Remove InteractiveOverlay JSX blocks (complete blocks)
    const overlayPattern = /{\/\*\s*TUTORIAL.*?\*\/}\s*{\s*tutorialStep\s*===\s*\d+.*?<InteractiveOverlay[\s\S]*?\/>\s*\)\s*}/g;
    if (content.match(overlayPattern)) {
        content = content.replace(overlayPattern, '');
        modified = true;
        console.log(`✅ Removed InteractiveOverlay blocks from ${filePath}`);
    }

    // 6. Remove tutorial step conditionals
    content = content.replace(/if\s*\(tutorialStep\s*===\s*\d+\)\s*{[\s\S]*?}/g, '');
    content = content.replace(/if\s*\(localStorage\.getItem\s*\(['"]tutorial_step['"]\)\s*===\s*['"][^'"]*['"]\)\s*{[\s\S]*?}/g, '');

    // Save if modified
    if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`💾 Saved changes to ${filePath}\n`);
    } else {
        console.log(`⏭️  No tutorial code found in ${filePath}\n`);
    }
});

console.log('\n🎉 Tutorial elimination complete!');
