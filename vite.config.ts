import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
 plugins: [react(),{name:'kairos-research-api',configureServer(server){
   const env=loadEnv(server.config.mode,process.cwd(),'');
   for(const key of ['QWEN_API_KEY','QWEN_BASE_URL','QWEN_MODEL','QWEN_DAILY_TOKEN_BUDGET','OPENAI_API_KEY','OPENAI_MODEL'])if(env[key]&&!process.env[key])process.env[key]=env[key];
   server.middlewares.use('/api/ask',async(req,res)=>{try{const endpoint=await server.ssrLoadModule('/api/ask.ts');await endpoint.default(req,res);}catch{res.statusCode=503;res.end('Research service unavailable.');}});
   server.middlewares.use('/api/quotes',async(req,res)=>{const endpoint=await server.ssrLoadModule('/api/quotes.ts');await endpoint.default(req,res);});
 }}],
 // Scan only the app entry, not HTML stored in local browser-test profiles.
 optimizeDeps: { entries: ['index.html'] },
 server: { watch: { ignored: ['**/raw/**', '**/artifacts/**'] } },
 resolve: { alias: { '@engine': fileURLToPath(new URL('./engine', import.meta.url)), '@': fileURLToPath(new URL('./src', import.meta.url)) } },
 test: { include: ['tests/**/*.test.{ts,tsx}'], environment: 'node' },
});
