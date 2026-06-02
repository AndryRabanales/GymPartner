const fs = require('fs');

const content = fs.readFileSync('src/services/GymEquipmentService.ts', 'utf8');
const manifestMatch = fs.readFileSync('src/data/imageManifest.ts', 'utf8');
const jsonStr = manifestMatch.match(/export const IMAGE_MANIFEST: ManifestExercise\[\] = (\[[\s\S]*?\]);/)[1];
const manifest = JSON.parse(jsonStr);

let paths = [];
for (const ex of manifest) {
    if (ex.variants && ex.variants.length > 0) {
        for (const v of ex.variants) paths.push(v.imagePath);
    } else {
        paths.push(ex.imagePath);
    }
}

function normalize(s) {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
}

let replaced = 0, missed = 0;
let newContent = content.replace(/(\"name\":\s*\"([^\"]+)\"[\s\S]*?\"image_url\":\s*\")([^\"]+)(\")/g, (match, prefix, name, oldPath, suffix) => {
    let newPath = oldPath;
    
    const oldParts = oldPath.split('/');
    const oldBase = oldParts.pop().replace('.png', '');
    const oldFolder = oldParts.pop();
    
    // First, let's just see if any path in the manifest loosely matches the name
    let matchedPath = null;
    
    const normName = normalize(name);
    
    // Attempt 1: Exact match on basename inside paths
    matchedPath = paths.find(p => p.includes('/' + oldBase + '.png'));
    
    // Attempt 2: Same old folder, fuzzy match on name
    if (!matchedPath) {
        const folderCandidates = paths.filter(p => p.includes('/' + oldFolder + '/'));
        if (folderCandidates.length === 1) {
            matchedPath = folderCandidates[0];
        } else {
            for (const c of folderCandidates) {
                const cBase = normalize(c.split('/').pop().replace('.png', ''));
                if (normName.includes(cBase) || cBase.includes(normName)) {
                    matchedPath = c; break;
                }
            }
        }
    }
    
    // Attempt 3: Global fuzzy match based on basename against the new file names
    if (!matchedPath) {
        let bestMatch = null;
        for (const p of paths) {
            const pBase = normalize(p.split('/').pop().replace('.png', ''));
            const pFolder = normalize(p.split('/')[p.split('/').length - 2] || '');
            
            // if the name contains the folder AND the base...
            if (normName.includes(pFolder) && normName.includes(pBase)) {
                matchedPath = p; break;
            }
            // if the old base is similar to pBase
            if (pBase.length > 3 && normalize(oldBase).includes(pBase)) {
                matchedPath = p; break;
            }
            if (pBase.length > 3 && normName.includes(pBase)) {
                bestMatch = p;
            }
        }
        if (!matchedPath && bestMatch) matchedPath = bestMatch;
    }

    if (matchedPath) {
        newPath = matchedPath;
        replaced++;
    } else {
        console.log('Missed:', oldPath, '-> Name:', name, '-> normName:', normName);
        missed++;
    }
    
    return prefix + newPath + suffix;
});

fs.writeFileSync('src/services/GymEquipmentService.ts', newContent);
console.log('Replaced:', replaced, 'Missed:', missed);
