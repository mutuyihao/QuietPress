"use client";

type SonnerModule = typeof import("sonner");
type SonnerToast = SonnerModule["toast"];

type LazyToast = {
  error: (...args: Parameters<SonnerToast["error"]>) => void;
  success: (...args: Parameters<SonnerToast["success"]>) => void;
  info: (...args: Parameters<SonnerToast["info"]>) => void;
  warning: (...args: Parameters<SonnerToast["warning"]>) => void;
};

let sonnerModulePromise: Promise<SonnerModule> | undefined;

function loadSonner() {
  sonnerModulePromise ??= import("sonner");
  return sonnerModulePromise;
}

export const toast: LazyToast = {
  error: (...args) => {
    void loadSonner().then(({ toast }) => {
      toast.error(...args);
    });
  },
  success: (...args) => {
    void loadSonner().then(({ toast }) => {
      toast.success(...args);
    });
  },
  info: (...args) => {
    void loadSonner().then(({ toast }) => {
      toast.info(...args);
    });
  },
  warning: (...args) => {
    void loadSonner().then(({ toast }) => {
      toast.warning(...args);
    });
  },
};
