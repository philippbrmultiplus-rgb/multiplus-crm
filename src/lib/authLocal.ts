/** Autenticação local do coordenador (senha definida pelo usuário, sem backend). */
const PW_KEY = "rs-app-pw";
const SESSION_KEY = "rs-app-coord-session";

export async function hashPassword(pw: string): Promise<string> {
  const data = new TextEncoder().encode(`rotasul::${pw}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isPasswordSet(): boolean {
  try {
    return !!localStorage.getItem(PW_KEY);
  } catch {
    return false;
  }
}

export async function setPassword(pw: string): Promise<void> {
  localStorage.setItem(PW_KEY, await hashPassword(pw));
}

export async function verifyPassword(pw: string): Promise<boolean> {
  try {
    const stored = localStorage.getItem(PW_KEY);
    if (!stored) return false;
    return (await hashPassword(pw)) === stored;
  } catch {
    return false;
  }
}

export function isCoordAuthed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function setCoordAuthed(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(SESSION_KEY, "1");
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignora falhas de armazenamento de sessão
  }
}
