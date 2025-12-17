import Swal, { SweetAlertIcon, SweetAlertPosition } from 'sweetalert2';

// Base configuration for all alerts to ensure consistent Glassmorphism UI
const glassConfig = {
  background: 'transparent', // CSS handles the background
  color: 'inherit', // CSS handles text color
  buttonsStyling: false, // Disable default SweetAlert2 buttons to use Tailwind
  customClass: {
    popup: 'glass-swal-popup',
    title: 'glass-swal-title',
    htmlContainer: 'glass-swal-content',
    confirmButton: 'glass-swal-btn-confirm',
    cancelButton: 'glass-swal-btn-cancel',
    denyButton: 'glass-swal-btn-deny',
    icon: 'glass-swal-icon'
  },
  backdrop: `
    rgba(0,0,0,0.4)
    backdrop-filter: blur(8px)
    -webkit-backdrop-filter: blur(8px)
  `
};

export const showAlert = (title: string, text: string, icon: SweetAlertIcon = 'info') => {
  return Swal.fire({
    ...glassConfig,
    title,
    text,
    icon,
  });
};

export const showToast = (title: string, icon: SweetAlertIcon = 'success', position: SweetAlertPosition = 'top') => {
  return Swal.fire({
    ...glassConfig,
    title,
    icon,
    position,
    toast: true,
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    customClass: {
      popup: 'glass-swal-toast',
      title: 'glass-swal-toast-title',
      timerProgressBar: 'glass-swal-timer'
    },
    backdrop: false // No backdrop for toasts
  });
};

export const showConfirm = async (
  title: string, 
  text: string, 
  confirmText: string = 'Yes, proceed',
  cancelText: string = 'Cancel',
  icon: SweetAlertIcon = 'warning'
): Promise<boolean> => {
  const result = await Swal.fire({
    ...glassConfig,
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true, // Cancel on left, Confirm on right usually feels better on mobile
  });
  return result.isConfirmed;
};

// Prompt for text input
export const showPrompt = async (title: string, placeholder: string): Promise<string | null> => {
  const result = await Swal.fire({
    ...glassConfig,
    title,
    input: 'text',
    inputPlaceholder: placeholder,
    showCancelButton: true,
    customClass: {
        ...glassConfig.customClass,
        input: 'glass-swal-input'
    }
  });
  
  if (result.isConfirmed && result.value) {
      return result.value;
  }
  return null;
};
