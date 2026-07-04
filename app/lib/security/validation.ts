export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function required(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function positiveAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

export function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

export function validateEmailOrMessage(email: string) {
  if (!required(email)) return "Email is required.";
  if (!isEmail(email)) return "Enter a valid email address.";
  return "";
}

export function validateAmountOrMessage(amount: unknown) {
  if (!positiveAmount(amount)) return "Enter a valid amount.";
  return "";
}
