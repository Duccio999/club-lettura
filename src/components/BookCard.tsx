import Image from "next/image";
import Link from "next/link";
import type { Book } from "@/lib/types";

type BookCardProps = {
  book: Book;
  inviteCode: string;
  commentsCount: number;
};

export function BookCard({ book, inviteCode, commentsCount }: BookCardProps) {
  return (
    <Link
      href={`/group/${encodeURIComponent(inviteCode)}/books/${book.id}`}
      className="panel group grid min-h-40 grid-cols-[84px_1fr] gap-4 p-3 transition hover:-translate-y-0.5 hover:border-clay/50 hover:shadow-soft focus:outline-none focus:ring-2 focus:ring-bordeaux focus:ring-offset-2 focus:ring-offset-paper"
    >
      <div className="relative h-32 w-20 overflow-hidden rounded-md bg-rose shadow-sm">
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt={`Copertina di ${book.title}`}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs font-semibold text-clay">
            Nessuna copertina
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col py-1">
        <h2 className="line-clamp-2 text-base font-black leading-snug text-ink group-hover:text-bordeaux">{book.title}</h2>
        <p className="mt-1 truncate text-sm text-moss">{book.author || "Autore non indicato"}</p>
        <p className="mt-auto inline-flex w-fit rounded-full bg-blush px-3 py-1 text-xs font-bold text-bordeaux">
          {commentsCount === 1 ? "1 commento" : `${commentsCount} commenti`}
        </p>
      </div>
    </Link>
  );
}
