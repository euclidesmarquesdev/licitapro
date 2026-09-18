import { toast } from "sonner";

export const showToast = {
  success: (message: string, description?: string, options?: unknown) => {
    toast.success(message, {
      description,
      ...options
    });
  },
  
  error: (message: string, description?: string, options?: unknown) => {
    toast.error(message, {
      description,
      duration: 6000,
      ...options
    });
  },
  
  warning: (message: string, description?: string, options?: unknown) => {
    toast.warning(message, {
      description,
      ...options
    });
  },
  
  info: (message: string, description?: string, options?: unknown) => {
    toast.info(message, {
      description,
      ...options
    });
  },
  
  loading: (message: string, id?: string) => {
    return toast.loading(message, { id });
  },
  
  dismiss: (id?: string) => {
    toast.dismiss(id);
  },
  
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    },
    options?: unknown
  ) => {
    return toast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
      ...options
    });
  }
};