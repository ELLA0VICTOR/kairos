import { packAnalogs, type RawHistory } from '@engine/artifacts';
import { analogRecord, type Sample } from './research';
import { main,readJson,writeArtifact,type PipelineContext } from './pipeline-context';
export async function buildAnalogs(c:PipelineContext):Promise<void> {
  const history=await readJson<RawHistory>(c,'raw/history.json'),samples=await readJson<Sample[]>(c,'raw/research-samples.json');
  const packed=packAnalogs(samples.map(analogRecord),history.universe,history.windows);
  const bytes=Buffer.byteLength(JSON.stringify(packed));if(bytes>=2_000_000)throw new Error(`Analog index exceeds 2MB: ${bytes}`);
  await writeArtifact(c,'analogs',packed);console.log(`Analogs: ${packed.rows.length} records, ${bytes} bytes before artifact header.`);
}
main(import.meta.url,buildAnalogs);
