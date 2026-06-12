import type { ReactNode } from "react";

type StatusMessageProps = {
  type: "error" | "success" | "info";
  children: ReactNode;
};

export function StatusMessage({ type, children }: StatusMessageProps) {
  const classes = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-moss/25 bg-moss/10 text-moss",
    info: "border-bordeaux/15 bg-blush text-bordeaux"
  };

  return <p className={`rounded-md border px-3 py-2 text-sm font-medium ${classes[type]}`}>{children}</p>;
}
