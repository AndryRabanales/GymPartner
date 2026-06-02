const fs = require('fs');
let c = fs.readFileSync('src/services/GymEquipmentService.ts', 'utf8');
const reps = {
    '/ejercicioimg/ejercicios/Abdomen/Crunch/CrunchAbdominal.png': '/ejercicioimg/ejercicios/Abdomen/Crunch/Estandar.png',
    '/ejercicioimg/ejercicios/Abdomen/ElevacionesDePiernaColgado.png': '/ejercicioimg/ejercicios/Abdomen/Elevacion Piernas Colgado.png',
    '/ejercicioimg/ejercicios/Abdomen/plancha/Plancha.png': '/ejercicioimg/ejercicios/Abdomen/plancha/Estatica.png',
    '/ejercicioimg/ejercicios/Biceps/CurlDeBicepsBayoneta.png': '/ejercicioimg/ejercicios/Biceps/Curl Biceps Bayoneta.png',
    '/ejercicioimg/ejercicios/Espalda/Dominadas/Dominadas Pullups.png': '/ejercicioimg/ejercicios/Espalda/Dominadas/Libre.png',
    '/ejercicioimg/ejercicios/Isquiotibiales/Peso Muerto/Peso Muerto Deadlift.png': '/ejercicioimg/ejercicios/Isquiotibiales/Peso Muerto/Convencional.png',
    '/ejercicioimg/ejercicios/pecho/Fondos pecho/Fondos Dips.png': '/ejercicioimg/ejercicios/pecho/Fondos pecho/Libre.png',
    '/ejercicioimg/ejercicios/pecho/Fondos pecho/FondosDipsAsistido(Pecho).png': '/ejercicioimg/ejercicios/pecho/Fondos pecho/Asistido Maquina.png',
    '/ejercicioimg/ejercicios/Pierna/Extensiones de Cuádriceps.png': '/ejercicioimg/ejercicios/Pierna/Extensiones Cuadriceps.png',
    '/ejercicioimg/ejercicios/Pierna/Prensa de Piernas 45°.png': '/ejercicioimg/ejercicios/Pierna/Prensa Piernas 45.png',
    '/ejercicioimg/ejercicios/Cardio/CardioRemo.png': '/ejercicioimg/ejercicios/Cardio/Remo Concept2.png',
    '/ejercicioimg/ejercicios/Gluteo/Columpios con kettlebell (2).png': '/ejercicioimg/ejercicios/Gluteo/Columpios Kettlebell.png',
    '/ejercicioimg/ejercicios/Cuello/Arnés de cuello (Neck Harness).png': '/ejercicioimg/ejercicios/Cuello/Arnes Cuello.png',
    '/ejercicioimg/ejercicios/Cuello/Extensiones de cuello con disco.png': '/ejercicioimg/ejercicios/Cuello/Extension Disco.png',
    '/ejercicioimg/ejercicios/Cuello/Flexiones de cuello con disco.png': '/ejercicioimg/ejercicios/Cuello/Flexion Disco.png'
};
for(const [oldPath, newPath] of Object.entries(reps)) {
    c = c.replace(oldPath, newPath);
}
fs.writeFileSync('src/services/GymEquipmentService.ts', c);
console.log('Final replacement done!');
