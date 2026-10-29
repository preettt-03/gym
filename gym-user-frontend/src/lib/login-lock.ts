// Browser-side login lock: three failed attempts (any email) lock the form for 30s.
// The backend locks per email too; this one also covers someone cycling through
// emails, and lives in localStorage so a page refresh doesn't reset it.

const KEY = "kf-login-lock";
export const LOGIN_MAX_FAILS = 3;
export const LOGIN_LOCK_MS = 30_000;

interface LockState {
  fails: number;
  until: number;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(state: LockState | null) {
  try {
    if (state) window.localStorage.setItem(KEY, JSON.stringify(state));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked (private mode etc.) — the backend lock still applies.
  }
  notify();
}

export function parseLoginLock(raw: string | null): LockState {
  try {
    const value = raw ? JSON.parse(raw) : null;
    return { fails: Number(value?.fails) || 0, until: Number(value?.until) || 0 };
  } catch {
    return { fails: 0, until: 0 };
  }
}

// For useSyncExternalStore; also follows other tabs via the storage event.
export function subscribeLoginLock(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export const getLoginLockSnapshot = read;

/** Records a failed attempt; returns true when this one triggered the lock. */
export function recordLoginFailure(): boolean {
  const fails = parseLoginLock(read()).fails + 1;
  if (fails >= LOGIN_MAX_FAILS) {
    write({ fails: 0, until: Date.now() + LOGIN_LOCK_MS });
    return true;
  }
  write({ fails, until: 0 });
  return false;
}

export function lockLogin(seconds: number) {
  write({ fails: 0, until: Date.now() + seconds * 1000 });
}

export function clearLoginLock() {
  write(null);
}
