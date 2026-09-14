// Русские подписи интерфейса MDXEditor.
//
// Редактор вызывает `translation(key, defaultValue, { … })`: ключи и английские
// значения берутся из его встроенного словаря. Здесь переведены все строки,
// которые видит пользователь; неизвестный ключ остаётся английским.
import type { Translation } from '@mdxeditor/editor';

const RU: Record<string, string> = {
  'contentArea.editableMarkdown': 'область редактирования markdown',

  'dialog.close': 'Закрыть окно',
  'dialogControls.cancel': 'Отмена',
  'dialogControls.save': 'Сохранить',

  // Панель инструментов
  'toolbar.undo': 'Отменить {{shortcut}}',
  'toolbar.redo': 'Вернуть {{shortcut}}',
  'toolbar.toggleGroup': 'группа переключателей',
  'toolbar.bold': 'Полужирный',
  'toolbar.removeBold': 'Убрать полужирный',
  'toolbar.italic': 'Курсив',
  'toolbar.removeItalic': 'Убрать курсив',
  'toolbar.underline': 'Подчёркнутый',
  'toolbar.removeUnderline': 'Убрать подчёркивание',
  'toolbar.strikethrough': 'Зачёркнутый',
  'toolbar.removeStrikethrough': 'Убрать зачёркивание',
  'toolbar.highlight': 'Выделить цветом',
  'toolbar.removeHighlight': 'Убрать выделение',
  'toolbar.inlineCode': 'Строчный код',
  'toolbar.removeInlineCode': 'Убрать строчный код',
  'toolbar.superscript': 'Верхний индекс',
  'toolbar.removeSuperscript': 'Убрать верхний индекс',
  'toolbar.subscript': 'Нижний индекс',
  'toolbar.removeSubscript': 'Убрать нижний индекс',
  'toolbar.bulletedList': 'Маркированный список',
  'toolbar.numberedList': 'Нумерованный список',
  'toolbar.checkList': 'Список с флажками',
  'toolbar.table': 'Вставить таблицу',
  'toolbar.thematicBreak': 'Вставить разделитель',
  'toolbar.link': 'Вставить ссылку',
  'toolbar.image': 'Вставить изображение',

  // Стили блока
  'toolbar.blockTypeSelect.placeholder': 'Стиль блока',
  'toolbar.blockTypeSelect.selectBlockTypeTooltip': 'Выберите стиль блока',
  'toolbar.blockTypes.paragraph': 'Обычный текст',
  'toolbar.blockTypes.heading': 'Заголовок {{level}}',
  'toolbar.blockTypes.quote': 'Цитата',

  // Диалог ссылки
  'createLink.title': 'Подпись ссылки',
  'createLink.text': 'Текст ссылки',
  'createLink.url': 'Адрес (URL)',
  'createLink.urlPlaceholder': 'Вставьте или выберите адрес',
  'createLink.titleTooltip': 'Атрибут title: показывается при наведении курсора',
  'createLink.textTooltip': 'Текст, который будет показан как ссылка',
  'createLink.cancelTooltip': 'Отменить изменение',
  'createLink.saveTooltip': 'Применить адрес',

  'linkPreview.copied': 'Скопировано',
  'linkPreview.copyToClipboard': 'Скопировать в буфер обмена',
  'linkPreview.edit': 'Изменить адрес ссылки',
  'linkPreview.remove': 'Удалить ссылку',

  // Таблица
  'table.textAlignment': 'Выравнивание текста',
  'table.alignLeft': 'По левому краю',
  'table.alignCenter': 'По центру',
  'table.alignRight': 'По правому краю',
  'table.columnMenu': 'Меню столбца',
  'table.rowMenu': 'Меню строки',
  'table.deleteColumn': 'Удалить столбец',
  'table.deleteRow': 'Удалить строку',
  'table.deleteTable': 'Удалить таблицу',
  'table.insertColumnLeft': 'Вставить столбец слева',
  'table.insertColumnRight': 'Вставить столбец справа',
  'table.insertRowAbove': 'Вставить строку выше',
  'table.insertRowBelow': 'Вставить строку ниже',

  // Изображения
  'uploadImage.dialogTitle': 'Вставка изображения',
  'uploadImage.uploadInstructions': 'Загрузите изображение с устройства:',
  'uploadImage.addViaUrlInstructions': 'Или укажите адрес изображения:',
  'uploadImage.addViaUrlInstructionsNoUpload': 'Укажите адрес изображения:',
  'uploadImage.autoCompletePlaceholder': 'Вставьте или выберите адрес изображения',
  'uploadImage.alt': 'Альтернативный текст:',
  'uploadImage.title': 'Подпись:',
  'uploadImage.width': 'Ширина:',
  'uploadImage.height': 'Высота:',
  'imageEditor.editImage': 'Изменить изображение',
  'imageEditor.deleteImage': 'Удалить изображение',

  // Блок кода
  'codeBlock.language': 'Язык блока кода',
  'codeBlock.selectLanguage': 'Выберите язык блока кода',
  'codeBlock.inlineLanguage': 'Язык',
  'codeblock.delete': 'Удалить блок кода',
};

/** Функция перевода для `<MDXEditor translation={…}>`. */
export const ruTranslation: Translation = (key, defaultValue, interpolations = {}) => {
  let value = RU[key] ?? defaultValue;
  for (const [name, replacement] of Object.entries(interpolations)) {
    // replaceAll недоступен при текущем target — заменяем через split/join.
    value = value.split(`{{${name}}}`).join(String(replacement));
  }
  return value;
};
