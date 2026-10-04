// Страница центра уведомлений: список в сайдбаре и текст выбранного уведомления.
//
// Открывается из колокольчика («Все уведомления») и на мобильных вместо выпадающей панели.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Container, Icon, StateMessage, useIsMobile } from '../components/ui';
import { notificationsApi, type NotificationItem } from '../api/notifications';
import { ApiError } from '../api/client';
import { NOTIFICATION_TYPE_META } from '../lib/notification-types';
import { formatDateTime } from '../lib/format';
import { PostContent } from '../features/posts/PostContent';
import { NotificationFilters, type NotificationFilter } from './NotificationFilters';
import { useNotifications } from './NotificationsContext';
import styles from './NotificationsPage.module.css';

/** Загружаем весь список (≤100) — страница должна открываться на конкретном уведомлении. */
const PAGE_SIZE = 100;

export function NotificationsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { unread, markRead, markAllRead } = useNotifications();

  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async (nextFilter: NotificationFilter) => {
    setLoading(true);
    setError(null);
    try {
      const response = await notificationsApi.list({
        type: nextFilter === 'all' ? undefined : nextFilter,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setItems(response.notifications);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить уведомления');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  // Глубокая ссылка `/notifications?id=N` — сразу открываем нужное уведомление.
  useEffect(() => {
    const raw = searchParams.get('id');
    const id = Number(raw);
    if (raw && Number.isInteger(id) && id > 0) setSelectedId(id);
  }, [searchParams]);

  const clearSelection = () => {
    setSelectedId(null);
    if (searchParams.has('id')) setSearchParams({}, { replace: true });
  };

  const handleFilter = (next: NotificationFilter) => {
    setFilter(next);
    clearSelection();
  };

  const selectItem = async (item: NotificationItem) => {
    setSelectedId(item.id);
    setSearchParams({ id: String(item.id) }, { replace: true });
    if (!item.isRead) {
      try {
        await markRead(item.id);
        setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)));
      } catch {
        /* тихо: отметка не критична */
      }
    }
  };

  const handleMarkAll = async () => {
    if (unread === 0) return;
    try {
      await markAllRead();
      setItems((prev) => prev.map((row) => ({ ...row, isRead: true })));
    } catch {
      /* тихо */
    }
  };

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const selectedMeta = selected ? NOTIFICATION_TYPE_META[selected.type] : null;

  return (
    <Container
      title="Уведомления"
      actions={
        <Button variant="secondary" icon="check" disabled={unread === 0} onClick={() => void handleMarkAll()}>
          Прочитать все
        </Button>
      }
    >
      <div className={styles.layout}>
        <aside className={`${styles.sidebar} ${isMobile && selected ? styles.hiddenOnMobile : ''}`}>
          <div className={styles.filtersBar}>
            <NotificationFilters value={filter} onChange={handleFilter} />
          </div>
          <div className={styles.list}>
            {loading ? (
              <StateMessage state="loading" />
            ) : error ? (
              <StateMessage state="error" message={error} onRetry={() => void load(filter)} />
            ) : items.length === 0 ? (
              <StateMessage state="empty" message="Уведомлений нет" />
            ) : (
              items.map((item) => {
                const meta = NOTIFICATION_TYPE_META[item.type];
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.item} ${selectedId === item.id ? styles.itemActive : ''} ${
                      item.isRead ? '' : styles.itemUnread
                    }`}
                    onClick={() => void selectItem(item)}
                  >
                    <span className={styles.itemIcon} aria-hidden="true">
                      <Icon name={meta.icon} size={16} />
                    </span>
                    <span className={styles.itemMain}>
                      <span className={styles.itemTitleRow}>
                        <span className={styles.itemTitle}>{item.title}</span>
                        <span className={styles.itemDate}>{formatDateTime(item.createdAt)}</span>
                      </span>
                      {item.body ? <span className={styles.itemPreview}>{item.body}</span> : null}
                    </span>
                    {!item.isRead ? <span className={styles.dot} aria-hidden="true" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className={`${styles.detail} ${isMobile && !selected ? styles.hiddenOnMobile : ''}`}>
          {selected && selectedMeta ? (
            <>
              <div className={styles.detailHeader}>
                {isMobile ? (
                  <Button variant="ghost" size="sm" icon="arrow-left" onClick={clearSelection}>
                    К списку
                  </Button>
                ) : null}
                <Badge tone={selectedMeta.tone} icon={selectedMeta.icon}>
                  {selectedMeta.label}
                </Badge>
                <span className={styles.detailDate}>{formatDateTime(selected.createdAt)}</span>
              </div>
              <h2 className={styles.detailTitle}>{selected.title}</h2>
              {selected.bodyHtml ? (
                <PostContent html={selected.bodyHtml} className={styles.detailBody} />
              ) : (
                <p className={styles.detailEmpty}>Без дополнительного текста</p>
              )}
              {selected.link ? (
                <div className={styles.detailActions}>
                  <Button icon="arrow-right" iconPosition="end" onClick={() => navigate(selected.link as string)}>
                    Перейти
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <StateMessage state="empty" message="Выберите уведомление слева" />
          )}
        </section>
      </div>
    </Container>
  );
}
