const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RECENT_GROUPS_STORAGE_KEY = "clublettura:recent_groups";

export type RecentGroup = {
  invite_code: string;
  name: string;
  last_used_at: string;
};

export function generateInviteCode() {
  const suffix = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
  return `CLUB-${suffix}`;
}

export function isValidGroupName(name: string) {
  const cleanName = name.trim();
  return cleanName.length >= 2 && cleanName.length <= 80;
}

export function readRecentGroups(): RecentGroup[] {
  const rawValue = localStorage.getItem(RECENT_GROUPS_STORAGE_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as RecentGroup[];
    if (Array.isArray(parsed)) {
      return parsed
        .filter((group) => group.invite_code && group.name && group.last_used_at)
        .sort((a, b) => new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime());
    }
  } catch {
    return [];
  }

  return [];
}

export function rememberRecentGroup(group: { invite_code: string; name: string }) {
  const cleanCode = group.invite_code.trim();
  const cleanName = group.name.trim();

  if (!cleanCode || !cleanName) {
    return;
  }

  const nextGroup: RecentGroup = {
    invite_code: cleanCode,
    name: cleanName,
    last_used_at: new Date().toISOString()
  };

  const nextGroups = [
    nextGroup,
    ...readRecentGroups().filter((recentGroup) => recentGroup.invite_code !== cleanCode)
  ].slice(0, 8);

  localStorage.setItem(RECENT_GROUPS_STORAGE_KEY, JSON.stringify(nextGroups));
}
