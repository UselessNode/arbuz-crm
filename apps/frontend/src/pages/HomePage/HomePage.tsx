// Публичная домашняя страница: лента публикаций + контакты организации.
import { useCallback, useEffect, useState } from 'react';
import { Icon, Pagination, StateMessage, useToast } from '../../components/ui';
import { postsApi, type Post } from '../../api/posts';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import { copyToClipboard } from '../../lib/clipboard';
import { ORGANIZER_CONTACTS } from '../../lib/contacts';
import melonLogo from '../../assets/images/Melon.png';
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
      const response = await postsApi.feed({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
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

        <div>
          <h1 className={styles.heroTitle}>Арбузный грант</h1>
          <p className={styles.heroLead}>
            Приём, экспертиза и рассмотрение заявок в одном месте. Войдите, чтобы подать заявку,
            либо следите за новостями организации ниже.
          </p>
        </div>
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
                      {/* Автор скрыт, если публикация помечена как обратная связь от организации. */}
                      {post.authorName ? <span> · {post.authorName}</span> : null}
                    </div>
                    {/* HTML санитизируется на сервере (contentHtml). */}
                    <div className={styles.postContent} dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
                    <PostAttachments post={post} />
                  </article>
                ))}
              </div>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </>
          )}
        </section>

        <aside className={styles.contacts} aria-label="Контакты организации">
          <h2 className={styles.sectionTitle}>Контакты</h2>
          <ContactValue label="Телефон" value={ORGANIZER_CONTACTS.phone} />
          <ContactValue label="Электронная почта" value={ORGANIZER_CONTACTS.email} />
          <p className={styles.contactsHint}>Нажмите на контакт, чтобы скопировать его.</p>
          <div className={styles.imgContainer}>
            <img src={melonLogo} alt="Арбузный грант" className={styles.heroLogo} />
          </div>
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
