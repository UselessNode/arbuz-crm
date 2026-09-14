// Инвариант: во фронтенде `@arbuz/shared` импортируется только как типы.
//
// `@arbuz/shared` реэкспортирует сгенерированный Prisma-клиент (CommonJS).
// Любой рантайм-импорт тянет его в браузерный бандл, и dev-сервер падает:
// "Uncaught ReferenceError: exports is not defined" — страница остаётся белой.
// Рантайм-значения (роли, статусы) во фронтенде зеркалятся локально:
// `lib/roles.ts`, `lib/post-status.ts`, `api/pdf-export.ts`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { createSmoke } from '../helpers/smoke';

const frontendSrc = path.resolve(import.meta.dir, '../../../frontend/src');

/** Все .ts/.tsx файлы фронтенда (рекурсивно). */
function collectSourceFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      result.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      result.push(full);
    }
  }
  return result;
}

/** Импорт `@arbuz/shared` не через `import type` (в т.ч. динамический и require). */
function runtimeImportReason(source: string): string | null {
  // Клаузула импорта не содержит `;` и кавычек — они не дают перескочить на соседние импорты.
  const staticImport = /import\s+([^;'"]+?)\s+from\s+'@arbuz\/shared'/g;
  for (const match of source.matchAll(staticImport)) {
    if (!/^\s*type\b/.test(match[1])) return 'import без type';
  }
  if (/import\s+'@arbuz\/shared'/.test(source)) return 'импорт только ради побочного эффекта';
  if (/import\(\s*'@arbuz\/shared'\s*\)/.test(source)) return 'динамический import()';
  if (/require\(\s*'@arbuz\/shared'\s*\)/.test(source)) return 'require()';
  return null;
}

const smoke = createSmoke('frontend (импорты @arbuz/shared)');

async function main(): Promise<void> {
  const files = collectSourceFiles(frontendSrc);
  smoke.ok('исходники фронтенда найдены', files.length > 0, { files: files.length });

  const violations: string[] = [];
  for (const file of files) {
    const reason = runtimeImportReason(readFileSync(file, 'utf8'));
    if (reason) violations.push(`${path.relative(frontendSrc, file)} — ${reason}`);
  }

  smoke.ok('во фронтенде нет рантайм-импортов @arbuz/shared', violations.length === 0, violations);
  smoke.ok(
    'локальные зеркала статусов/ролей на месте',
    ['lib/roles.ts', 'lib/post-status.ts', 'api/pdf-export.ts'].every((relative) =>
      files.some((file) => path.relative(frontendSrc, file).split(path.sep).join('/') === relative),
    ),
  );

  smoke.done();
}

await main();
