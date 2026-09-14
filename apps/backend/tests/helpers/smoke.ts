// Мини-каркас смоук-тестов backend: проверки и итоговый отчёт без внешних зависимостей.
//
// Смоук-тесты вызывают сервисы напрямую (loopback-запросы к dev-серверу из терминала
// недоступны), поэтому работают с dev-базой: сценарий обязан убирать за собой данные.
// Запуск: `bun test:smoke` из корня.

/** Провайдер id ошибки из `httpError`/`HttpError`. */
interface ErrorWithCode {
  code?: string;
}

export class Smoke {
  private passed = 0;
  private readonly failures: Array<{ description: string; details?: unknown }> = [];

  constructor(private readonly name: string) {}

  /** Базовая проверка: `condition` должно быть истинным. */
  ok(description: string, condition: boolean, details?: unknown): void {
    if (condition) {
      this.passed += 1;
      console.log(`  ✓ ${description}`);
      return;
    }
    this.failures.push({ description, details });
    console.error(`  ✗ ${description}`, details === undefined ? '' : details);
  }

  /** Проверка равенства по значению (сравнение через JSON). */
  eq<T>(description: string, actual: T, expected: T): void {
    const same = JSON.stringify(actual) === JSON.stringify(expected);
    this.ok(description, same, same ? undefined : { actual, expected });
  }

  /** Проверка, что вызов завершается ошибкой с ожидаемым кодом. */
  async fails(description: string, thunk: () => Promise<unknown>, code: string): Promise<void> {
    try {
      await thunk();
      this.ok(description, false, `ожидалась ошибка ${code}, но вызов прошёл успешно`);
    } catch (error) {
      const actual = (error as ErrorWithCode).code;
      this.ok(description, actual === code, actual === code ? undefined : { expected: code, actual });
    }
  }

  /** Печатает итог; завершает процесс с кодом 1, если были провалы. */
  done(): never {
    console.log(`\n${this.name}: пройдено ${this.passed}, провалено ${this.failures.length}`);
    if (this.failures.length > 0) {
      this.failures.forEach((failure) =>
        console.error(`  ✗ ${failure.description}`, failure.details === undefined ? '' : failure.details),
      );
      process.exit(1);
    }
    console.log(`${this.name}: OK`);
    process.exit(0);
  }
}

export function createSmoke(name: string): Smoke {
  console.log(`\n=== ${name} ===`);
  return new Smoke(name);
}
