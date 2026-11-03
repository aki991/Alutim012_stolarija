# Prijem specifikacije sa terena

## Jednokratno uključivanje

Pripremljeni fajlovi sami po sebi ne menjaju udaljeni Supabase projekat. Potrebno je:

1. U Supabase projektu `guqxveicqhmhasgdlxpw`, otvoriti **SQL Editor** i izvršiti ceo fajl `supabase/migrations/202611030001_field_specifications.sql`. On kreira privatni bucket, tabelu prijema i serverske kvote. Ne menja lokalne poslove ili cenovnik.
2. Iz korena ovog projekta postaviti Edge Function:

   ```powershell
   npx supabase login
   npx supabase functions deploy submit-field-specification --project-ref guqxveicqhmhasgdlxpw
   ```

   `supabase/config.toml` namerno isključuje JWT proveru samo za ovu funkciju: radnik ne unosi PIN niti se prijavljuje. Funkcija koristi serverske `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` promenljive koje hosted Supabase obezbeđuje automatski. Service role ključ se nikada ne stavlja u Vercel `VITE_` promenljive, browser ili izvorni kod.
3. U Vercelu zadržati `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` (javni anon/publishable ključ), pa uraditi novi deployment aplikacije. Za lokalni razvoj iste vrednosti su u `.env.local`; restartovati Vite posle izmene.
4. Na stvarnom uređaju otvoriti **Podeli → Pošalji u app**. U Supabase Table Editor-u proveriti novi red u `field_specifications`, pa u Storage-u PDF na putanji iz tog reda. Tek potvrđen serverski upis daje poruku o uspehu.

Za slanje nije potrebna prijava. To je javni prijemni endpoint: svako ko zna njegovu adresu može da pošalje validan zahtev. Čitanje, listanje i menjanje postojećih podataka nisu javni. Postavljene su kvote 30 zahteva / 10 minuta po hashiranoj IP adresi i 2000 / UTC dan ukupno; PDF najviše 20 MB. Ako se potrebe promene, kvote se menjaju u SQL funkciji. IP kvota je pomoćna zaštita iza mrežnog proxy-ja; globalna kvota važi nezavisno od IP-a.

## Ugovor za Claude Code / kancelarijsku aplikaciju

Obe aplikacije treba da koriste **isti Supabase projekat**. PDF se ne sme čuvati kao base64 u običnoj tabeli: nalazi se u privatnom Supabase Storage-u, a tabela čuva njegovu putanju i metapodatke.

- Tabela: `public.field_specifications`.
- Bucket: `field-specifications`, **private**.
- Putanja: `<id-prijema>/specifikacija.pdf`.
- `id`: UUID v4 koji ostaje isti pri ponavljanju neuspelog slanja u otvorenom ekranu.
- `created_at`: vreme prijema koje postavlja baza.
- `status`: početno `received`; kancelarija kasnije može koristiti `processing`, `processed`, `rejected`.
- `source_app`: `alu-tim-012-teren`, `format_version`: `1`.
- `job_id`, `job_updated_at`: lokalna oznaka posla i verzija posla. `job_id` nije globalni primarni ključ.
- `customer_name`, `technician`: podaci za listu pristiglih specifikacija. Majstor je unet tekst, nije potvrđen identitet prijavljenog korisnika.
- `position_count`: broj različitih pozicija, ne zbir komada.
- `total_amount`: poslednja sačuvana okvirna ukupna cena, na dve decimale; `currency`: `EUR`.
- `has_unpriced`: postoje li pozicije koje tek čekaju ručnu cenu. Ako je true, zbir poznatih stavki nije konačna cena celog posla.
- `bucket_id`, `storage_path`, `file_name`, `file_size`, `content_sha256`: podaci za preuzimanje i proveru PDF-a.

**Novi red je događaj „stigla je specifikacija sa terena“.** Red se pravi tek nakon čuvanja PDF-a. Office aplikacija ne treba da sluša sve Storage događaje, jer oni mogu predstavljati nepotvrđen upload. Jedinstveni ključ obaveštenja treba da bude `field_specifications.id`, kako ponovna konekcija ne bi napravila duplo obaveštenje.

