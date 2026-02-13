
import { SweetAlertIcon } from 'sweetalert2';

// Type definitions for our custom alert system
export type AlertType = 'alert' | 'toast' | 'confirm' | 'prompt';

export interface AlertOptions {
  id: string;
  type: AlertType;
  title: string;
  text?: string;
  icon?: SweetAlertIcon;
  confirmText?: string;
  cancelText?: string;
  placeholder?: string;
  input?: string;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
  timer?: number;
}

// Event bus to communicate with the React UI
class AlertBus extends EventTarget {
  emit(options: AlertOptions) {
    this.dispatchEvent(new CustomEvent('new-alert', { detail: options }));
  }
}

export const alertBus = new AlertBus();

const generateId = () => Math.random().toString(36).substr(2, 9);

export const showAlert = (title: string, text: string, icon: SweetAlertIcon = 'info') => {
  return new Promise<void>((resolve) => {
    alertBus.emit({
      id: generateId(),
      type: 'alert',
      title,
      text,
      icon,
      onConfirm: () => resolve(),
    });
  });
};

export const showToast = (title: string, icon: SweetAlertIcon = 'success') => {
  alertBus.emit({
    id: generateId(),
    type: 'toast',
    title,
    icon,
    timer: 3000
  });
};

export const showConfirm = (
  title: string, 
  text: string, 
  confirmText: string = 'Yes',
  cancelText: string = 'Cancel',
  icon: SweetAlertIcon = 'warning'
): Promise<boolean> => {
  return new Promise((resolve) => {
    alertBus.emit({
      id: generateId(),
      type: 'confirm',
      title,
      text,
      confirmText,
      cancelText,
      icon,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
};

export const showPrompt = (title: string, placeholder: string): Promise<string | null> => {
  return new Promise((resolve) => {
    alertBus.emit({
      id: generateId(),
      type: 'prompt',
      title,
      placeholder,
      onConfirm: (val) => resolve(val || null),
      onCancel: () => resolve(null),
    });
  });
};
