/**
 * Compile api/*.ts to api/*.js so Vercel runs plain JS (avoids "Unexpected token ':'" from TS syntax).
 * Run during vercel-build; then .ts files are removed so only .js are deployed.
 */
import * as esbuild from 'esbuild';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiDir = join(__dirname, 'api');

const entries = [
  { in: 'whatsapp-webhook.ts', out: 'whatsapp-webhook.js' },
  { in: 'daily-heartbeat.ts', out: 'daily-heartbeat.js' },
];

async function main() {
  for (const { in: entry, out: outFile } of entries) {
    const entryPath = join(apiDir, entry);
    if (!existsSync(entryPath)) {
      console.warn(`[build-api] Skip ${entry}: not found`);
      continue;
    }
    await esbuild.build({
      entryPoints: [entryPath],
      outfile: join(apiDir, outFile),
      platform: 'node',
      format: 'esm',
      target: 'node18',
      bundle: false,
      outExtension: { '.js': '.js' },
      logLevel: 'info',
    });
    console.log(`[build-api] Built ${entry} -> ${outFile}`);
  }

  // On Vercel only: remove .ts so the deployment runs only .js (avoids TS parsed as JS).
  const isVercel = process.env.VERCEL === '1';
  if (isVercel) {
    for (const { in: entry } of entries) {
      const tsPath = join(apiDir, entry);
      if (existsSync(tsPath)) {
        unlinkSync(tsPath);
        console.log(`[build-api] Removed ${entry}`);
      }
    }
  }
}

main().catch((err) => {
  console.error('[build-api]', err);
  process.exit(1);
});
