"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { readRecentGroups, rememberRecentGroup, type RecentGroup } from "@/lib/group";
import { clearMemberSession, isValidInviteCode, normalizeInviteCode, writeCurrentGroup } from "@/lib/member";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { StatusMessage } from "./StatusMessage";

type GroupAccountActionsProps = {
  inviteCode: string;
  onSignOut?: () => void;
};

export function GroupAccountActions({ inviteCode, onSignOut }: GroupAccountActionsProps) {
  const router = useRouter();
  const [isGroupsOpen, setIsGroupsOpen] = useState(false);
  const [recentGroups, setRecentGroups] = useState<RecentGroup[]>([]);
  const [switchCode, setSwitchCode] = useState("");
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isGroupsOpen) {
      setRecentGroups(readRecentGroups());
      setSwitchError("");
    }
  }, [isGroupsOpen]);

  useEffect(() => {
    if (!isGroupsOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsGroupsOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isGroupsOpen]);

  function signOutMember() {
    clearMemberSession(inviteCode);
    onSignOut?.();
    router.push(`/group/${encodeURIComponent(inviteCode)}`);
  }

  async function switchToGroup(code: string) {
    const cleanCode = normalizeInviteCode(code).toUpperCase();

    if (!isValidInviteCode(cleanCode)) {
      setSwitchError("Inserisci un codice invito valido.");
      return;
    }

    setIsSwitching(true);
    setSwitchError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("get_group_by_invite_code", {
        p_invite_code: cleanCode
      });

      if (error) {
        throw error;
      }

      const group = data?.[0];
      if (!group) {
        setSwitchError("Non ho trovato nessun gruppo con questo codice.");
        return;
      }

      rememberRecentGroup({
        invite_code: group.invite_code,
        name: group.name
      });
      writeCurrentGroup(group.invite_code);
      router.push(`/group/${encodeURIComponent(group.invite_code)}`);
    } catch (currentError) {
      setSwitchError(currentError instanceof Error ? currentError.message : "Non riesco a verificare questo gruppo.");
    } finally {
      setIsSwitching(false);
    }
  }

  function handleSwitchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    switchToGroup(switchCode);
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => setIsGroupsOpen(true)} className="btn-secondary px-3 py-2">
          I miei gruppi
        </button>
        <button type="button" onClick={signOutMember} className="btn-ghost px-3 py-2">
          Esci dall&apos;account
        </button>
      </div>

      {isMounted && isGroupsOpen
        ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="groupsDialogTitle">
          <button
            type="button"
            aria-label="Chiudi gestione gruppi"
            className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-sm"
            onClick={() => setIsGroupsOpen(false)}
          />
          <div className="relative flex max-h-[86vh] w-[92vw] max-w-[520px] flex-col overflow-hidden rounded-lg border border-rose bg-white shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="p-5 pb-0 sm:p-6 sm:pb-0">
                <p className="eyebrow">Cambia gruppo</p>
                <h2 id="groupsDialogTitle" className="mt-1 text-xl font-black text-ink">
                  I miei gruppi
                </h2>
              </div>
              <button type="button" onClick={() => setIsGroupsOpen(false)} className="btn-ghost mr-4 mt-4 px-3 py-2 text-xl" aria-label="Chiudi">
                ×
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto px-5 py-4 sm:px-6">
              {recentGroups.length > 0 ? (
                <div className="space-y-2">
                  {recentGroups.map((group) => (
                    <button
                      key={group.invite_code}
                      type="button"
                      onClick={() => switchToGroup(group.invite_code)}
                      className="focus-ring flex w-full items-center justify-between gap-3 rounded-md border border-rose/80 bg-paper px-3 py-3 text-left transition hover:border-clay hover:bg-blush/60"
                    >
                      <span>
                        <span className="block text-sm font-bold text-ink">{group.name}</span>
                        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-bordeaux">
                          {group.invite_code}
                        </span>
                      </span>
                      <span className="text-sm font-bold text-moss">Apri</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-rose bg-paper p-4 text-sm leading-6 text-ink/65">
                  I gruppi che apri da questo browser compariranno qui.
                </p>
              )}

              <div className="mt-5 border-t border-rose pt-5">
                <h3 className="text-base font-black text-ink">Entra in un altro gruppo</h3>
                <form onSubmit={handleSwitchSubmit} className="mt-3">
                  <label htmlFor="switchGroupCode" className="text-sm font-bold text-ink">
                    Codice invito
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="switchGroupCode"
                      value={switchCode}
                      onChange={(event) => setSwitchCode(event.target.value.toUpperCase())}
                      className="field mt-0 uppercase"
                      placeholder="AMICHE2026"
                    />
                    <button type="submit" disabled={isSwitching} className="btn-primary shrink-0 px-5 py-3">
                      {isSwitching ? "Verifico..." : "Vai"}
                    </button>
                  </div>
                </form>
              </div>

              {switchError ? (
                <div className="mt-3">
                  <StatusMessage type="error">{switchError}</StatusMessage>
                </div>
              ) : null}
              </div>
          </div>
        </div>,
        document.body
      )
        : null}
    </>
  );
}
