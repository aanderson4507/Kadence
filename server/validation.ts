export class NotFoundError extends Error {
  readonly status = 404;
}

export class ValidationError extends Error {
  readonly status = 400;
}

export class ConflictError extends Error {
  readonly status = 409;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function requireUuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new ValidationError(`${name} must be a UUID.`);
  }
  return value;
}

export function optionalUuid(value: unknown, name: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requireUuid(value, name);
}

export function requireText(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${name} is required.`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new ValidationError(`${name} must be ${maxLength} characters or fewer.`);
  }
  return text;
}

export function optionalText(value: unknown, name: string, maxLength?: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new ValidationError(`${name} must be text.`);
  const text = value.trim();
  if (maxLength !== undefined && text.length > maxLength) {
    throw new ValidationError(`${name} must be ${maxLength} characters or fewer.`);
  }
  return text === "" ? null : text;
}

export function parseEnum<Values extends string>(
  allowed: Record<string, Values>,
  value: unknown,
  name: string,
): Values {
  const options = Object.values(allowed);
  if (typeof value !== "string" || !options.includes(value as Values)) {
    throw new ValidationError(`${name} must be one of: ${options.join(", ")}.`);
  }
  return value as Values;
}

/** Parses "YYYY-MM-DD" into a UTC midnight Date for a date-only column. */
export function optionalDateOnly(value: unknown, name: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new ValidationError(`${name} must be a date in YYYY-MM-DD format.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ValidationError(`${name} is not a valid date.`);
  }
  return date;
}

/** Formats a date-only column back to "YYYY-MM-DD". */
export function toDateOnly(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/** Today's local calendar date as a UTC midnight Date (the value stored in date-only columns). */
export function todayDateOnly(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}
