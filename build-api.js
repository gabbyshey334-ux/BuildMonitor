/**
 * Compile api/*.ts to api/*.js so Vercel can run plain JS (avoids "Unexpected token ':'" from TS).
 * We do NOT delete the .ts files: Vercel's function discovery expects them to exist.
 */
import * as esbuild from 'esbuild';
import { existsSync } from 'fs';
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
}

main().catch((err) => {
  console.error('[build-api]', err);
  process.exit(1);
});
