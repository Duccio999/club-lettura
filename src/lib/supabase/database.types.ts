export type Database = {
  public: {
    Tables: {
      groups: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          invite_code: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          invite_code?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          group_id: string | null;
          nickname: string;
          pin_hash: string;
          access_token_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id?: string | null;
          nickname: string;
          pin_hash: string;
          access_token_hash?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string | null;
          nickname?: string;
          pin_hash?: string;
          access_token_hash?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "members_group_id_fkey";
            columns: ["group_id"];
            referencedRelation: "groups";
            referencedColumns: ["id"];
          }
        ];
      };
      books: {
        Row: {
          id: string;
          group_id: string | null;
          title: string;
          author: string | null;
          description: string | null;
          cover_url: string | null;
          google_books_id: string | null;
          created_by_member_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id?: string | null;
          title: string;
          author?: string | null;
          description?: string | null;
          cover_url?: string | null;
          google_books_id?: string | null;
          created_by_member_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string | null;
          title?: string;
          author?: string | null;
          description?: string | null;
          cover_url?: string | null;
          google_books_id?: string | null;
          created_by_member_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "books_group_id_fkey";
            columns: ["group_id"];
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "books_created_by_member_id_fkey";
            columns: ["created_by_member_id"];
            referencedRelation: "members";
            referencedColumns: ["id"];
          }
        ];
      };
      comments: {
        Row: {
          id: string;
          book_id: string | null;
          member_id: string | null;
          body: string;
          is_spoiler: boolean | null;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          book_id?: string | null;
          member_id?: string | null;
          body: string;
          is_spoiler?: boolean | null;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          book_id?: string | null;
          member_id?: string | null;
          body?: string;
          is_spoiler?: boolean | null;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "comments_book_id_fkey";
            columns: ["book_id"];
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_member_id_fkey";
            columns: ["member_id"];
            referencedRelation: "members";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_group_by_invite_code: {
        Args: { p_invite_code: string };
        Returns: Array<{
          id: string;
          name: string;
          invite_code: string;
          created_at: string;
        }>;
      };
      create_group_from_ui: {
        Args: { p_name: string; p_invite_code: string };
        Returns: Array<{
          id: string;
          name: string;
          invite_code: string;
          created_at: string;
        }>;
      };
      get_or_create_member: {
        Args: { p_invite_code: string; p_nickname: string; p_pin_hash: string };
        Returns: Array<{
          id: string;
          group_id: string;
          nickname: string;
          created_at: string;
          access_token: string;
        }>;
      };
      get_member_for_group: {
        Args: { p_invite_code: string; p_member_id: string; p_access_token: string };
        Returns: Array<{
          id: string;
          group_id: string;
          nickname: string;
          created_at: string;
        }>;
      };
      list_group_books: {
        Args: { p_invite_code: string; p_member_id: string; p_access_token: string };
        Returns: Array<{
          id: string;
          group_id: string;
          title: string;
          author: string | null;
          description: string | null;
          cover_url: string | null;
          google_books_id: string | null;
          created_by_member_id: string | null;
          created_at: string;
          comments_count: number;
        }>;
      };
      get_group_book: {
        Args: { p_invite_code: string; p_member_id: string; p_access_token: string; p_book_id: string };
        Returns: Array<{
          id: string;
          group_id: string;
          title: string;
          author: string | null;
          description: string | null;
          cover_url: string | null;
          google_books_id: string | null;
          created_by_member_id: string | null;
          created_at: string;
        }>;
      };
      add_group_book: {
        Args: {
          p_invite_code: string;
          p_member_id: string;
          p_access_token: string;
          p_google_books_id: string;
          p_title: string;
          p_author: string;
          p_description: string;
          p_cover_url: string;
        };
        Returns: Array<{
          id: string;
          group_id: string;
          title: string;
          author: string | null;
          description: string | null;
          cover_url: string | null;
          google_books_id: string | null;
          created_by_member_id: string | null;
          created_at: string;
        }>;
      };
      list_book_comments: {
        Args: { p_invite_code: string; p_member_id: string; p_access_token: string; p_book_id: string };
        Returns: Array<{
          id: string;
          book_id: string;
          member_id: string;
          body: string;
          is_spoiler: boolean;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
          member_nickname: string;
        }>;
      };
      add_book_comment: {
        Args: {
          p_invite_code: string;
          p_member_id: string;
          p_access_token: string;
          p_book_id: string;
          p_body: string;
          p_is_spoiler: boolean;
        };
        Returns: Array<{
          id: string;
          book_id: string;
          member_id: string;
          body: string;
          is_spoiler: boolean;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
          member_nickname: string;
        }>;
      };
      update_own_comment: {
        Args: {
          p_invite_code: string;
          p_member_id: string;
          p_access_token: string;
          p_comment_id: string;
          p_body: string;
          p_is_spoiler: boolean;
        };
        Returns: Array<{
          id: string;
          book_id: string;
          member_id: string;
          body: string;
          is_spoiler: boolean;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
          member_nickname: string;
        }>;
      };
      delete_own_comment: {
        Args: { p_invite_code: string; p_member_id: string; p_access_token: string; p_comment_id: string };
        Returns: Array<{ id: string }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
