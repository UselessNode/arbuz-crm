// Отрисовка диалога подтверждения паролем для массового удаления.
// Принимает `dialog` из `useBulkDelete` — единая форма сообщения во всех разделах.
import { ConfirmPasswordDialog } from '../../components/ui';
import type { useBulkDelete } from '../../lib/use-bulk-delete';

export interface BulkDeleteDialogProps {
  dialog: ReturnType<typeof useBulkDelete>['dialog'];
}

export function BulkDeleteDialog({ dialog }: BulkDeleteDialogProps) {
  return (
    <ConfirmPasswordDialog
      open={dialog.open}
      title="Массовое удаление"
      message={<>Удалить выбранные записи ({dialog.count}) из раздела «{dialog.entityLabel}»?</>}
      confirmLabel="Удалить"
      danger
      loading={dialog.loading}
      error={dialog.error}
      onConfirm={dialog.onConfirm}
      onClose={dialog.onClose}
    />
  );
}
