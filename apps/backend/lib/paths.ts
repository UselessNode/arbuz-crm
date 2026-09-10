// Корень пакета backend, независимый от рабочего каталога запуска процесса.
// Нужен для стабильного размещения uploads/ и logs/ (не зависит от cwd).
import { fileURLToPath } from 'node:url';

export const BACKEND_ROOT = fileURLToPath(new URL('..', import.meta.url));
