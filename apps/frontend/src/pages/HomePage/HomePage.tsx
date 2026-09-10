// Публичная домашняя страница: лента публикаций + контакты организации.
import { useCallback, useEffect, useState } from 'react';
import { Pagination, StateMessage } from '../../components/ui';
import { postsApi, type Post } from '../../api/posts';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import styles from './HomePage.module.css';

const PAGE_SIZE = 5;

export function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await postsApi.list({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
      setPosts(response.posts);
      setTotal(response.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить публикации');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Грантовые заявки для НКО</p>
        <h1 className={styles.heroTitle}>Arbuz CRM</h1>
        <p className={styles.heroLead}>
          Приём, экспертиза и рассмотрение заявок в одном месте. Войдите, чтобы подать заявку,
          либо следите за новостями организации ниже.
        </p>
      </section>

      <div className={styles.grid}>
        <section className={styles.feed} aria-label="Публикации и новости">
          <header className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Публикации и новости</h2>
            {total > 0 ? <span className={styles.count}>{total}</span> : null}
          </header>

          {loading ? (
            <StateMessage state="loading" />
          ) : error ? (
            <StateMessage state="error" message={error} onRetry={() => void load()} />
          ) : posts.length === 0 ? (
            <StateMessage state="empty" message="Публикаций пока нет" />
          ) : (
            <>
              <div className={styles.posts}>
                {posts.map((post) => (
                  <article key={post.id} className={styles.post}>
                    <h3 className={styles.postTitle}>{post.title}</h3>
                    <div className={styles.postMeta}>
                      <time>{formatDateTime(post.createdAt)}</time>
                      {post.authorName ? <span> · {post.authorName}</span> : null}
                    </div>
                    {/* HTML санитизируется на сервере (contentHtml). */}
                    <div className={styles.postContent} dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
                  </article>
                ))}
              </div>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </>
          )}
        </section>

        <aside className={styles.contacts} aria-label="Контакты организации">
          <h2 className={styles.sectionTitle}>Контакты</h2>
          {/* TODO(contacts): заменить на реальные контактные данные организации
              (адрес, телефон, email, ссылки) и вынести в редактируемые настройки. */}
          <p className={styles.contactsText} data-todo="contacts">
            Контактная информация организации будет добавлена.
          </p>
        </aside>
      </div>
    </div>
  );
}
