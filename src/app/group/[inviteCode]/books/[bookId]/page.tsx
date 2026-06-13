"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { GroupAccountActions } from "@/components/GroupAccountActions";
import { StatusMessage } from "@/components/StatusMessage";
import { formatDate } from "@/lib/dates";
import { rememberRecentGroup } from "@/lib/group";
import { clearMemberSession, isValidCommentBody, readMemberSession } from "@/lib/member";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Book, Comment, Group, Member } from "@/lib/types";

const COMMENTS_PAGE_SIZE = 10;
const DESCRIPTION_PREVIEW_MIN_LENGTH = 260;

export default function BookDetailPage() {
  const params = useParams<{ inviteCode: string; bookId: string }>();
  const router = useRouter();
  const inviteCode = useMemo(() => decodeURIComponent(params.inviteCode), [params.inviteCode]);
  const [group, setGroup] = useState<Group | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [visibleSpoilers, setVisibleSpoilers] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editIsSpoiler, setEditIsSpoiler] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [commentSearch, setCommentSearch] = useState("");
  const [visibleCommentCount, setVisibleCommentCount] = useState(COMMENTS_PAGE_SIZE);

  const loadComments = useCallback(async (bookId: string, currentMember: Member) => {
    const supabase = getSupabaseBrowserClient();
    const { data, error: commentsError } = await supabase.rpc("list_book_comments", {
      p_invite_code: inviteCode,
      p_member_id: currentMember.id,
      p_access_token: currentMember.access_token || "",
      p_book_id: bookId
    });

    if (commentsError) {
      throw commentsError;
    }

    setComments((data || []) as Comment[]);
  }, [inviteCode]);


  const descriptionText = book?.description?.trim() || "Descrizione non disponibile.";
  const canToggleDescription = Boolean(book?.description && book.description.trim().length > DESCRIPTION_PREVIEW_MIN_LENGTH);

  const sortedComments = useMemo(() => {
    return [...comments].sort((first, second) => {
      return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
    });
  }, [comments]);

  const cleanCommentSearch = commentSearch.trim().toLocaleLowerCase("it-IT");

  const filteredComments = useMemo(() => {
    if (!cleanCommentSearch) {
      return sortedComments;
    }

    return sortedComments.filter((comment) => {
      const haystack = `${comment.body} ${comment.member_nickname || ""}`.toLocaleLowerCase("it-IT");
      return haystack.includes(cleanCommentSearch);
    });
  }, [cleanCommentSearch, sortedComments]);

  const visibleComments = filteredComments.slice(0, visibleCommentCount);
  const hasMoreComments = visibleCommentCount < filteredComments.length;
  const isSearchingComments = cleanCommentSearch.length > 0;

  useEffect(() => {
    setVisibleCommentCount(COMMENTS_PAGE_SIZE);
  }, [cleanCommentSearch, comments.length]);

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

        const memberWithToken = { ...currentMember, access_token: storedSession.access_token };

        const { data: bookData, error: bookError } = await supabase.rpc("get_group_book", {
          p_invite_code: inviteCode,
          p_member_id: memberWithToken.id,
          p_access_token: memberWithToken.access_token || "",
          p_book_id: params.bookId
        });

        if (bookError) {
          throw bookError;
        }

        const currentBook = bookData?.[0] as Book | undefined;
        if (!currentBook) {
          router.replace(`/group/${encodeURIComponent(inviteCode)}`);
          return;
        }

        if (!isMounted) {
          return;
        }

        rememberRecentGroup(currentGroup);
        setGroup(currentGroup);
        setMember(memberWithToken);
        setBook(currentBook);
        await loadComments(params.bookId, memberWithToken);
      } catch (currentError) {
        if (isMounted) {
          setError(currentError instanceof Error ? currentError.message : "Impossibile caricare il libro.");
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
  }, [inviteCode, loadComments, params.bookId, router]);

  async function handleAddComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!member || !book) {
      return;
    }

    const cleanBody = body.trim();
    if (!isValidCommentBody(cleanBody)) {
      setError("Scrivi un commento tra 1 e 4000 caratteri.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: insertedComment, error: insertError } = await supabase.rpc("add_book_comment", {
        p_invite_code: inviteCode,
        p_member_id: member.id,
        p_access_token: member.access_token || "",
        p_book_id: book.id,
        p_body: cleanBody,
        p_is_spoiler: isSpoiler
      });

      if (insertError) {
        throw insertError;
      }

      if (!insertedComment?.[0]) {
        throw new Error("Sessione non valida o libro non disponibile.");
      }

      setBody("");
      setIsSpoiler(false);
      setCommentSearch("");
      setVisibleCommentCount(COMMENTS_PAGE_SIZE);
      setSuccess("Commento aggiunto.");
      await loadComments(book.id, member);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Non sono riuscito a salvare il commento.");
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(comment: Comment) {
    setEditingId(comment.id);
    setEditBody(comment.body);
    setEditIsSpoiler(comment.is_spoiler);
    setError("");
    setSuccess("");
  }

  async function saveEdit(comment: Comment) {
    if (!member || comment.member_id !== member.id) {
      setError("Puoi modificare solo i tuoi commenti.");
      return;
    }

    const cleanBody = editBody.trim();
    if (!isValidCommentBody(cleanBody)) {
      setError("Il commento deve essere tra 1 e 4000 caratteri.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: updatedComment, error: updateError } = await supabase.rpc("update_own_comment", {
        p_invite_code: inviteCode,
        p_member_id: member.id,
        p_access_token: member.access_token || "",
        p_comment_id: comment.id,
        p_body: cleanBody,
        p_is_spoiler: editIsSpoiler
      });

      if (updateError) {
        throw updateError;
      }

      if (!updatedComment?.[0]) {
        throw new Error("Puoi modificare solo i tuoi commenti.");
      }

      setEditingId("");
      setSuccess("Commento aggiornato.");
      await loadComments(comment.book_id, member);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Non sono riuscito ad aggiornare il commento.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteComment(comment: Comment) {
    if (!member || comment.member_id !== member.id) {
      setError("Puoi eliminare solo i tuoi commenti.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: deletedComment, error: deleteError } = await supabase.rpc("delete_own_comment", {
        p_invite_code: inviteCode,
        p_member_id: member.id,
        p_access_token: member.access_token || "",
        p_comment_id: comment.id
      });

      if (deleteError) {
        throw deleteError;
      }

      if (!deletedComment?.[0]) {
        throw new Error("Puoi eliminare solo i tuoi commenti.");
      }

      setSuccess("Commento eliminato.");
      await loadComments(comment.book_id, member);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Non sono riuscito a eliminare il commento.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <main className="page-shell text-ink">Caricamento libro...</main>;
  }

  if (!book || !group || !member) {
    return <main className="page-shell text-ink">Libro non trovato.</main>;
  }

  return (
    <main className="page-shell">
      <header className="flex flex-col gap-4 border-b border-rose/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/group/${encodeURIComponent(inviteCode)}`} className="btn-ghost -ml-3">
          Torna alla dashboard
        </Link>
        <GroupAccountActions inviteCode={inviteCode} />
      </header>

      <section className="panel mt-6 grid gap-6 p-5 sm:grid-cols-[190px_1fr] sm:p-6">
        <div className="relative h-72 w-48 max-w-full overflow-hidden rounded-lg bg-rose shadow-soft sm:h-72 sm:w-full">
          {book.cover_url ? (
            <Image src={book.cover_url} alt={`Copertina di ${book.title}`} fill sizes="(max-width: 640px) 192px, 180px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm font-semibold text-clay">
              Nessuna copertina
            </div>
          )}
        </div>
        <div>
          <p className="eyebrow">{group.name}</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-ink">{book.title}</h1>
          <p className="mt-2 text-base font-bold text-bordeaux">{book.author || "Autore non indicato"}</p>
          <div className="mt-4">
            <p
              className={`whitespace-pre-line text-sm leading-7 text-ink/70 ${
                canToggleDescription && !isDescriptionExpanded ? "line-clamp-3 sm:line-clamp-5" : ""
              }`}
            >
              {descriptionText}
            </p>
            {canToggleDescription ? (
              <button
                type="button"
                onClick={() => setIsDescriptionExpanded((current) => !current)}
                className="btn-ghost mt-2 px-0 py-1"
              >
                {isDescriptionExpanded ? "Mostra meno" : "Vedi tutta la trama"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <div>
          <h2 className="text-2xl font-black text-ink">Commenti ({comments.length})</h2>
          <p className="mt-1 text-sm text-ink/60">Stai commentando come {member.nickname}.</p>
        </div>

        {error ? <StatusMessage type="error">{error}</StatusMessage> : null}
        {success ? <StatusMessage type="success">{success}</StatusMessage> : null}

        <form onSubmit={handleAddComment} className="panel space-y-3 p-4 sm:p-5">
          <label htmlFor="comment" className="text-sm font-bold text-ink">
            Nuovo commento
          </label>
          <textarea
            id="comment"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            className="field mt-2 resize-y"
            placeholder="Cosa ne pensi?"
          />
          <label className="flex items-center gap-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={isSpoiler}
              onChange={(event) => setIsSpoiler(event.target.checked)}
              className="h-5 w-5 rounded border-rose text-clay focus:ring-clay"
            />
            Questo commento contiene spoiler
          </label>
          <button type="submit" disabled={isSaving} className="btn-primary">
            {isSaving ? "Salvo..." : "Aggiungi commento"}
          </button>
        </form>

        {comments.length === 0 ? (
          <EmptyState title="Ancora nessun commento" body="Apri tu la discussione con una nota, una domanda o una citazione." />
        ) : (
          <div className="space-y-3">
            <div className="panel space-y-3 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-ink">
                    {isSearchingComments
                      ? `${filteredComments.length} di ${comments.length} commenti`
                      : `${comments.length} ${comments.length === 1 ? "commento" : "commenti"}`}
                  </p>
                  <p className="text-xs text-ink/55">Dal piu recente al meno recente.</p>
                </div>
                {isSearchingComments ? (
                  <button type="button" onClick={() => setCommentSearch("")} className="btn-ghost px-0 py-1 text-xs">
                    Cancella ricerca
                  </button>
                ) : null}
              </div>
              <label htmlFor="commentSearch" className="text-sm font-bold text-ink">
                Cerca nei commenti
              </label>
              <input
                id="commentSearch"
                type="search"
                value={commentSearch}
                onChange={(event) => setCommentSearch(event.target.value)}
                className="field mt-2"
                placeholder="Cerca testo o lettrice..."
              />
            </div>

            {filteredComments.length === 0 ? (
              <EmptyState title="Nessun commento trovato" body="Prova con un'altra parola chiave o cancella la ricerca." />
            ) : null}

            {visibleComments.map((comment) => {
              const isOwn = comment.member_id === member.id;
              const spoilerVisible = visibleSpoilers[comment.id];
              const isEditing = editingId === comment.id;

              return (
                <article key={comment.id} className="panel p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-ink">{comment.member_nickname || "Lettrice"}</p>
                      <p className="text-xs text-ink/55">
                        {formatDate(comment.created_at)}
                        {comment.updated_at ? " · modificato" : ""}
                      </p>
                    </div>
                    {isOwn && !isEditing ? (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEditing(comment)} className="btn-ghost px-2 py-1 text-moss">
                          Modifica
                        </button>
                        <button type="button" onClick={() => deleteComment(comment)} className="btn-ghost px-2 py-1 text-bordeaux">
                          Elimina
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {isEditing ? (
                    <div className="mt-3 space-y-3">
                      <textarea
                        value={editBody}
                        onChange={(event) => setEditBody(event.target.value)}
                        rows={4}
                        className="field resize-y"
                      />
                      <label className="flex items-center gap-3 text-sm font-medium text-ink">
                        <input
                          type="checkbox"
                          checked={editIsSpoiler}
                          onChange={(event) => setEditIsSpoiler(event.target.checked)}
                          className="h-5 w-5 rounded border-rose text-clay focus:ring-clay"
                        />
                        Questo commento contiene spoiler
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(comment)}
                          disabled={isSaving}
                          className="btn-primary px-4 py-2"
                        >
                          Salva
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId("")}
                          className="btn-secondary px-4 py-2"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : comment.is_spoiler && !spoilerVisible ? (
                    <div className="mt-4 rounded-md border border-honey/40 bg-honey/15 p-4">
                      <p className="text-sm font-bold text-ink">Spoiler nascosto</p>
                      <button
                        type="button"
                        onClick={() => setVisibleSpoilers((current) => ({ ...current, [comment.id]: true }))}
                        className="btn-ghost mt-2 px-0 py-1"
                      >
                        Mostra spoiler
                      </button>
                    </div>
                  ) : (
                    <p className="mt-4 whitespace-pre-line text-sm leading-7 text-ink/80">{comment.body}</p>
                  )}
                </article>
              );
            })}

            {hasMoreComments ? (
              <button
                type="button"
                onClick={() => setVisibleCommentCount((current) => current + COMMENTS_PAGE_SIZE)}
                className="btn-secondary w-full"
              >
                Mostra altri commenti
              </button>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
