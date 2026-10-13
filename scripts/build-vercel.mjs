import { build } from 'esbuild';
import { mkdir, cp, writeFile, rm } from 'node:fs/promises';

const output='.vercel/output';
const functionDir=`${output}/functions/api/index.func`;
await rm(output,{recursive:true,force:true});
await mkdir(functionDir,{recursive:true});
await cp('dist/public',`${output}/static`,{recursive:true});
// Browser config must be generated from runtime values by the protected API,
// not served from build-time output.
await rm(`${output}/static/api`,{recursive:true,force:true});
await build({entryPoints:['api/index.ts'],outfile:`${functionDir}/handler.cjs`,bundle:true,platform:'node',format:'cjs',target:'node22',minify:false,legalComments:'none'});
await writeFile(`${functionDir}/index.cjs`,"module.exports = require('./handler.cjs').default;\n");
await writeFile(`${functionDir}/.vc-config.json`,JSON.stringify({runtime:'nodejs22.x',handler:'index.cjs',launcherType:'Nodejs',maxDuration:60},null,2));
await writeFile(`${output}/config.json`,JSON.stringify({version:3,routes:[{src:'/api/(.*)',dest:'/api/index'},{handle:'filesystem'},{src:'/(.*)',dest:'/index.html'}]},null,2));
console.log('Vercel Build Output API: static frontend + bundled Node API ready');
