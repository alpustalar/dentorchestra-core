import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Koşullu sınıfları birleştirir ve çakışan Tailwind yardımcılarını sadeleştirir
 * (`px-2 px-4` → `px-4`). shadcn bileşenlerinin tamamı bunu bekler.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
