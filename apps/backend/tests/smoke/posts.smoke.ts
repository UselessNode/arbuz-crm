// Смоук: жизненный цикл публикаций (черновик → опубликована → запланирована → архив)
// и гарантия того, что публичная лента не отдаёт ничего, кроме опубликованного.
import { POST_STATUSES, PostStatus } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import {
  computePostStatus,
  createPost,
  deletePost,
  getPostOrThrow,
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
  let postId: number | null = null;

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

    // Демо-набор seed покрывает все четыре статуса — это нужно для ручной проверки UI.
    const adminAll = await listPostsForAdmin(admin, { limit: 100, offset: 0 });
    const statuses = new Set(adminAll.posts.map((post) => post.status));
    smoke.ok(
      'демо-набор содержит все статусы',
      POST_STATUSES.every((status) => statuses.has(status)),
      [...statuses],
    );

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
  } finally {
    if (postId !== null) await prisma.posts.delete({ where: { id: postId } });
    await prisma.$disconnect();
  }

  smoke.done();
}

await main();
