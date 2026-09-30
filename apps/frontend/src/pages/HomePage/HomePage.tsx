// Публичная домашняя страница: два раздела для всех ролей — «Новости» и «Документы».
// Карточки новостей: кнопка «копировать ссылку» для всех и kebab-меню действий для администратора.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Icon, KebabMenu, Pagination, StateMessage, useToast } from '../../components/ui';
import { postsApi, type Post, type PostPayload } from '../../api/posts';
import { documentsApi, type PublicDocument } from '../../api/documents';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Roles } from '../../lib/roles';
import { PostStatuses } from '../../lib/post-status';
import { formatDateTime } from '../../lib/format';
import { copyToClipboard } from '../../lib/clipboard';
import { ORGANIZER_CONTACTS } from '../../lib/contacts';
import { PostContent } from '../../features/posts/PostContent';
import melonLogo from '../../assets/images/Melon.png';
import styles from './HomePage.module.css';

const PAGE_SIZE = 5;

/** Payload публикации целиком (PATCH заменяет документ): текущее состояние + изменения. */
function toPayload(post: Post, override: Partial<PostPayload> = {}): PostPayload {
  return {
    title: post.title,
    content: post.content,
    is_published: post.status !== PostStatuses.draft,
    hide_author: post.hideAuthor,
    scheduled_at: post.scheduledAt,
    archived: post.status === PostStatuses.archived,
    pinned: post.pinned,
    sort_order: post.sortOrder,
    ...override,
  };
}

