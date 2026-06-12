export function memberStorageKey(inviteCode: string) {
  return `clublettura:${inviteCode.toLowerCase()}:member_id`;
}

export function currentGroupStorageKey() {
  return "clublettura:current_group";
}

export type StoredMemberSession = {
  member_id: string;
  access_token: string;
};

export function normalizeInviteCode(inviteCode: string) {
  return inviteCode.trim();
}

export function isValidInviteCode(inviteCode: string) {
  const cleanCode = normalizeInviteCode(inviteCode);
  return cleanCode.length >= 3 && cleanCode.length <= 64;
}

export function isValidNickname(nickname: string) {
  const cleanNickname = nickname.trim();
  return cleanNickname.length >= 2 && cleanNickname.length <= 40;
}

export function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin);
}

export function isValidCommentBody(body: string) {
  const cleanBody = body.trim();
  return cleanBody.length >= 1 && cleanBody.length <= 4000;
}

export function readMemberSession(inviteCode: string): StoredMemberSession | null {
  const rawValue = localStorage.getItem(memberStorageKey(inviteCode));
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredMemberSession>;
    if (parsed.member_id && parsed.access_token) {
      return {
        member_id: parsed.member_id,
        access_token: parsed.access_token
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function writeMemberSession(inviteCode: string, session: StoredMemberSession) {
  localStorage.setItem(memberStorageKey(inviteCode), JSON.stringify(session));
}

export function clearMemberSession(inviteCode: string) {
  localStorage.removeItem(memberStorageKey(inviteCode));
}

export function writeCurrentGroup(inviteCode: string) {
  localStorage.setItem(currentGroupStorageKey(), normalizeInviteCode(inviteCode));
}

export function clearCurrentGroup(inviteCode?: string) {
  const currentGroup = localStorage.getItem(currentGroupStorageKey());
  if (!inviteCode || currentGroup === normalizeInviteCode(inviteCode)) {
    localStorage.removeItem(currentGroupStorageKey());
  }
}

export async function hashPin(pin: string) {
  const encoded = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
