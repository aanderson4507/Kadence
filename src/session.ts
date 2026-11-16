import { request } from "./http";

// The signed-in account. Login stores it after the server verifies the password. Sessions are not
// implemented on the server yet (see the release notes), so this only remembers who signed in.
// In development, opening /dashboard without signing in uses the seeded demo account.

export type SessionUser = {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  email?: string;
};

const STORAGE_KEY = "kadence-user";

type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** Browser localStorage, or null in tests (Node) and when storage is blocked. */
function storage(): KeyValueStore | null {
  try {
    return (globalThis as { localStorage?: KeyValueStore }).localStorage ?? null;
  } catch {
    return null;
  }
}

export function storedUser(): SessionUser | null {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as SessionUser;
    return typeof user?.id === "string" ? user : null;
  } catch {
    return null;
  }
}

export function saveUser(user: SessionUser) {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Private mode or blocked storage: the user just signs in again next time.
  }
}

export function signOut() {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
}

/** The signed-in user, or the development demo account when nobody has signed in. */
export async function currentUser(failureMessage = "Couldn't load your account."): Promise<SessionUser> {
  return storedUser() ?? request<SessionUser>("/api/dev/user", failureMessage);
}

export function initials(user: Pick<SessionUser, "firstName" | "lastName" | "username"> | null) {
  if (!user) return "";
  const letters = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`;
  return (letters || user.username.slice(0, 2)).toUpperCase();
}

export async function login(username: string, password: string) {
  const user = await request<SessionUser>("/api/auth/login", "Couldn't sign in.", {
    method: "POST",
    json: { username, password },
  });
  saveUser(user);
  return user;
}

export async function register(details: {
  username: string;
  email: string;
  password: string;
  firstName?: string;
}) {
  const user = await request<SessionUser>("/api/auth/register", "Couldn't create your account.", {
    method: "POST",
    json: details,
  });
  saveUser(user);
  return user;
}
