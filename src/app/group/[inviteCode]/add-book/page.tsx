"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GroupAccountActions } from "@/components/GroupAccountActions";
import { StatusMessage } from "@/components/StatusMessage";
import { rememberRecentGroup } from "@/lib/group";
import { clearMemberSession, readMemberSession } from "@/lib/member";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Book, BookSearchResult, Group, Member } from "@/lib/types";

export default function AddBookPage() {
  const params = useParams<{ inviteCode: string }>();
  const router = useRouter();
  const inviteCode = useMemo(() => decodeURIComponent(params.inviteCode), [params.inviteCode]);
  const [group, setGroup] = useState<Group | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadContext() {
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

        const storedSession = readMemberSession(inviteCode);

        if (!storedSession) {
          router.replace(`/group/${encodeURIComponent(inviteCode)}`);
          return;
        }

        const { data: memberData } = await supabase.rpc("get_member_for_group", {
          p_invite_code: inviteCode,
          p_member_id: storedSession.member_id,
          p_access_token: storedSession.access_token
        });

        const currentMember = memberData?.[0] as Member | undefined;
        if (!currentMember) {
          clearMemberSession(inviteCode);
          router.replace(`/group/${encodeURIComponent(inviteCode)}`);
          return;
        }

        if (isMounted) {
          rememberRecentGroup(currentGroup);
          setGroup(currentGroup);
          setMember({ ...currentMember, access_token: storedSession.access_token });
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

    loadContext();

    return () => {
      isMounted = false;
    };
  }, [inviteCode, router]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuery = query.trim();

    if (cleanQuery.length < 2) {
      setError("Cerca con almeno 2 caratteri.");
      return;
    }

    setIsSearching(true);
    setError("");
    setSuccess("");
    setResults([]);

    try {
      const response = await fetch(`/api/books/search?q=${encodeURIComponent(cleanQuery)}`);
      const payload = (await response.json()) as { results?: BookSearchResult[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Ricerca non riuscita.");
      }

      setResults(payload.results || []);
      if (!payload.results?.length) {
        setSuccess("Nessun risultato trovato. Prova con titolo o autore diversi.");
      }
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Ricerca non riuscita.");
    } finally {
      setIsSearching(false);
    }
  }

  async function saveBook(result: BookSearchResult) {
    if (!group || !member) {
      return;
    }

    setSavingId(result.googleBooksId);
    setError("");
    setSuccess("");

    try {
      if (!result.googleBooksId || result.title.trim().length === 0) {
        throw new Error("Risultato libro non valido.");
      }

      const supabase = getSupabaseBrowserClient();
      const { data: createdBook, error: insertError } = await supabase.rpc("add_group_book", {
        p_invite_code: inviteCode,
        p_member_id: member.id,
        p_access_token: member.access_token || "",
        p_google_books_id: result.googleBooksId,
        p_title: result.title,
        p_author: result.author,
        p_description: result.description,
        p_cover_url: result.coverUrl
      });

      if (insertError) {
        throw insertError;
      }

      const book = createdBook?.[0] as Book | undefined;
      if (!book) {
        throw new Error("Sessione non valida o gruppo non disponibile.");
      }

      router.push(`/group/${encodeURIComponent(inviteCode)}/books/${book.id}`);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Non sono riuscito a salvare il libro.");
    } finally {
      setSavingId("");
    }
  }

  if (isLoading) {
    return <main className="page-shell text-ink">Caricamento...</main>;
  }

  return (
    <main className="page-shell">
      <header className="flex flex-col gap-4 border-b border-rose/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`/group/${encodeURIComponent(inviteCode)}`} className="btn-ghost -ml-3">
            Torna alla dashboard
          </Link>
          <p className="eyebrow mt-4">{group?.name}</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-ink sm:text-4xl">Aggiungi libro</h1>
        </div>
        <GroupAccountActions inviteCode={inviteCode} />
      </header>

      <form onSubmit={handleSearch} className="panel mt-6 p-5 sm:p-6">
        <label htmlFor="bookSearch" className="text-sm font-bold text-ink">
          Cerca per titolo o autore
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="bookSearch"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="field mt-0 min-w-0 flex-1"
            placeholder="Es. Elena Ferrante"
          />
          <button type="submit" disabled={isSearching} className="btn-primary px-6">
            {isSearching ? "Cerco..." : "Cerca"}
          </button>
        </div>
      </form>

      <section className="mt-6 space-y-4">
        {error ? <StatusMessage type="error">{error}</StatusMessage> : null}
        {success ? <StatusMessage type="info">{success}</StatusMessage> : null}

        {results.map((result) => (
          <article
            key={result.googleBooksId}
            className="panel grid grid-cols-[92px_1fr] gap-4 p-3 transition hover:-translate-y-0.5 hover:shadow-soft sm:grid-cols-[112px_1fr] sm:p-4"
          >
            <div className="relative h-36 w-[92px] overflow-hidden rounded-md bg-rose sm:h-40 sm:w-28">
              {result.coverUrl ? (
                <Image
                  src={result.coverUrl}
                  alt={`Copertina di ${result.title}`}
                  fill
                  sizes="88px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-2 text-center text-xs font-semibold text-clay">
                  Nessuna copertina
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-base font-bold text-ink">{result.title}</h2>
              <p className="mt-1 text-sm text-moss">{result.author}</p>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink/70">
                {result.description || "Descrizione non disponibile."}
              </p>
              <button
                type="button"
                onClick={() => saveBook(result)}
                disabled={savingId === result.googleBooksId}
                className="btn-secondary mt-4 px-4 py-2"
              >
                {savingId === result.googleBooksId ? "Salvo..." : "Scegli"}
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
