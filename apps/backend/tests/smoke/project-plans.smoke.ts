// Смоук: план мероприятий — поля «Результат» и «Форма фиксации» (round-trip).
//
// Проверяем, что новые поля сохраняются при создании/правке и возвращаются в списке
// (в UI они появились как поля формы; бэкенд-схема их уже поддерживала).
import { prisma } from '../../lib/prisma';
import { createApplication } from '../../modules/applications/applications.service';
import { createPlan, listPlans, updatePlan } from '../../modules/applications/project-plans.service';
import { createSmoke } from '../helpers/smoke';
import { requireAdmin } from '../helpers/actors';

const smoke = createSmoke('project-plans (результаты и форма фиксации)');

async function main(): Promise<void> {
  const admin = await requireAdmin();
  let applicationId: number | null = null;
  let planId: number | null = null;

  try {
    const application = await createApplication(admin, {
      title: '[smoke] план: результаты',
      idea_description: 'x',
      importance_to_team: 'x',
      project_goal: 'x',
      project_tasks: 'x',
    });
    applicationId = application.id;

    const plan = await createPlan(admin, applicationId, {
      task: 'Задача 1',
      event_name: 'Мероприятие 1',
      results: 'Итог: 100 участников',
      fixation_form: 'Фотоотчёт и протокол',
    });
    planId = plan.id;
    smoke.eq('результат сохранён при создании', plan.results, 'Итог: 100 участников');
    smoke.eq('форма фиксации сохранена при создании', plan.fixationForm, 'Фотоотчёт и протокол');

    const listed = await listPlans(admin, applicationId);
    smoke.eq('результат читается в списке', listed[0]?.results, 'Итог: 100 участников');

    const updated = await updatePlan(admin, applicationId, plan.id, {
      results: 'Уточнённый итог',
      fixation_form: 'Смета',
    });
    smoke.eq('результат обновляется', updated.results, 'Уточнённый итог');
    smoke.eq('форма фиксации обновляется', updated.fixationForm, 'Смета');
  } finally {
    if (planId !== null) await prisma.project_plans.delete({ where: { id: planId } }).catch(() => undefined);
    if (applicationId !== null) await prisma.applications.delete({ where: { id: applicationId } }).catch(() => undefined);
  }

  await prisma.$disconnect();
  smoke.done();
}

await main();
