import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MODEL_VERSION } from '@engine/score';
import { SCHEMA_VERSION, type Artifact } from '@engine/artifacts';
export interface PipelineContext {asOf:number;seed:number;root:string}
export function context():PipelineContext {
  const asOf=process.env.KAIROS_AS_OF?Date.parse(process.env.KAIROS_AS_OF):Math.floor(Date.now()/600000)*600000;
  const seed=Number(process.env.KAIROS_SEED??20260927);
  if(!Number.isFinite(asOf)||!Number.isInteger(seed))throw new Error('Invalid KAIROS_AS_OF or KAIROS_SEED');
  return {asOf,seed,root:resolve(process.env.KAIROS_OUTPUT_ROOT??process.cwd())};
}
export function envelope<T>(data:T,c:PipelineContext):Artifact<T> {return {schemaVersion:SCHEMA_VERSION,generatedAt:c.asOf,modelVersion:MODEL_VERSION,source:'synthetic',data};}
export async function writeJson(c:PipelineContext,path:string,data:unknown):Promise<void> {
  const full=resolve(c.root,path);await mkdir(dirname(full),{recursive:true});
  const text=JSON.stringify(data,(_key,value:unknown)=>{if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Non-finite artifact number');return value;});
  if(/\bNaN\b|\bInfinity\b/.test(text))throw new Error('Non-finite serialized artifact');
  await writeFile(`${full}.tmp`,text);await rename(`${full}.tmp`,full);
}
export async function readJson<T>(c:PipelineContext,path:string):Promise<T> {return JSON.parse(await readFile(resolve(c.root,path),'utf8')) as T;}
export async function readArtifact<T>(c:PipelineContext,name:string):Promise<Artifact<T>> {
  const artifact=await readJson<Artifact<T>>(c,`public/data/${name}.json`);
  if(artifact.schemaVersion!==SCHEMA_VERSION)throw new Error(`Unsupported schema: ${name}`);
  return artifact;
}
export async function writeArtifact<T>(c:PipelineContext,name:string,data:T):Promise<void> {
  const value=envelope(data,c);
  await writeJson(c,`public/data/${name}.json`,value);
  await writeJson(c,`src/data/fallback/${name}.json`,value);
}
export async function readLedger<T>(c:PipelineContext,name:string):Promise<T[]> {
  try {return (await readArtifact<T[]>(c,name)).data;}
  catch(error){if(typeof error==='object'&&error!==null&&'code' in error&&error.code==='ENOENT')return [];throw error;}
}
export function main(url:string,run:(c:PipelineContext)=>Promise<void>):void {
  if(process.argv[1]&&url===pathToFileURL(resolve(process.argv[1])).href)run(context()).catch((error:unknown)=>{console.error(error);process.exitCode=1;});
}
