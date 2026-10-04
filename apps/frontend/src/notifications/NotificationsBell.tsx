// Колокольчик центра уведомлений: бейдж непрочитанных, выпадающая панель со списком,
// фильтр по типу и пометка прочитанным. Используется в шапках публичной и рабочей зон.
//
// На мобильных вместо выпадающей панели открывается отдельная страница `/notifications`.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Icon, StateMessage, useIsMobile } from '../components/ui';
import { notificationsApi, type NotificationItem } from '../api/notifications';
import { ApiError } from '../api/client';
import { NOTIFICATION_TYPE_META } from '../lib/notification-types';
import { formatDateTime } from '../lib/format';
import { NotificationFilters, type NotificationFilter } from './NotificationFilters';
import { useNotifications } from './NotificationsContext';
import styles from './NotificationsBell.module.css';

/** Сколько уведомлений подгружаем за раз при открытии панели. */
const PAGE_SIZE = 50;

export function NotificationsBell() {
  const { unread, refreshUnread, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const panelId = useId();

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

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
      setTotal(response.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить уведомления');
    } finally {
      setLoading(false);
    }
  }, []);

  // При открытии — загрузка списка; закрытие по клику вне и по Escape.
  useEffect(() => {
    if (!open) return undefined;
    void load(filter);
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && wrapperRef.current && !wrapperRef.current.contains(target)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, filter, load]);

  // Возврат на вкладку — обновляем счётчик (список подтянем при следующем открытии).
  useEffect(() => {
    if (!open) void refreshUnread();
  }, [open, refreshUnread]);

  const goToPage = () => {
    setOpen(false);
    navigate('/notifications');
  };

  const handleOpen = () => {
    // На мобильных выпадающая панель неудобна — открываем отдельную страницу.
    if (isMobile) {
      goToPage();
      return;
    }
    setOpen((prev) => !prev);
  };

  const handleRead = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await markRead(item.id);
        setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)));
      } catch {
        /* игнорируем: переход всё равно выполняем */
      }
    }
    setOpen(false);
    // Есть ссылка — ведём по ней; иначе открываем уведомление на странице (подробнее).
    if (item.link) navigate(item.link);
    else navigate(`/notifications?id=${item.id}`);
  };

  const handleMarkOne = async (event: React.MouseEvent, item: NotificationItem) => {
    event.stopPropagation();
    if (item.isRead) return;
    try {
      await markRead(item.id);
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)));
    } catch {
      /* тихо */
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

  const badgeLabel = unread > 99 ? '99+' : String(unread);

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup={isMobile ? undefined : 'dialog'}
        aria-expanded={isMobile ? undefined : open}
        aria-controls={!isMobile && open ? panelId : undefined}
        aria-label={unread > 0 ? `Уведомления, непрочитанных: ${unread}` : 'Уведомления'}
        title="Уведомления"
        onClick={handleOpen}
      >
        <Icon name="bell" size={18} />
        {unread > 0 ? (
          <span className={styles.badge} aria-hidden="true">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {open ? (
        <div id={panelId} role="dialog" aria-label="Центр уведомлений" className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Уведомления</span>
            <Button
              size="sm"
              variant="ghost"
              icon="check"
              disabled={unread === 0}
              onClick={() => void handleMarkAll()}
            >
              Прочитать все
            </Button>
          </div>

          <div className={styles.filtersBar}>
            <NotificationFilters value={filter} onChange={setFilter} />
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
                  <div
                    key={item.id}
                    className={`${styles.item} ${styles.itemClickable} ${item.isRead ? '' : styles.itemUnread}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => void handleRead(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void handleRead(item);
                      }
                    }}
                  >
                    <span className={styles.itemIcon} aria-hidden="true">
                      <Icon name={meta.icon} size={16} />
                    </span>
                    <div className={styles.itemBody}>
                      <div className={styles.itemTop}>
                        <span className={styles.itemTitle}>{item.title}</span>
                        <span className={styles.itemDate}>{formatDateTime(item.createdAt)}</span>
                      </div>
                      {item.bodyHtml ? (
                        <div className={styles.itemText} dangerouslySetInnerHTML={{ __html: item.bodyHtml }} />
                      ) : null}
                    </div>
                    {!item.isRead ? (
                      <button
                        type="button"
                        className={styles.markRead}
                        title="Отметить прочитанным"
                        aria-label="Отметить прочитанным"
                        onClick={(event) => void handleMarkOne(event, item)}
                      >
                        <Icon name="check" size={14} />
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className={styles.footer}>
            <span className={styles.footerInfo}>
              {total > items.length ? `Показаны последние ${items.length} из ${total}` : ''}
            </span>
            <button type="button" className={styles.footerLink} onClick={goToPage}>
              Все уведомления
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
