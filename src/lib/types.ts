export type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
};

export type Member = {
  id: string;
  group_id: string;
  nickname: string;
  created_at: string;
  access_token?: string;
};

export type Book = {
  id: string;
  group_id: string;
  title: string;
  author: string | null;
  description: string | null;
  cover_url: string | null;
  google_books_id: string | null;
  created_by_member_id: string | null;
  created_at: string;
};

export type BookWithCommentCount = Book & {
  comments_count: number;
};

export type Comment = {
  id: string;
  book_id: string;
  member_id: string;
  body: string;
  is_spoiler: boolean;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  member_nickname: string;
};

export type BookSearchResult = {
  googleBooksId: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
};