Najjednostavnije početno povezivanje: serverski deo kancelarijske aplikacije čita ovu tabelu sortiranu po `created_at desc`, čuva/proverava obrađene ID-jeve i prikazuje nove prijeme. Supabase Realtime `INSERT` događaji mogu biti dodati kasnije, uz publikaciju i RLS prava za autorizovane kancelarijske korisnike. Za pouzdana obaveštenja proveriti i nepročitane zapise pri otvaranju/povratku veze — Realtime sam nije trajni red poruka. Web Push za zatvorenu aplikaciju zahteva dodatnu implementaciju; ovim slanjem još nije uveden.

Trenutno su `anon` i `authenticated` pristup tabeli blokirani, a bucket nema javne read/upload politike. Kancelarijska aplikacija može koristiti **sopstveni zaštićen serverski endpoint** sa service role ključem; on mora proveriti prijavu/ovlašćenje kancelarijskog korisnika pre čitanja. Ključ ostaje isključivo na serveru. Alternativa je da Claude Code uvede odgovarajuće kancelarijske RLS politike. Ne otvarati tabelu ili bucket svima radi lakšeg povezivanja.

Primer isključivo za autorizovani office backend:

```ts
const { data: incoming, error } = await admin
  .from('field_specifications')
  .select('*')
  .order('created_at', { ascending: false });

// Posle provere office korisnika i izbora dozvoljenog reda:
const { data: link, error: linkError } = await admin.storage
  .from(row.bucket_id)
  .createSignedUrl(row.storage_path, 60);
```

## Ponašanje slanja

- Generiše se samo **specifikacija za kancelariju**, sa tehničkim podacima, fotografijama i poslednjim sačuvanim cenama. Ponuda kupcu se ne šalje u bazu ovim dugmetom.
- Status posla, lokalni podaci i kalkulacija se slanjem ne menjaju.
- Nema automatskog slanja bez interneta niti prikrivene offline liste. Radnik dobija poruku i može ponoviti slanje kada se vrati veza.
- Server potvrđuje tek kada postoje i PDF i zapis. Ako veza pukne između ta dva koraka, ponovni pokušaj koristi isti ID i identičan PDF i dovršava upis bez prepisivanja/dupliranja.
- Isti ID sa drugim sadržajem se odbija. Ponovno otvaranje ekrana ili promena sačuvanog posla priprema novi prijem. Za istu otvorenu verziju ponovljen klik vraća potvrdu prethodnog prijema.
- Upload i baza nisu jedna transakcija: posle prekida može ostati PDF bez reda. Takav objekat ne daje obaveštenje kancelariji. Ponovljeno slanje iz istog ekrana ga dovršava; eventualno periodično čišćenje starih objekata bez reda može biti uvedeno odvojeno.
- Server generiše putanju i standardni naziv i ne vraća javni URL. Dokumenti nisu javna galerija.

## Provere i granice

`src/services/office-endpoint.test.ts` proverava serverski handler sa lažnim Storage/DB adapterom: validaciju, kvote, idempotentnost, pad uploada i oporavak nepotpunog upisa. `tests/office-send.spec.ts` generiše pravi kancelarijski PDF, proverava multipart slanje, logo, greške, offline i ponovni pokušaj na telefonu/tabletu, ali mrežni prijem je mockovan — test ne šalje korisničke podatke u stvarnu bazu.

Udaljena SQL migracija, stvarna Storage prava i postavljena Edge Function moraju se potvrditi korakom 4 nakon uključivanja. U ovom projektu nije implementirana druga aplikacija niti su stvarna push obaveštenja već aktivna.

Dokumentacija: [privatni Storage i pristup](https://supabase.com/docs/guides/storage/security/access-control), [postavljanje funkcije](https://supabase.com/docs/guides/functions/deploy), [serverske promenljive](https://supabase.com/docs/guides/functions/secrets).
