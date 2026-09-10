// Публичная домашняя страница: лента публикаций + контакты организации.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Pagination, StateMessage } from '../../components/ui';
import { postsApi, type Post } from '../../api/posts';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import styles from './HomePage.module.css';

const PAGE_SIZE = 5;

export function HomePage() {
  const navigate = useNavigate();
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
        <h1 className={styles.heroTitle}>Arbuz CRM</h1>
        <p className={styles.heroLead}>Приём и рассмотрение грантовых заявок для НКО.</p>
        <Button icon="login" onClick={() => navigate('/login')}>
          Войти в систему
        </Button>
      </section>

      <div className={styles.grid}>
        <section className={styles.feed}>
          <h2 className={styles.sectionTitle}>Публикации и новости</h2>
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
                      {formatDateTime(post.createdAt)}
                      {post.authorName ? ` · ${post.authorName}` : ''}
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

        <aside className={styles.contacts}>
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
