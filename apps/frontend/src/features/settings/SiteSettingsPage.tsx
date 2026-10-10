// Раздел «Настройки сайта» (admin): тексты публичных блоков и справочник регионов.
// Каждая текстовая секция — отдельная вкладка (1 секция = 1 вкладка) + вкладка «Регионы».
// Тексты редактируются тем же механизмом, что и тексты согласий:
// Markdown через WYSIWYG, рендер и санитизация HTML — на сервере.
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Button, Container, StateMessage, useToast } from '../../components/ui';
import { SITE_SETTING_KEYS, SITE_SETTING_LABELS, siteSettingsApi, type SiteSettingKey } from '../../api/site';
import { ApiError } from '../../api/client';
import { RegionsPanel } from './RegionsPanel';
import styles from './SiteSettingsPage.module.css';

// Тяжёлый WYSIWYG-редактор грузим лениво (не попадает в основной чанк).
const MarkdownEditor = lazy(() =>
  import('../../components/ui/MarkdownEditor/MarkdownEditor').then((module) => ({ default: module.MarkdownEditor })),
);

type Tab = SiteSettingKey | 'regions';

export function SiteSettingsPage() {
  const [tab, setTab] = useState<Tab>(SITE_SETTING_KEYS[0]);

  const tabs: ReadonlyArray<{ id: Tab; label: string }> = [
    ...SITE_SETTING_KEYS.map((key) => ({ id: key as Tab, label: SITE_SETTING_LABELS[key] })),
    { id: 'regions', label: 'Регионы' },
  ];

  return (
    <div>
      <h1 className={styles.pageTitle}>Настройки сайта</h1>
      <div className={styles.tabs} role="tablist" aria-label="Разделы">
        {tabs.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={tab === item.id ? 'primary' : 'secondary'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {tab === 'regions' ? <RegionsPanel /> : <TextsPanel activeKey={tab} />}
    </div>
  );
}

/**
 * Панель одной текстовой секции: загружает все ключи (бэкенд отдаёт их разом),
 * но показывает и сохраняет только активную вкладку.
 */
function TextsPanel({ activeKey }: { activeKey: SiteSettingKey }) {
  const toast = useToast();
  const [drafts, setDrafts] = useState<Partial<Record<SiteSettingKey, string>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<SiteSettingKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await siteSettingsApi.list();
      setDrafts(Object.fromEntries(response.settings.map((item) => [item.key, item.text])));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadImage = (key: SiteSettingKey) => async (file: File): Promise<string> => {
    const response = await siteSettingsApi.uploadImage(key, file);
    return response.url;
  };

  const handleSave = async (key: SiteSettingKey) => {
    setSavingKey(key);
    try {
      await siteSettingsApi.update(key, drafts[key] ?? '');
      toast.showToast({ message: 'Настройка сохранена', tone: 'success' });
    } catch (caught) {
      toast.showToast({ message: caught instanceof ApiError ? caught.message : 'Не удалось сохранить', tone: 'error' });
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) return <StateMessage state="loading" />;
  if (error) return <StateMessage state="error" message={error} onRetry={() => void load()} />;

  return (
    <Container
      title={SITE_SETTING_LABELS[activeKey]}
      actions={
        <Button size="sm" icon="check" loading={savingKey === activeKey} onClick={() => void handleSave(activeKey)}>
          Сохранить
        </Button>
      }
    >
      <p className={styles.hint}>
        Поддерживается разметка Markdown (заголовки, списки, ссылки, изображения). Ссылки на сторонние
        источники указывайте в виде <code>[подпись](https://…)</code>.
      </p>
      <Suspense fallback={<StateMessage state="loading" />}>
        <MarkdownEditor
          markdown={drafts[activeKey] ?? ''}
          onChange={(value) => setDrafts((prev) => ({ ...prev, [activeKey]: value }))}
          uploadImage={uploadImage(activeKey)}
          placeholder="Введите текст блока…"
        />
      </Suspense>
    </Container>
  );
}
