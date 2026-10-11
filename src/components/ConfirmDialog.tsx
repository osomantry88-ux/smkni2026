import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  variant = 'danger',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const buttonColor =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-200'
      : 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-200';

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            variant === 'danger' ? 'bg-red-50' : 'bg-amber-50'
          }`}
        >
          <AlertTriangle
            className={`w-5 h-5 ${variant === 'danger' ? 'text-red-600' : 'text-amber-600'}`}
          />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-600">{message}</p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm focus:ring-2 focus:outline-none transition ${buttonColor}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
