import { Toaster as Sonner } from "sonner";

export const Toaster = () => {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      duration={4000}
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-white group-[.toaster]:text-zinc-950 group-[.toaster]:border-zinc-200 group-[.toaster]:shadow-lg dark:group-[.toaster]:bg-zinc-950 dark:group-[.toaster]:text-zinc-50 dark:group-[.toaster]:border-zinc-800",
          title: "font-semibold",
          description: "text-zinc-500 dark:text-zinc-400",
          actionButton: "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900",
          cancelButton: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
        },
      }}
    />
  );
};