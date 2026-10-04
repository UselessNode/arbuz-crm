// Единая точка входа библиотеки компонентов (design system).
export { Icon, ICON_NAMES } from './Icon';
export type { IconName, IconProps } from './Icon';

export { Button } from './Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button';

export { Badge, StatusBadge, ROLE_OPTIONS, BADGE_TONES, toBadgeTone } from './Badge';
export type { BadgeProps, BadgeTone, StatusBadgeProps, StatusOption } from './Badge';

export { Container } from './Container';
export type { ContainerProps } from './Container';
export { Accordion, AccordionItem } from './Container';
export type { AccordionProps, AccordionItemProps } from './Container';
export { Carousel } from './Container';
export type { CarouselProps } from './Container';

export { DragDrop } from './DragDrop';
export type { DragDropProps } from './DragDrop';

export { Input } from './Form';
export type { InputProps } from './Form';
export { NumberInput } from './Form';
export type { NumberInputProps } from './Form';
export { Slider } from './Form';
export type { SliderProps } from './Form';
export { RangeSlider } from './Form';
export type { RangeSliderProps } from './Form';
export { DatePicker } from './Form';
export type { DatePickerProps } from './Form';
export { DateInput } from './Form';
export type { DateInputProps } from './Form';
export { RangeDatePicker } from './Form';
export type { RangeDatePickerProps } from './Form';
export { DateRangeInput } from './Form';
export type { DateRangeInputProps } from './Form';
export { EMPTY_DATE_RANGE, isDateRangeEmpty, stepDateRange } from './Form';
export type { DateRange } from './Form';
export { moveRangeHandle } from './Form';
export type { NumericRange } from './Form';
export { Select } from './Form';
export type { SelectProps, SelectOption } from './Form';
export { Textarea } from './Form';
export type { TextareaProps } from './Form';
export { Checkbox } from './Form';
export type { CheckboxProps } from './Form';

export { Table, useTableReorder } from './Table';
export type {
  TableColumn,
  TableProps,
  TableSelection,
  TableReorderApi,
  TableReorderOptions,
} from './Table';

export { ListToolbar, SearchInput } from './ListToolbar';
export type { ListToolbarProps, SearchInputProps } from './ListToolbar';

// Централизованная панель управления списком (поиск/фильтры/сортировка/URL-синк).
export {
  DEFAULT_PAGE_SIZE,
  DataView,
  activeFilters,
  cycleSort,
  hasActiveFilters,
  isDataViewParam,
  isFilterValueEmpty,
  readQuery,
  removeFilterValue,
  useDataViewState,
  writeQuery,
} from './DataView';
export type {
  ActiveFilter,
  CheckboxGroupSpec,
  DataViewColumn,
  DataViewMode,
  DataViewProps,
  DataViewQuery,
  DataViewSort,
  DataViewState,
  DataViewStateOptions,
  DateRangeSpec,
  DateRangeValue,
  FilterOption,
  FilterSpec,
  FilterValue,
  MultiSelectSpec,
  QueryDefaults,
  RangeSpec,
  RangeValue,
  SelectSpec,
} from './DataView';

// Примитивы фильтрации (используются внутри DataView, доступны и отдельно).
export { ActiveFilters, CheckboxGroupFilter, DateRangeFilter, MultiSelectFilter, RangeFilter, SearchField } from './Filters';
export type {
  ActiveFiltersProps,
  CheckboxGroupFilterProps,
  DateRangeFilterProps,
  MultiSelectFilterProps,
  RangeFilterProps,
  SearchFieldProps,
} from './Filters';

export { StateMessage } from './Feedback';
export type { StateMessageProps } from './Feedback';
export { Modal } from './Feedback';
export type { ModalProps } from './Feedback';
export { ConfirmDialog } from './Feedback';
export type { ConfirmDialogProps } from './Feedback';

export { Pagination } from './Pagination';
export type { PaginationProps } from './Pagination';

export { SectionHint } from './SectionHint';
export type { SectionHintProps } from './SectionHint';

export { KebabMenu } from './Menu/KebabMenu';
export type { KebabMenuProps, KebabMenuItem } from './Menu/KebabMenu';

export { RowActions } from './RowActions';
export type { RowActionItem } from './RowActions';
export { useIsMobile } from './Hooks/useIsMobile';

// `MarkdownEditor` намеренно не реэкспортируется: он тянет MDXEditor (~700 КБ).
// Статический реэкспорт из barrel втянул бы редактор в основной чанк для всех страниц.
// Импортировать только лениво: `lazy(() => import('.../components/ui/MarkdownEditor'))`.

export { ToastProvider, useToast } from './Toast';
export type { ToastAction, ToastApi, ToastOptions, ToastTone } from './Toast';
