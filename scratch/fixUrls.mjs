import fs from 'fs';
import path from 'path';

const content = fs.readFileSync('src/services/GymEquipmentService.ts', 'utf8');
const manifestMatch = fs.readFileSync('src/data/imageManifest.ts', 'utf8');

const jsonStr = manifestMatch.match(/export const IMAGE_MANIFEST: ManifestExercise\[\] = (\[[\s\S]*?\]);/)[1];
const manifest = JSON.parse(jsonStr);

function norm(str) { 
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); 
}

const nameToPath = {};
for(const ex of manifest) {
    if (ex.variants && ex.variants.length > 0) {
        for(const v of ex.variants) {
            nameToPath[norm(v.name)] = v.imagePath;
            const stripped = norm(v.name.replace(' (Máquina)', '').replace(' (Polea)', '').replace(' (Barra)', '').replace(' (Mancuernas)', '').replace(' (Polea/Cable)', '').replace(' (Barra Z)', ''));
            nameToPath[stripped] = v.imagePath;
        }
    } else {
        nameToPath[norm(ex.name)] = ex.imagePath;
    }
}

let replaced = 0;
let missed = 0;

let newContent = content.replace(/(\"name\":\s*\"([^\"]+)\"[\s\S]*?\"image_url\":\s*\")([^\"]+)(\")/g, (match, prefix, name, oldPath, suffix) => {
    let newPath = oldPath;
    let n = norm(name);
    
    if (nameToPath[n]) {
        newPath = nameToPath[n];
        replaced++;
    } else {
        const baseName = oldPath.split('/').pop().replace('.png', '').trim();
        let found = false;
        for(const ex of manifest) {
            if (ex.variants) {
                for(const v of ex.variants) {
                    if (v.imagePath.includes('/' + baseName + '.png')) { newPath = v.imagePath; found = true; break; }
                }
            }
            if (found) break;
            if (ex.imagePath && ex.imagePath.includes('/' + baseName + '.png')) { newPath = ex.imagePath; found = true; break; }
        }
        
        if (!found) {
            missed++;
        } else {
            replaced++;
        }
    }
    return prefix + newPath + suffix;
});

fs.writeFileSync('src/services/GymEquipmentService.ts', newContent);
console.log('Replaced:', replaced, 'Missed:', missed);
