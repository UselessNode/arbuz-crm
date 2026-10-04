// Система toast-уведомлений (быстрые уведомления): контекст-провайдер, хук useToast
// и карточка с обратным отсчётом, полосой-таймером и кнопкой действия («Отменить»).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from '../Icon';
import styles from './Toast.module.css';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  action?: ToastAction;
  duration?: number;
}

export interface ToastApi {
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
}

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
  duration: number;
  closing?: boolean;
}

/** Длительность авто-скрытия по умолчанию (мс). */
const DEFAULT_DURATION = 4000;
/** Длительность авто-скрытия для тоста с действием (мс). */
const ACTION_DURATION = 8000;
/** Сколько уведомлений показываем одновременно. */
const MAX_VISIBLE = 3;
/** Длительность анимации выхода; должна совпадать со значением в CSS. */
const EXIT_MS = 160;
/** Шаг обновления обратного отсчёта (мс). */
const TICK_MS = 100;

const TONE_ICON: Record<ToastTone, string> = {
  success: 'success',
  error: 'error',
  info: 'info',
};

const ToastContext = createContext<ToastApi | null>(null);

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

/**
 * Одна карточка: обратный отсчёт до исчезновения (полоса + секунды),
 * пауза при наведении курсора и кнопка действия («Отменить»).
 */
function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const [remaining, setRemaining] = useState(toast.duration);
  const remainingRef = useRef(toast.duration);
  const pausedRef = useRef(false);
  const lastTickRef = useRef(Date.now());

  useEffect(() => {
    remainingRef.current = toast.duration;
    setRemaining(toast.duration);
    lastTickRef.current = Date.now();

    const id = window.setInterval(() => {
      const now = Date.now();
      if (pausedRef.current) {
        // На паузе просто сдвигаем «последний тик», не уменьшая остаток.
        lastTickRef.current = now;
        return;
      }
      remainingRef.current = Math.max(0, remainingRef.current - (now - lastTickRef.current));
      lastTickRef.current = now;
      setRemaining(remainingRef.current);
      if (remainingRef.current <= 0) {
        window.clearInterval(id);
        onDismiss(toast.id);
      }
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [toast.duration, toast.id, onDismiss]);

  const handleAction = () => {
    toast.action?.onClick();
    onDismiss(toast.id);
  };

  const progress = toast.duration > 0 ? Math.max(0, Math.min(100, (remaining / toast.duration) * 100)) : 100;
  const seconds = Math.ceil(remaining / 1000);

  return (
    <div
      className={`${styles.toast} ${styles[toast.tone]}${toast.closing ? ` ${styles.closing}` : ''}`}
      role="status"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
    >
      <div className={styles.row}>
        <span className={styles.icon}>
          <Icon name={TONE_ICON[toast.tone]} size={18} />
        </span>
        <span className={styles.message}>{toast.message}</span>
        {toast.action ? (
          <button type="button" className={styles.action} onClick={handleAction}>
            {toast.action.label}
          </button>
        ) : null}
        <span className={styles.timer} aria-hidden="true">
          {seconds}с
        </span>
        <button type="button" className={styles.close} onClick={() => onDismiss(toast.id)} aria-label="Закрыть">
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className={styles.progressTrack} aria-hidden="true">
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const exitTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const removeToast = useCallback((id: string) => {
    exitTimersRef.current.delete(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const dismissToast = useCallback(
    (id: string) => {
      // Помечаем тост закрывающимся, чтобы проигралась анимация, и убираем после неё.
      setToasts((prev) => prev.map((toast) => (toast.id === id ? { ...toast, closing: true } : toast)));
      if (!exitTimersRef.current.has(id)) {
        exitTimersRef.current.set(id, setTimeout(() => removeToast(id), EXIT_MS));
      }
    },
    [removeToast],
  );

  const showToast = useCallback((options: ToastOptions): string => {
    idRef.current += 1;
    const id = `toast-${idRef.current}`;
    const item: ToastItem = {
      id,
      message: options.message,
      tone: options.tone ?? 'info',
      action: options.action,
      duration: options.duration ?? (options.action ? ACTION_DURATION : DEFAULT_DURATION),
    };
    setToasts((prev) => {
      const next = [...prev, item];
      // Оставляем только последние MAX_VISIBLE уведомлений.
      return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
    });
    return id;
  }, []);

  // Очищаем все таймеры выхода при размонтировании провайдера.
  useEffect(() => {
    const timers = exitTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.container}>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast должен использоваться внутри ToastProvider');
  }
  return context;
}
