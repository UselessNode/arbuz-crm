// Смоук: жизненный цикл публикаций (черновик → опубликована → запланирована → архив)
// и гарантия того, что публичная лента не отдаёт ничего, кроме опубликованного.
import { POST_STATUSES, PostStatus } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import {
  computePostStatus,
  createPost,
  deletePost,
  getPostOrThrow,
  inlineFileIds,
  listPostsForAdmin,
  listPublishedPosts,
  updatePost,
} from '../../modules/posts/posts.service';
import { createSmoke } from '../helpers/smoke';
import { asExpert, requireAdmin } from '../helpers/actors';

const smoke = createSmoke('posts (жизненный цикл публикаций)');

async function main(): Promise<void> {
  const admin = await requireAdmin();
  const title = `[smoke] Публикация ${Date.now()}`;
  const pinnedLow = `[smoke] Закреп 1 ${Date.now()}`;
  const pinnedHigh = `[smoke] Закреп 2 ${Date.now()}`;
  let postId: number | null = null;
  let pinnedLowId: number | null = null;
  let pinnedHighId: number | null = null;

  try {
    // Чистая функция: статус вычисляется из полей.
    const now = new Date();
    smoke.eq('computePostStatus: черновик', computePostStatus({ is_published: false, scheduled_at: null, archived_at: null }, now), PostStatus.draft);
    smoke.eq(
      'computePostStatus: отложенная',
      computePostStatus({ is_published: true, scheduled_at: new Date(now.getTime() + 60_000), archived_at: null }, now),
      PostStatus.scheduled,
    );
    smoke.eq(
      'computePostStatus: наступившая дата → опубликована',
      computePostStatus({ is_published: true, scheduled_at: new Date(now.getTime() - 60_000), archived_at: null }, now),
      PostStatus.published,
    );
    smoke.eq(
      'computePostStatus: архив важнее остальных полей',
      computePostStatus({ is_published: true, scheduled_at: null, archived_at: now }, now),
      PostStatus.archived,
    );

    // Картинки в тексте не дублируются в списке вложений: извлекаем их id из содержимого.
    smoke.eq(
      'встроенные картинки: id извлекаются',
      [...inlineFileIds('текст ![схема](/api/posts/12/files/34/download) и ещё')],
      [34],
    );
    smoke.eq('встроенные картинки: без картинок пусто', inlineFileIds('обычный текст').size, 0);

    // Публичная лента не содержит черновиков и архива демо-набора.
    const feedBefore = await listPublishedPosts({ limit: 100, offset: 0 });
    smoke.ok(
      'лента: черновик демо-набора не отдаётся',
      !feedBefore.posts.some((post) => post.status !== PostStatus.published),
      feedBefore.posts.map((post) => post.status),
    );
    smoke.ok(
      'лента: возвращаются только опубликованные посты',
      feedBefore.posts.every((post) => post.status === PostStatus.published),
    );

    // Фильтр по статусу возвращает только посты этого статуса.
    for (const status of POST_STATUSES) {
      const filtered = await listPostsForAdmin(admin, { limit: 100, offset: 0, status });
      smoke.ok(
        `админ-список: фильтр ${status} отдаёт только этот статус`,
        filtered.posts.every((post) => post.status === status),
        filtered.posts.map((post) => post.status),
      );
    }

    // Черновик: виден только администратору в разделе «Публикации».
    const created = await createPost(admin, { title, content: 'Текст проверки', is_published: false });
    postId = created.id;
    smoke.eq('создание: статус черновика', created.status, PostStatus.draft);
    smoke.eq('создание: нет отметки «Отредактировано»', created.editedAt, null);
    smoke.eq('лента: черновик не отдаётся', (await listPublishedPosts({ limit: 10, offset: 0, search: title })).total, 0);
    smoke.eq(
      'админ-список: фильтр по черновикам',
      (await listPostsForAdmin(admin, { limit: 10, offset: 0, search: title, status: PostStatus.draft })).total,
      1,
    );
    await smoke.fails('чтение черновика гостем', () => getPostOrThrow(undefined, created.id), 'POST_NOT_FOUND');

    // Публикация сейчас.
    const published = await updatePost(admin, created.id, {
      title,
      content: 'Текст проверки',
      is_published: true,
      hide_author: false,
      scheduled_at: null,
      archived: false,
    });
    smoke.eq('публикация: статус', published.status, PostStatus.published);
    smoke.eq('лента: опубликованный пост отдаётся', (await listPublishedPosts({ limit: 10, offset: 0, search: title })).total, 1);
    smoke.ok('чтение опубликованного поста гостем', (await getPostOrThrow(undefined, created.id)).id === created.id);

    // Правка содержимого ставит отметку «Отредактировано».
    const edited = await updatePost(admin, created.id, {
      title,
      content: 'Текст проверки (обновлён)',
      is_published: true,
      hide_author: false,
      scheduled_at: null,
      archived: false,
    });
    smoke.ok('правка содержимого: появилась отметка «Отредактировано»', edited.editedAt !== null);

    // Отложенная публикация: до наступления даты скрыта из ленты.
    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const scheduled = await updatePost(admin, created.id, {
      title,
      content: 'Текст проверки (обновлён)',
      is_published: false,
      hide_author: false,
      scheduled_at: scheduledAt,
      archived: false,
    });
    smoke.eq('отложенная: статус', scheduled.status, PostStatus.scheduled);
    smoke.ok('отложенная: флаг публикации выставлен', scheduled.scheduledAt !== null);
    smoke.eq('лента: отложенная не отдаётся', (await listPublishedPosts({ limit: 10, offset: 0, search: title })).total, 0);
    smoke.eq(
      'админ-список: фильтр по отложенным',
      (await listPostsForAdmin(admin, { limit: 10, offset: 0, search: title, status: PostStatus.scheduled })).total,
      1,
    );

    // Архив: скрыт из ленты, доступен администратору.
    const archived = await updatePost(admin, created.id, {
      title,
      content: 'Текст проверки (обновлён)',
      is_published: true,
      hide_author: false,
      scheduled_at: null,
      archived: true,
    });
    smoke.eq('архив: статус', archived.status, PostStatus.archived);
    smoke.eq('лента: архив не отдаётся', (await listPublishedPosts({ limit: 10, offset: 0, search: title })).total, 0);
    smoke.eq(
      'админ-список: фильтр по архиву',
      (await listPostsForAdmin(admin, { limit: 10, offset: 0, search: title, status: PostStatus.archived })).total,
      1,
    );

    // Возврат из архива.
    const restored = await updatePost(admin, created.id, {
      title,
      content: 'Текст проверки (обновлён)',
      is_published: true,
      hide_author: false,
      scheduled_at: null,
      archived: false,
    });
    smoke.eq('возврат из архива: статус', restored.status, PostStatus.published);
    smoke.eq('лента: вернувшийся пост отдаётся', (await listPublishedPosts({ limit: 10, offset: 0, search: title })).total, 1);

    // Права: не-админ не может управлять публикациями.
    await smoke.fails(
      'эксперт не может создать публикацию',
      () => createPost(asExpert(admin.id, admin.email), { title, content: 'x' }),
      'FORBIDDEN',
    );

    // Закрепление и порядок: закреплённые идут первыми, внутри группы — по sort_order.
    const low = await createPost(admin, { title: pinnedLow, content: 'Закреп 1', is_published: true, pinned: true, sort_order: 2 });
    pinnedLowId = low.id;
    const high = await createPost(admin, { title: pinnedHigh, content: 'Закреп 2', is_published: true, pinned: true, sort_order: 1 });
    pinnedHighId = high.id;
    smoke.eq('создание: флаг закрепления сохранён', high.pinned, true);
    smoke.eq('создание: порядок сохранён', high.sortOrder, 1);

    const ordered = await listPublishedPosts({ limit: 100, offset: 0 });
    const highIndex = ordered.posts.findIndex((post) => post.id === high.id);
    const lowIndex = ordered.posts.findIndex((post) => post.id === low.id);
    smoke.ok(
      'лента: закреплённые с меньшим sort_order идут выше',
      highIndex !== -1 && lowIndex !== -1 && highIndex < lowIndex,
      { high: highIndex, low: lowIndex },
    );
    smoke.ok(
      'лента: закреплённые стоят перед незакреплёнными',
      ordered.posts.slice(0, 2).every((post) => post.pinned),
      ordered.posts.slice(0, 3).map((post) => ({ id: post.id, pinned: post.pinned })),
    );
  } finally {
    if (postId !== null) await prisma.posts.delete({ where: { id: postId } });
    if (pinnedLowId !== null) await prisma.posts.delete({ where: { id: pinnedLowId } });
    if (pinnedHighId !== null) await prisma.posts.delete({ where: { id: pinnedHighId } });
    await prisma.$disconnect();
  }

  smoke.done();
}

await main();
