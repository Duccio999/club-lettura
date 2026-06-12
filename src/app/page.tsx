"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusMessage } from "@/components/StatusMessage";
import { generateInviteCode, isValidGroupName, readRecentGroups, rememberRecentGroup, type RecentGroup } from "@/lib/group";
import { isValidInviteCode, normalizeInviteCode, writeCurrentGroup } from "@/lib/member";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Group } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [createdGroup, setCreatedGroup] = useState<Group | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [recentGroups, setRecentGroups] = useState<RecentGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    setRecentGroups(readRecentGroups());
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = normalizeInviteCode(inviteCode);

    if (!isValidInviteCode(code)) {
      setError("Inserisci un codice gruppo valido.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: queryError } = await supabase.rpc("get_group_by_invite_code", {
        p_invite_code: code
      });

      if (queryError) {
        throw queryError;
      }

      if (!data?.[0]) {
        setError("Non ho trovato nessun gruppo con questo codice.");
        return;
      }

      const group = data[0] as Group;
      rememberRecentGroup(group);
      writeCurrentGroup(group.invite_code);
      router.push(`/group/${encodeURIComponent(group.invite_code)}`);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Non riesco a verificare il codice gruppo.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = groupName.trim();

    if (!isValidGroupName(cleanName)) {
      setCreateError("Inserisci un nome gruppo tra 2 e 80 caratteri.");
      return;
    }

    setIsCreating(true);
    setCreateError("");
    setCreatedGroup(null);
    setCopyMessage("");

    try {
      const supabase = getSupabaseBrowserClient();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = generateInviteCode();
        const { data, error: createGroupError } = await supabase.rpc("create_group_from_ui", {
          p_name: cleanName,
          p_invite_code: code
        });

        if (createGroupError) {
          throw createGroupError;
        }

        const group = data?.[0] as Group | undefined;
        if (group) {
          setCreatedGroup(group);
          setInviteCode(group.invite_code);
          rememberRecentGroup(group);
          setRecentGroups(readRecentGroups());
          writeCurrentGroup(group.invite_code);
          return;
        }
      }

      setCreateError("Il codice generato esiste già. Riprova: ne creerò uno nuovo.");
    } catch (currentError) {
      setCreateError(currentError instanceof Error ? currentError.message : "Non sono riuscito a creare il gruppo.");
    } finally {
      setIsCreating(false);
    }
  }

  async function copyInviteCode() {
    if (!createdGroup) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdGroup.invite_code);
      setCopyMessage("Codice copiato.");
    } catch {
      setCopyMessage("Seleziona e copia il codice manualmente.");
    }
  }

  function enterCreatedGroup() {
    if (!createdGroup) {
      return;
    }

    writeCurrentGroup(createdGroup.invite_code);
    router.push(`/group/${encodeURIComponent(createdGroup.invite_code)}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-6 sm:px-6">
      <section className="w-full">
        <div className="mx-auto mb-5 max-w-2xl text-center">
          <div className="mx-auto mb-4 flex w-fit items-center gap-2">
            <span className="h-1.5 w-14 rounded-full bg-bordeaux" />
            <span className="h-1.5 w-5 rounded-full bg-clay/50" />
          </div>
          <p className="eyebrow">Club Lettura</p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-ink sm:text-4xl">Il tuo club di lettura privato</h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-ink/68">
            Un posto semplice e riservato per scegliere libri, commentare insieme e nascondere gli spoiler.
          </p>
        </div>

        <div className="panel mx-auto max-w-2xl p-5 sm:p-7">
          <div className="space-y-5">
            <form onSubmit={handleSubmit}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Accesso</p>
                  <h2 className="mt-2 text-2xl font-black text-ink">Entra nel gruppo</h2>
                  <p className="mt-2 text-sm leading-6 text-ink/65">Inserisci il codice invito ricevuto.</p>
                </div>
                <div className="flex h-12 w-10 items-end justify-center rounded-md border border-bordeaux/15 bg-gradient-to-r from-blush via-white to-paper shadow-sm">
                  <div className="mb-2 h-7 w-1.5 rounded-full bg-bordeaux/80" />
                </div>
              </div>
            <label htmlFor="inviteCode" className="mt-5 block text-sm font-bold text-ink">
              Codice invito
            </label>
            <input
              id="inviteCode"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              autoComplete="off"
              className="field uppercase"
              placeholder="ES. AMICHE2026"
            />
            <button type="submit" disabled={isLoading} className="btn-primary mt-4 w-full">
              {isLoading ? "Controllo..." : "Entra nel gruppo"}
            </button>
            {error ? (
              <div className="mt-4">
                <StatusMessage type="error">{error}</StatusMessage>
              </div>
            ) : null}
            </form>

          {recentGroups.length > 0 ? (
            <section className="rounded-lg border border-rose bg-paper/70 p-4">
              <p className="text-sm font-bold text-ink">Gruppi recenti</p>
              <div className="mt-3 grid gap-2">
                {recentGroups.slice(0, 3).map((group) => (
                  <button
                    key={group.invite_code}
                    type="button"
                    onClick={() => {
                      writeCurrentGroup(group.invite_code);
                      router.push(`/group/${encodeURIComponent(group.invite_code)}`);
                    }}
                    className="focus-ring flex items-center justify-between rounded-md border border-rose bg-paper px-3 py-3 text-left transition hover:border-clay hover:bg-blush/60"
                  >
                    <span>
                      <span className="block text-sm font-bold text-ink">{group.name}</span>
                      <span className="block text-xs font-bold uppercase tracking-[0.14em] text-bordeaux">{group.invite_code}</span>
                    </span>
                    <span className="text-sm font-bold text-moss">Apri</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="border-t border-rose pt-5">
            <button
              type="button"
              onClick={() => setIsCreateOpen((current) => !current)}
              className="btn-secondary w-full justify-center"
            >
              <span>Crea nuovo gruppo</span>
              <span className="ml-4 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blush text-lg leading-none text-bordeaux" aria-hidden="true">
                {isCreateOpen ? "−" : "+"}
              </span>
            </button>

            {isCreateOpen ? (
              <form onSubmit={handleCreateGroup} className="mt-5 space-y-4">
                <p className="text-sm leading-6 text-ink/65">
                  Ti preparo un codice invito leggibile da condividere con le altre.
                </p>
                <div>
                  <label htmlFor="groupName" className="text-sm font-bold text-ink">
                    Nome gruppo
                  </label>
                  <input
                    id="groupName"
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                    className="field"
                    placeholder="Club delle amiche"
                  />
                </div>
                <button type="submit" disabled={isCreating} className="btn-primary w-full">
                  {isCreating ? "Creo il gruppo..." : "Crea gruppo"}
                </button>
                {createError ? <StatusMessage type="error">{createError}</StatusMessage> : null}
              </form>
            ) : null}

            {createdGroup ? (
              <div className="mt-5 rounded-lg border border-bordeaux/15 bg-blush/60 p-4">
                <p className="text-sm font-bold text-ink">Gruppo creato. Condividi questo codice:</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <code className="rounded-md border border-rose bg-white px-3 py-2 text-center text-lg font-black tracking-[0.16em] text-bordeaux">
                    {createdGroup.invite_code}
                  </code>
                  <button type="button" onClick={copyInviteCode} className="btn-secondary py-2">
                    Copia
                  </button>
                </div>
                {copyMessage ? <p className="mt-3 text-sm font-medium text-moss">{copyMessage}</p> : null}
                <button type="button" onClick={enterCreatedGroup} className="btn-primary mt-4 w-full">
                  Entra nel gruppo
                </button>
              </div>
            ) : null}
          </section>
          </div>
        </div>
      </section>
    </main>
  );
}
