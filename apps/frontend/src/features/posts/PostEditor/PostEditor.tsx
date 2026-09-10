// WYSIWYG-редактор поста: пользователь форматирует текст кнопками,
// на выходе — Markdown (хранится в posts.content, HTML рендерит сервер).
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  ListsToggle,
  MDXEditor,
  Separator,
  UndoRedo,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import styles from './PostEditor.module.css';

interface Props {
  markdown: string;
  onChange: (markdown: string) => void;
}

export function PostEditor({ markdown, onChange }: Props) {
  return (
    <div className={styles.editor}>
      <MDXEditor
        markdown={markdown}
        onChange={onChange}
        placeholder="Начните печатать текст публикации…"
        contentEditableClassName={styles.content}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <Separator />
                <BoldItalicUnderlineToggles />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <ListsToggle />
                <Separator />
                <CreateLink />
              </>
            ),
          }),
        ]}
      />
    </div>
  );
}
