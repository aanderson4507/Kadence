import bcrypt from "bcryptjs";
import type { Db } from "../db.ts";
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
  optionalText,
  requireText,
} from "../validation.ts";
import { DEFAULT_REMINDERS_PER_DAY } from "./notificationService.ts";

// Sign in and account creation against the users table (passwords stored as bcrypt hashes).
// NOTE: this verifies credentials but does not issue a session token yet; API routes are still
// scoped by :userId. See "Known limitations" in the Sprint 2 release notes.

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,50}$/;
const MIN_PASSWORD_LENGTH = 8;

const publicUser = { id: true, username: true, firstName: true, lastName: true, email: true } as const;

export async function login(db: Db, body: Record<string, unknown>) {
  const identifier = requireText(body.username, "username", 255);
  if (typeof body.password !== "string" || body.password === "") {
    throw new ValidationError("password is required.");
  }
  const user = await db.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier.toLowerCase() }] },
    select: { ...publicUser, passwordHash: true },
  });
  // Same message whether the account or the password is wrong, so usernames can't be probed.
  const valid = user ? await bcrypt.compare(body.password, user.passwordHash) : false;
  if (!user || !valid) throw new UnauthorizedError("That username or password is incorrect.");
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export async function register(db: Db, body: Record<string, unknown>) {
  const username = requireText(body.username, "username", 50);
  if (!USERNAME_PATTERN.test(username)) {
    throw new ValidationError("username must be 3-50 letters, numbers, dots, dashes or underscores.");
  }
  const email = requireText(body.email, "email", 255).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new ValidationError("email must be a valid email address.");
  if (typeof body.password !== "string" || body.password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (body.password.length > 72) {
    // bcrypt only uses the first 72 bytes.
    throw new ValidationError("password must be 72 characters or fewer.");
  }

  const taken = await db.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { username: true },
  });
  if (taken) {
    throw new ConflictError(
      taken.username === username ? "That username is taken." : "An account already uses that email address.",
    );
  }

  return db.user.create({
    data: {
      username,
      email,
      passwordHash: await bcrypt.hash(body.password, 10),
      firstName: optionalText(body.firstName, "firstName", 100),
      lastName: optionalText(body.lastName, "lastName", 100),
      settings: { create: {} },
      priorityRules: {
        create: Object.entries(DEFAULT_REMINDERS_PER_DAY).map(([priority, remindersPerDay]) => ({
          priority: priority as keyof typeof DEFAULT_REMINDERS_PER_DAY,
          remindersPerDay,
        })),
      },
    },
    select: publicUser,
  });
}
