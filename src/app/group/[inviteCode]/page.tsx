"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BookCard } from "@/components/BookCard";
import { EmptyState } from "@/components/EmptyState";
import { GroupAccountActions } from "@/components/GroupAccountActions";
import { StatusMessage } from "@/components/StatusMessage";
import { rememberRecentGroup } from "@/lib/group";
import {
  clearMemberSession,
  clearCurrentGroup,
  hashPin,
  isValidNickname,
  isValidPin,
  readMemberSession,
  writeCurrentGroup,
  writeMemberSession
} from "@/lib/member";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { BookWithCommentCount, Group, Member } from "@/lib/types";

export default function GroupDashboardPage() {
  const params = useParams<{ inviteCode: string }>();
  const router = useRouter();
  const inviteCode = useMemo(() => decodeURIComponent(params.inviteCode), [params.inviteCode]);
  const [group, setGroup] = useState<Group | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [books, setBooks] = useState<BookWithCommentCount[]>([]);
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMemberLoading, setIsMemberLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadBooks = useCallback(async (currentInviteCode: string, currentMember: Member) => {
    const supabase = getSupabaseBrowserClient();
    const { data: booksData, error: booksError } = await supabase.rpc("list_group_books", {
      p_invite_code: currentInviteCode,
      p_member_id: currentMember.id,
      p_access_token: currentMember.access_token || ""
    });

    if (booksError) {
      throw booksError;
    }

    setBooks((booksData || []) as BookWithCommentCount[]);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadGroup() {
      setIsLoading(true);
      setError("");

      try {
        const supabase = getSupabaseBrowserClient();
        const { data: groupData, error: groupError } = await supabase.rpc("get_group_by_invite_code", {
          p_invite_code: inviteCode
        });

        if (groupError) {
          throw groupError;
        }

        const currentGroup = groupData?.[0] as Group | undefined;
        if (!currentGroup) {
          router.replace("/");
          return;
        }

        if (!isMounted) {
          return;
        }

        setGroup(currentGroup);
        rememberRecentGroup(currentGroup);
        writeCurrentGroup(inviteCode);

        const storedSession = readMemberSession(inviteCode);
        if (storedSession) {
          const { data: memberData } = await supabase.rpc("get_member_for_group", {
            p_invite_code: inviteCode,
            p_member_id: storedSession.member_id,
            p_access_token: storedSession.access_token
          });

          const currentMember = memberData?.[0] as Member | undefined;
          if (currentMember && isMounted) {
            const memberWithToken = { ...currentMember, access_token: storedSession.access_token };
            setMember(memberWithToken);
            await loadBooks(inviteCode, memberWithToken);
          } else {
            clearMemberSession(inviteCode);
          }
        }
      } catch (currentError) {
        if (isMounted) {
          setError(currentError instanceof Error ? currentError.message : "Impossibile caricare il gruppo.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadGroup();

    return () => {
      isMounted = false;
    };
  }, [inviteCode, loadBooks, router]);

  async function handleMemberSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!group) {
      return;
    }

    const cleanNickname = nickname.trim();
    if (!isValidNickname(cleanNickname)) {
      setError("Scegli un nickname tra 2 e 40 caratteri.");
      return;
    }

    if (!isValidPin(pin)) {
      setError("Il PIN deve avere esattamente 4 cifre.");
      return;
    }

    setIsMemberLoading(true);
    setError("");
    setSuccess("");

    try {
      const supabase = getSupabaseBrowserClient();
      const pinHash = await hashPin(pin);
      const { data: memberData, error: memberError } = await supabase.rpc("get_or_create_member", {
        p_invite_code: inviteCode,
        p_nickname: cleanNickname,
        p_pin_hash: pinHash
      });

      if (memberError) {
        throw memberError;
      }

      const currentMember = memberData?.[0] as Member | undefined;

      if (!currentMember?.access_token) {
        throw new Error("Profilo non trovato per questo gruppo.");
      }

      writeMemberSession(inviteCode, {
        member_id: currentMember.id,
        access_token: currentMember.access_token
      });
      setMember(currentMember);
      setPin("");
      setSuccess("Profilo pronto. Buona lettura.");
      await loadBooks(inviteCode, currentMember);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Non sono riuscito a salvare il profilo.");
    } finally {
      setIsMemberLoading(false);
    }
  }

  if (isLoading) {
    return <main className="page-shell text-ink">Caricamento gruppo...</main>;
  }

  if (!group) {
    return <main className="page-shell text-ink">Gruppo non trovato.</main>;
  }

  if (!member) {
    return (
      <main className="page-shell flex max-w-xl items-center">
        <section className="w-full space-y-6">
          <div>
            <button
              type="button"
              onClick={() => {
                clearCurrentGroup(inviteCode);
                setMember(null);
                setBooks([]);
                router.push("/");
              }}
              className="btn-ghost -ml-3 mb-4"
            >
              Torna alla home
            </button>
            <p className="eyebrow">{group.name}</p>
            <h1 className="mt-3 text-3xl font-black leading-tight text-ink">Prima di entrare</h1>
            <p className="mt-3 text-base leading-7 text-ink/70">
              Inserisci nickname e PIN. Se li hai già usati, ritrovi lo stesso profilo.
            </p>
          </div>

          <form onSubmit={handleMemberSubmit} className="panel space-y-4 p-5 sm:p-6">
            <div>
              <label htmlFor="nickname" className="text-sm font-bold text-ink">
                Nickname
              </label>
              <input
                id="nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="field"
                placeholder="Es. Giulia"
              />
            </div>

            <div>
              <label htmlFor="pin" className="text-sm font-bold text-ink">
                PIN di 4 cifre
              </label>
              <input
                id="pin"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                autoComplete="off"
                className="field"
                placeholder="1234"
              />
            </div>

            <button type="submit" disabled={isMemberLoading} className="btn-primary w-full">
              {isMemberLoading ? "Salvo..." : "Entra nel gruppo"}
            </button>

            {error ? <StatusMessage type="error">{error}</StatusMessage> : null}
            {success ? <StatusMessage type="success">{success}</StatusMessage> : null}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">Ciao, {member.nickname}</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <h1 className="text-3xl font-black leading-tight text-ink sm:text-4xl">{group.name}</h1>
              <span className="inline-flex w-fit rounded-full border border-rose bg-blush px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-bordeaux">
                {group.invite_code}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-ink/65">
              <span className="rounded-full bg-paper px-3 py-1 font-bold">{books.length} libri</span>
              <span className="rounded-full bg-paper px-3 py-1 font-bold">
                {books.reduce((total, book) => total + book.comments_count, 0)} commenti
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:items-center">
            <Link href={`/group/${encodeURIComponent(inviteCode)}/add-book`} className="btn-primary">
              Aggiungi libro
            </Link>
            <GroupAccountActions
              inviteCode={inviteCode}
              onSignOut={() => {
                setMember(null);
                setBooks([]);
                setSuccess("");
                setError("");
              }}
            />
          </div>
        </div>
      </header>

      <section className="mt-6 space-y-4">
        {error ? <StatusMessage type="error">{error}</StatusMessage> : null}
        {books.length === 0 ? (
          <EmptyState
            title="Nessun libro ancora"
            body="Aggiungi il primo titolo del club: comparirà qui con copertina, autore e commenti."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                inviteCode={inviteCode}
                commentsCount={book.comments_count}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
