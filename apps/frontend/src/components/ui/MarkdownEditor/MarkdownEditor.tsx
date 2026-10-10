// Универсальный WYSIWYG-редактор: пользователь форматирует текст кнопками,
// на выходе — Markdown (HTML рендерит и санитизирует сервер).
//
// Компонент тяжёлый (MDXEditor), поэтому подключается только лениво:
//   const MarkdownEditor = lazy(() => import('../../components/ui/MarkdownEditor')...);
// По этой же причине он намеренно НЕ экспортируется из barrel `components/ui`:
// статический реэкспорт втянул бы редактор в основной чанк (см. комментарий в barrel).
import {
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ButtonWithTooltip,
  CodeToggle,
  CreateLink,
  HighlightToggle,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  Separator,
  StrikeThroughSupSubToggles,
  UndoRedo,
  headingsPlugin,
  iconComponentFor$,
  imagePlugin,
  insertMarkdown$,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  useCellValue,
  usePublisher,
  type MDXEditorMethods,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { useEffect, useRef } from 'react';
import { ruTranslation } from './translations';
import styles from './MarkdownEditor.module.css';

export interface MarkdownEditorProps {
  /** Текущее содержимое в Markdown. */
  markdown: string;
  /** Новое содержимое при правке. */
  onChange: (markdown: string) => void;
  /**
   * Загрузка картинки, вставленной прямо в текст: возвращает адрес для `src`.
   * Если не задана — остаётся только вставка по внешнему адресу.
   */
  uploadImage?: (file: File) => Promise<string>;
  placeholder?: string;
  /** Только чтение (без панели инструментов). */
  readOnly?: boolean;
}

/** Маркер выноски GitHub-стиля: бэкенд превращает его в блок `callout`. */
const CALLOUT_MARKDOWN = '> [!NOTE]\n> ';

/** Кнопка «Выноска»: вставляет цитату с маркером `[!NOTE]`. */
function CalloutButton() {
  const insertMarkdown = usePublisher(insertMarkdown$);
  const iconComponentFor = useCellValue(iconComponentFor$);

  return (
    <ButtonWithTooltip title="Вставить выноску" onClick={() => insertMarkdown(CALLOUT_MARKDOWN)}>
      {iconComponentFor('admonition')}
    </ButtonWithTooltip>
  );
}

export function MarkdownEditor({ markdown, onChange, uploadImage, placeholder, readOnly = false }: MarkdownEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  // Последнее значение, которое редактор отдал наружу — чтобы не перетирать
  // содержимое при вводе пользователем (markdown-проп меняется именно из-за него).
  const lastEmitted = useRef(markdown);

  // Внешнее изменение markdown (например, переключение вкладки или догрузка
  // публикации): MDXEditor сам не реагирует на новый проп, поэтому применяем явно.
  useEffect(() => {
    if (markdown === lastEmitted.current) return;
    lastEmitted.current = markdown;
    editorRef.current?.setMarkdown(markdown);
  }, [markdown]);

  const handleChange = (value: string) => {
    lastEmitted.current = value;
    onChange(value);
  };

  return (
    <div className={styles.editor}>
      <MDXEditor
        ref={editorRef}
        markdown={markdown}
        onChange={handleChange}
        readOnly={readOnly}
        placeholder={placeholder}
        translation={ruTranslation}
        contentEditableClassName={styles.content}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          // tablePlugin обязателен для InsertTable — без него кнопка ничего не делает.
          tablePlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          markdownShortcutPlugin(),
          imagePlugin({
            imageUploadHandler: uploadImage ?? null,
            // Изменение размеров хранится атрибутами, которые санитайзер вырезает,
            // поэтому ресайз отключён — картинка масштабируется по ширине текста.
            disableImageResize: true,
          }),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <BoldItalicUnderlineToggles />
                <CodeToggle />
                <StrikeThroughSupSubToggles />
                <HighlightToggle />
                <Separator />
                <ListsToggle />
                <Separator />
                <InsertTable />
                <InsertThematicBreak />
                <Separator />
                <CreateLink />
                <InsertImage />
                <CalloutButton />
              </>
            ),
          }),
        ]}
      />
    </div>
  );
}