export function HomePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === Roles.admin;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  // Страница ленты хранится в адресе — ссылка на публикацию со второй страницы
  // восстанавливает нужную страницу: /?page=2#post-15.
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  // Обрабатываем ссылку-якорь один раз за переход; при ручной смене страницы сбрасываем.
  const hashHandledRef = useRef(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<PublicDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await postsApi.feed({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
      setPosts(response.posts);
      setTotal(response.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить публикации');
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError(null);
    try {
      const response = await documentsApi.feed();
      setDocuments(response.documents);
    } catch (caught) {
      setDocumentsError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить документы');
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  /** Смена страницы ленты: адрес сохраняет страницу, якорь сбрасывается. */
  const moveToPage = (nextPage: number, scrollTop = true) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setSearchParams(next, { replace: true });
    if (scrollTop) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Переход по ссылке-якорю: если публикация из хэша не на текущей странице,
  // вычисляем её страницу и переключаемся; прокрутка — отдельным эффектом ниже.
  useEffect(() => {
    if (hashHandledRef.current || loading || posts.length === 0) return;
    const match = /^#post-(\d+)$/.exec(window.location.hash);
    if (!match) return;
    const postId = Number(match[1]);
    if (posts.some((post) => post.id === postId)) return;

    hashHandledRef.current = true;
    let cancelled = false;
    // Все опубликованные посты (бэкенд отдаёт до 100 за запрос) — ищем позицию поста.
    postsApi
      .feed({ limit: 100, offset: 0 })
      .then((all) => {
        if (cancelled) return;
        const position = all.posts.findIndex((post) => post.id === postId);
        if (position === -1) return;
        moveToPage(Math.floor(position / PAGE_SIZE) + 1, false);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, posts]);

  // Прокрутка к карточке, когда она оказалась в текущей загруженной странице.
  useEffect(() => {
    if (loading || posts.length === 0) return;
    const match = /^#post-(\d+)$/.exec(window.location.hash);
    if (!match) return;
    const postId = Number(match[1]);
    if (!posts.some((post) => post.id === postId)) return;
    document.getElementById(`post-${postId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loading, posts]);

  /** Копирование ссылки в буфер с уведомлением. */
  const copyLink = async (url: string) => {
    const copied = await copyToClipboard(url);
    toast.showToast({ message: copied ? 'Ссылка скопирована' : 'Не удалось скопировать', tone: copied ? 'success' : 'error' });
  };

  /** Действие администратора над публикацией: изменить и перезагрузить ленту. */
  const applyPostChange = async (post: Post, override: Partial<PostPayload>, success: string) => {
    try {
      await postsApi.update(post.id, toPayload(post, override));
      toast.showToast({ message: success, tone: 'success' });
      await loadPosts();
    } catch (caught) {
      toast.showToast({ message: caught instanceof ApiError ? caught.message : 'Не удалось изменить публикацию', tone: 'error' });
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>Арбузный грант</h1>
          <p className={styles.heroLead}>
            Приём, экспертиза и рассмотрение заявок в одном месте. Войдите, чтобы подать заявку,
            либо следите за новостями организации ниже.
          </p>
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.feed} aria-label="Новости">
          <header className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Новости</h2>
            {total > 0 ? <span className={styles.count}>{total}</span> : null}
          </header>

          {loading ? (
            <StateMessage state="loading" />
          ) : error ? (
            <StateMessage state="error" message={error} onRetry={() => void loadPosts()} />
          ) : posts.length === 0 ? (
            <StateMessage state="empty" message="Публикаций пока нет" />
          ) : (
            <>
              <div className={styles.posts}>
                {posts.map((post) => (
                  <article key={post.id} id={`post-${post.id}`} className={styles.post}>
                    <div className={styles.postHeader}>
                      <h3 className={styles.postTitle}>{post.title}</h3>
                      <div className={styles.cardActions}>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="link"
                          aria-label="Скопировать ссылку на публикацию"
                          title="Скопировать ссылку"
                          onClick={() => {
                            // Ссылка включает номер страницы, чтобы открыть нужную страницу ленты.
                            const base = `${window.location.origin}${window.location.pathname}`;
                            const pageQuery = page > 1 ? `?page=${page}` : '';
                            void copyLink(`${base}${pageQuery}#post-${post.id}`);
                          }}
                        />
                        {isAdmin ? (
                          <KebabMenu
                            label="Действия с публикацией"
                            items={[
                              { key: 'edit', label: 'Редактировать', icon: 'edit', onSelect: () => navigate(`/admin/posts/${post.id}`) },
                              {
                                key: 'archive',
                                label: 'Заархивировать',
                                icon: 'briefcase',
                                onSelect: () => void applyPostChange(post, { archived: true }, 'Публикация в архиве'),
                              },
                              {
                                key: 'pin',
                                label: post.pinned ? 'Открепить' : 'Прикрепить',
                                icon: 'pin',
                                onSelect: () =>
                                  void applyPostChange(
                                    post,
                                    { pinned: !post.pinned },
                                    post.pinned ? 'Публикация откреплена' : 'Публикация прикреплена наверху',
                                  ),
                              },
                              {
                                key: 'hide',
                                label: 'Скрыть',
                                icon: 'crossed-eye',
                                onSelect: () =>
                                  void applyPostChange(
                                    post,
                                    { is_published: false, scheduled_at: null },
                                    'Публикация скрыта из ленты',
                                  ),
                              },
                            ]}
                          />
                        ) : null}
                      </div>
                    </div>
                    <div className={styles.postMeta}>
                      <time>{formatDateTime(post.createdAt)}</time>
                      {post.pinned ? <span> · прикреплено</span> : null}
                      {/* Автор скрыт, если публикация помечена как обратная связь от организации. */}
                      {post.authorName ? <span> · {post.authorName}</span> : null}
                    </div>
                    {/* HTML санитизируется на сервере (contentHtml); подряд идущие
                        картинки показываются каруселью (PostContent). */}
                    <PostContent html={post.contentHtml} className={styles.postContent} />
                    <PostAttachments post={post} />
                  </article>
                ))}
              </div>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={moveToPage} />
            </>
          )}
        </section>

        <aside className={styles.aside} aria-label="Документы и контакты">
          <section className={styles.sideCard} aria-label="Документы">
            <header className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Документы</h2>
              {documents.length > 0 ? <span className={styles.count}>{documents.length}</span> : null}
            </header>
            {documentsLoading ? (
              <StateMessage state="loading" />
            ) : documentsError ? (
              <StateMessage state="error" message={documentsError} onRetry={() => void loadDocuments()} />
            ) : documents.length === 0 ? (
              <StateMessage state="empty" message="Документов пока нет" />
            ) : (
              <ul className={styles.documents}>
                {documents.map((document) => (
                  <li key={document.id} id={`document-${document.id}`} className={styles.documentItem}>
                    <a
                      href={documentsApi.downloadUrl(document.id)}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.documentLink}
                      title={document.description ?? document.title}
                    >
                      <Icon name="document" size={16} />
                      <span className={styles.documentName}>{document.title}</span>
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="link"
                      aria-label="Скопировать ссылку на документ"
                      title="Скопировать ссылку"
                      onClick={() =>
                        void copyLink(`${window.location.origin}${documentsApi.downloadUrl(document.id)}`)
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.sideCard} aria-label="Контакты организации">
            <h2 className={styles.sectionTitle}>Контакты</h2>
            <ContactValue label="Телефон" value={ORGANIZER_CONTACTS.phone} />
            <ContactValue label="Электронная почта" value={ORGANIZER_CONTACTS.email} />
            <div className={styles.imgContainer}>
              <img src={melonLogo} alt="Арбузный грант" className={styles.heroLogo} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Контакт организаторов: клик копирует значение в буфер обмена. */
function ContactValue({ label, value }: { label: string; value: string }) {
  const toast = useToast();

  const handleCopy = async () => {
    const copied = await copyToClipboard(value);
    toast.showToast({
      message: copied ? 'Контакт скопирован в буфер обмена' : 'Не удалось скопировать',
      tone: copied ? 'success' : 'error',
    });
  };

  return (
    <p className={styles.contactsText}>
      {label}:
      <br />
      <button type="button" className={styles.contactValue} onClick={() => void handleCopy()} title="Скопировать">
        {value}
      </button>
    </p>
  );
}

/** Вложения публикации: кликабельное название, файл открывается в новой вкладке. */
function PostAttachments({ post }: { post: Post }) {
  if (post.attachments.length === 0) return null;

  return (
    <div className={styles.attachments}>
      {post.attachments.map((file) => (
        <a
          key={file.id}
          href={postsApi.files.downloadUrl(post.id, file.id)}
          target="_blank"
          rel="noreferrer"
          className={styles.attachmentLink}
          title={file.name}
        >
          <Icon name="document" size={14} />
          <span className={styles.attachmentName}>{file.name}</span>
        </a>
      ))}
    </div>
  );
}
