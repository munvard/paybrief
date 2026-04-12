import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ulid } from "ulid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return ulid();
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ORDER_STATUSES = [
  "CREATED",
  "PAYING",
  "PAID",
  "RESEARCHING",
  "SYNTHESIZING",
  "COMPLETED",
  "FAILED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED: "Order created",
  PAYING: "Awaiting payment",
  PAID: "Payment confirmed",
  RESEARCHING: "Researching competitors",
  SYNTHESIZING: "Writing your brief",
  COMPLETED: "Brief ready",
  FAILED: "Generation failed",
};
