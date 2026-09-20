import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
 plugins: [react()],
 server: { watch: { ignored: ['**/raw/**', '**/artifacts/**'] } },
 resolve: { alias: { '@engine': fileURLToPath(new URL('./engine', import.meta.url)), '@': fileURLToPath(new URL('./src', import.meta.url)) } },
 test: { include: ['tests/**/*.test.{ts,tsx}'], environment: 'node' },
});
