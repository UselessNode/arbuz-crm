// Запуск всех смоук-тестов backend: `bun test:smoke` из корня (или из apps/backend).
//
// Каждый `*.smoke.ts` — самостоятельный скрипт: он сам открывает соединение с dev-базой,
// печатает проверки и завершается кодом 1 при провале. Здесь мы запускаем их по очереди,
// чтобы провал одного не скрывал результаты остальных.
import { readdirSync } from 'node:fs';
import path from 'node:path';

const smokeDir = path.join(import.meta.dir, 'smoke');
const files = readdirSync(smokeDir)
  .filter((name) => name.endsWith('.smoke.ts'))
  .sort();

if (files.length === 0) {
  console.error('[smoke] Не найдено ни одного *.smoke.ts');
  process.exit(1);
}

const failed: string[] = [];
for (const file of files) {
  const result = Bun.spawnSync(['bun', path.join(smokeDir, file)], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (result.exitCode !== 0) failed.push(file);
}

console.log('\n================ ИТОГ ================');
console.log(`Файлов: ${files.length}, провалено: ${failed.length}`);
failed.forEach((file) => console.error(`  ✗ ${file}`));
process.exit(failed.length > 0 ? 1 : 0);
