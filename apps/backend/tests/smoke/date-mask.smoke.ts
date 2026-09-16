// Смоук: маска ввода даты (дд.мм.гггг) — общая для полей периода в форме заявки.
//
// Логика чистая и живёт во фронтенде (`apps/frontend/src/components/ui/Form/date-mask.ts`):
// поле с маской и календарь работают с одним значением, поэтому проверяем оба перевода.
import {
  applyDateMask,
  isCompleteMaskedDate,
  isRealMaskedDate,
  isoToMasked,
  maskedToIso,
} from '../../../frontend/src/components/ui/Form/date-mask';
import { createSmoke } from '../helpers/smoke';

const smoke = createSmoke('date-mask (маска ввода даты)');

function main(): void {
  // Точки подставляются по мере ввода.
  smoke.eq('первые цифры дня', applyDateMask('1'), '1');
  smoke.eq('день целиком', applyDateMask('14'), '14');
  smoke.eq('день и первая цифра месяца', applyDateMask('143'), '14.3');
  smoke.eq('день и месяц', applyDateMask('1409'), '14.09');
  smoke.eq('полная дата', applyDateMask('14092026'), '14.09.2026');

  // Разделители, которые набрал пользователь, не мешают: берём только цифры.
  smoke.eq('точки во вводе игнорируются', applyDateMask('14.09.2026'), '14.09.2026');
  smoke.eq('дефисы приводятся к маске', applyDateMask('14-09-2026'), '14.09.2026');
  smoke.eq('лишние цифры отбрасываются', applyDateMask('14092026123'), '14.09.2026');
  smoke.eq('буквы отбрасываются', applyDateMask('1a4b0c9'), '14.09');
  smoke.eq('пустой ввод', applyDateMask(''), '');

  // Полнота и существование даты.
  smoke.ok('дата заполнена', isCompleteMaskedDate('14.09.2026'));
  smoke.ok('дата не заполнена', !isCompleteMaskedDate('14.09.20'));
  smoke.ok('существующая дата', isRealMaskedDate('14.09.2026'));
  smoke.ok('31 февраля не существует', !isRealMaskedDate('31.02.2026'));
  smoke.ok('29 февраля в невисокосный год не существует', !isRealMaskedDate('29.02.2027'));
  smoke.ok('29 февраля в високосный год существует', isRealMaskedDate('29.02.2028'));
  smoke.ok('нулевой день невозможен', !isRealMaskedDate('00.09.2026'));
  smoke.ok('тринадцатый месяц невозможен', !isRealMaskedDate('14.13.2026'));

  // Перевод в ISO и обратно.
  smoke.eq('маска → ISO', maskedToIso('14.09.2026'), '2026-09-14');
  smoke.eq('несуществующая дата → пусто', maskedToIso('31.02.2026'), '');
  smoke.eq('неполная маска → пусто', maskedToIso('14.09'), '');
  smoke.eq('ISO → маска', isoToMasked('2026-09-14'), '14.09.2026');
  smoke.eq('пустое значение → пустая маска', isoToMasked(''), '');
  smoke.eq('мусор в ISO → пустая маска', isoToMasked('14.09.2026'), '');
  smoke.eq('перевод туда и обратно не портит дату', isoToMasked(maskedToIso('01.01.2026')), '01.01.2026');

  smoke.done();
}

main();
