import { NextRequest, NextResponse } from "next/server";
import type { BookSearchResult } from "@/lib/types";

type GoogleBooksItem = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
  };
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length < 2 || query.length > 120) {
    return NextResponse.json({ error: "Inserisci titolo o autore tra 2 e 120 caratteri." }, { status: 400 });
  }

  const params = new URLSearchParams({
    q: query,
    maxResults: "12",
    printType: "books",
    langRestrict: "it"
  });

  if (process.env.GOOGLE_BOOKS_API_KEY) {
    params.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  }

  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`, {
    next: { revalidate: 60 * 60 }
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Google Books non ha risposto correttamente." }, { status: 502 });
  }

  const payload = (await response.json()) as { items?: GoogleBooksItem[] };
  const results: BookSearchResult[] = (payload.items || [])
    .map((item) => {
      const volume = item.volumeInfo || {};
      return {
        googleBooksId: item.id,
        title: volume.title || "Titolo non disponibile",
        author: volume.authors?.join(", ") || "Autore non indicato",
        description: volume.description || "",
        coverUrl: normalizeGoogleCover(volume.imageLinks?.thumbnail || volume.imageLinks?.smallThumbnail || "")
      };
    })
    .filter((item) => item.googleBooksId && item.title);

  return NextResponse.json({ results });
}

function normalizeGoogleCover(url: string) {
  if (!url) {
    return "";
  }

  return url.replace("http://", "https://");
}
