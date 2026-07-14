// Emits dist-designsystem/package.json so the design-sync converter can walk up
// from the built entry to a named package and resolve the .d.ts types root.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve('dist-designsystem/package.json');
const pkg = {
  name: '@ginx/design-system',
  version: '0.1.0',
  type: 'module',
  module: './ginx-ds.es.js',
  main: './ginx-ds.umd.js',
  types: './types/index.d.ts',
  exports: {
    '.': {
      types: './types/index.d.ts',
      import: './ginx-ds.es.js',
      require: './ginx-ds.umd.js',
    },
    './styles.css': './ginx-ds.css',
  },
  peerDependencies: { react: '>=18', 'react-dom': '>=18' },
};
writeFileSync(out, JSON.stringify(pkg, null, 2) + '\n');
console.error(`wrote ${out}`);
