# Club Lettura

Web app responsive/PWA per un piccolo club di lettura privato. Le amiche entrano con codice gruppo, creano o recuperano un profilo tramite nickname + PIN, aggiungono libri da Google Books e commentano con gestione spoiler.

## Stack

- Next.js con TypeScript
- Tailwind CSS
- Supabase come database
- Google Books API tramite route interna `/api/books/search`
- PWA minimale con manifest e service worker

## Installazione

```bash
npm install
cp .env.example .env.local
npm run dev
```

Apri `http://localhost:3000`.

## Supabase

1. Crea un nuovo progetto su Supabase.
2. Apri SQL Editor.
3. Esegui le migration in ordine:
   - `supabase/migrations/20260612130000_create_club_lettura_mvp.sql`
   - `supabase/migrations/20260612143000_enable_rls_and_secure_rpc.sql`
   - `supabase/migrations/20260612170000_create_group_from_ui.sql`
4. Puoi creare gruppi dalla home dell’app. Se vuoi creare anche un gruppo iniziale da SQL:

```sql
insert into public.groups (name, invite_code)
values ('Club delle amiche', 'AMICHE2026')
on conflict (invite_code)
do update set name = excluded.name
returning id, name, invite_code, created_at;
```

5. In Project Settings > API copia:
   - Project URL
   - anon public key

6. Inseriscile in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
GOOGLE_BOOKS_API_KEY=
```

`GOOGLE_BOOKS_API_KEY` è opzionale e resta solo lato server. Non inserire mai la service role key nel frontend e non usare variabili `NEXT_PUBLIC_` per segreti privati.

## Flusso di test completo

1. Avvia l’app con `npm run dev`.
2. Inserisci il codice gruppo creato in Supabase, per esempio `AMICHE2026`, oppure usa “Crea nuovo gruppo” dalla home.
3. Se crei un gruppo dalla UI, copia il codice generato e clicca “Entra nel gruppo”.
4. Alla prima entrata inserisci nickname e PIN di 4 cifre.
5. Verifica che in `localStorage` venga salvata una sessione con `member_id` e `access_token`.
6. Apri “Aggiungi libro”.
7. Cerca un titolo o autore.
8. Scegli un risultato: il libro viene salvato in Supabase e aperto nella pagina dettaglio.
9. Torna alla dashboard e verifica copertina, titolo, autore e numero commenti.
10. Nel dettaglio libro aggiungi un commento normale.
11. Aggiungi un commento con “Questo commento contiene spoiler”.
12. Verifica che lo spoiler sia nascosto finché non clicchi “Mostra spoiler”.
13. Modifica o elimina un tuo commento.
14. Usa “Esci dall’account” e verifica che torni alla schermata nickname + PIN dello stesso gruppo.
15. Usa “I miei gruppi” e verifica che si apra il pannello per passare a un gruppo recente o inserire un nuovo codice.
16. Entra con un altro nickname + PIN e verifica che i commenti altrui siano solo leggibili.
17. Rientra con lo stesso nickname + PIN iniziale e verifica che venga recuperato lo stesso profilo.

## Gestione gruppi e account

- “Crea nuovo gruppo” è disponibile nella home. Inserisci il nome del gruppo, l’app genera un invite code leggibile e chiama la RPC `create_group_from_ui`.
- “Esci dall’account” cancella solo la sessione membro del gruppo corrente da `localStorage`; resta nello stesso gruppo e mostra di nuovo nickname + PIN.
- “I miei gruppi” apre un pannello per passare a gruppi già usati in questo browser oppure inserire un nuovo codice invito. Non cancella automaticamente la sessione del gruppo corrente.

## Pubblicazione su Vercel

1. Pubblica il repository su GitHub.
2. Crea un nuovo progetto Vercel importando il repository.
3. Aggiungi le variabili d’ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GOOGLE_BOOKS_API_KEY` se vuoi usare una chiave Google Books
4. Esegui il deploy.
5. Verifica che il dominio Vercel legga e scriva correttamente sul progetto Supabase.

## Note di sicurezza

La migration `20260612143000_enable_rls_and_secure_rpc.sql` abilita Row Level Security su `groups`, `members`, `books` e `comments`, revoca l’accesso diretto alle tabelle per `anon`/`authenticated` e lascia al frontend solo chiamate RPC controllate.

La migration `20260612170000_create_group_from_ui.sql` aggiunge la RPC `create_group_from_ui(name, invite_code)` per creare gruppi dalla UI senza usare service role nel frontend.

Cosa protegge ora:

- Non è possibile leggere direttamente la tabella `groups`; il gruppo viene risolto solo tramite `get_group_by_invite_code(invite_code)`.
- Le liste libri, i dettagli libro e i commenti richiedono codice invito, `member_id` e `access_token` valido.
- I commenti vuoti vengono bloccati sia nel client sia nel database.
- Un membro può modificare o soft-delete solo commenti con il proprio `member_id`, verificato dalla RPC.
- Il PIN non viene salvato in chiaro: il client invia un hash SHA-256 e il database salva `pin_hash`.
- Il `member_id` da solo non basta più: il database salva solo `access_token_hash`, mentre il token in chiaro resta in `localStorage`.
- La service role key non è usata nel frontend. Il frontend usa solo `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- La creazione gruppi dalla UI passa da RPC `security definer`; chiunque abbia la anon key può creare un gruppo, quindi in produzione va aggiunto rate limit o un flusso admin.

Limiti senza Supabase Auth completo:

- L’identità resta una sessione bearer in `localStorage`. Se qualcuno copia `member_id` + `access_token`, può agire come quel membro.
- Il PIN viene hashato lato client. È meglio che salvarlo in chiaro, ma in produzione è preferibile hash server-side con salt e rate limit.
- Non esiste ancora una vera sessione Supabase collegata ad `auth.uid()`, quindi le policy RLS non possono distinguere utenti reali da sole. Per questo le regole forti vivono nelle RPC `security definer`.

Fase successiva consigliata:

- Introdurre Supabase Auth, anche con magic link o OTP, e collegare `members.user_id` a `auth.users.id`.
- Spostare il PIN su API route server o Edge Function con hash `bcrypt`/`argon2` e rate limit.
- Convertire le RPC più sensibili in policy RLS basate su `auth.uid()`.
- Aggiungere audit log per modifiche/eliminazioni dei commenti.
- Aggiungere rate limit alla creazione gruppi.

## TODO importanti

- Collegare `members` a Supabase Auth prima di usare dati reali sensibili.
- Aggiungere test automatici per flusso member, duplicati libro e permessi commenti.
- Migliorare la PWA con strategia cache più fine per asset e pagine.
- Aggiungere controlli anti-abuso sulla creazione gruppi pubblica.
