# Zajednički poslovi zaposlenih

## Podešavanje dva test naloga

1. U Supabase SQL Editoru primenite [migraciju za tim](migrations/202611120001_team_workspace.sql), pa [migraciju za prikaz završenih merenja](migrations/202611130001_team_measurement_visibility.sql). Svaku migraciju pokrenite jednom. Ako nalozi već rade, primenite samo novu migraciju za prikaz merenja.
2. U **Authentication → Users → Add user → Create new user** kreirajte dva naloga. Za prijavu bez stvarne e-adrese koristite sledeće vrednosti u polju **Email**.

   | Nalog | Email u Supabase-u | Korisničko ime za prijavu | Uloga |
   | --- | --- | --- | --- |
   | Šef | `sef@alutim012.local` | `sef` | `manager` |
   | Majstor | `milos@alutim012.local` | `milos` | `worker` |

   Za svaki nalog unesite zasebnu lozinku i uključite **Auto Confirm User**. Aplikacija dopisuje `@alutim012.local` kada zaposleni upiše korisničko ime. Stvarne, potvrđene e-adrese postojećih naloga takođe rade. Korisnička imena mogu imati 3–32 znaka, slova `a–z`, brojeve, tačku, crticu i donju crtu. Na primer, `Milos` i `milos` vode na isti nalog.
3. U listi **Users** kopirajte UUID oba naloga. U **SQL Editor → New query** nalepite upit ispod, zamenite primere UUID-ovima iz Supabase-a i kliknite **Run**. Ako ste naloge već kreirali, koristite njihove UUID-ove i postojeće podatke za prijavu.

   ```sql
   insert into public.field_team_members (id, name, role) values
     ('00000000-0000-4000-8000-000000000001', 'Šef', 'manager'),
     ('00000000-0000-4000-8000-000000000002', 'Miloš', 'worker');
   ```

4. Za lokalni test pokrenite `npm run dev` i otvorite [stranicu za prijavu](http://127.0.0.1:5187/prijava). U običnom prozoru prijavite se kao `sef`, a u privatnom kao `milos`, da biste imali dve odvojene sesije.
5. Za objavljenu verziju postavite aplikaciju na Vercel sa istim javnim `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`. Produkcijska verzija traži prijavu pri otvaranju bilo koje stranice. Na lokalnom razvojnom serveru postavite `VITE_TEAM_LOGIN_REQUIRED=true` ako želite da proverite isti način ulaska.

## Administrator, korisnici i zajednički cenovnik

1. U Supabase SQL Editoru primenite [migraciju za administraciju](migrations/202611150001_team_admin.sql) nakon ranijih migracija tima. Postojeći aktivni nalozi sa ulogom `manager` dobijaju administratorski pristup.
2. Iz korena repozitorijuma prijavite se komandom `npx.cmd --yes supabase@3.1.0 login`, pa objavite funkciju komandom `npx.cmd --yes supabase@3.1.0 functions deploy field-team-accounts --remote=KOD_PROJEKTA --use-api`. Zamenite `KOD_PROJEKTA` ID-jem postojećeg projekta Stolarije. Funkcija koristi ključeve iz okruženja Supabase-a i proverava ulogu prijavljenog korisnika pre svake izmene. Zatim objavite klijentsku verziju na Vercelu.
3. Kao šef ili admin otvorite **Podešavanja → Korisnici**. Za novi nalog unesite korisničko ime ili e-mail, ime i prezime i lozinku, pa izaberite ulogu. Korisnik može odmah da se prijavi. Brisanje ukida pristup i uklanja nalog sa liste, dok poslovi i poruke ostaju sačuvani. Po potrebi nedovršeno merenje dodelite drugom majstoru.
4. Ako ste ranije unosili svoje cene, na istom uređaju i u istom pregledaču otvorite **Cenovnik**, izaberite **Učitaj ranije cene sa ovog uređaja** i proverite iznose. Kliknite **Sačuvaj cenovnik** da bi ih dobio ceo tim. Uvoz je dostupan dok zajednički cenovnik nema sačuvanu izmenu.
5. Proverite oba naloga. Administrator menja cenovnik, PDV i korekcije ponude. Majstor vidi iste cene i može da menja mere i opremu, što automatski preračunava ponudu. Baza proverava dozvole i za direktne zahteve.

## Zajednička prijava sa Ogradama i arhiva Stolarije

1. U postojećem Supabase projektu primenite redom [migraciju arhive](migrations/202611150002_job_document_archive.sql), [migraciju povezivanja naloga](migrations/202611150003_link_shared_accounts.sql) i [migraciju podešavanja naloga](migrations/202611150004_team_preferences.sql).
2. Ponovo objavite Edge Function `field-team-accounts` prema prethodnom odeljku. Zatim objavite verziju Stolarije na Vercelu.
3. Za zaposlenog koji već ima nalog u Ogradama otvorite **Podešavanja → Korisnici**, označite **Postojeći nalog**, upišite njegovo korisničko ime ili e-mail i kliknite **Dodeli pristup**. Koristi se isti Supabase Auth nalog sa postojećom lozinkom. Novi povezani član dobija ulogu majstora u Stolariji.
4. Otvorite posao, pa **Cena i ponuda → Ponuda za kupca** ili **Specifikacija za kancelariju**. PDF se čuva u privatnom Supabase Storage-u pri izradi. U odeljku **Sačuvani dokumenti** otvaraju se arhivirane verzije sa datumom izrade. Sačuvani PDF zadržava sadržaj i nakon kasnijih izmena posla ili cenovnika.
5. Na drugom uređaju prijavite se istim nalogom i proverite dokument i sačuvane podrazumevane vrednosti iz podešavanja **Profili i materijali** i **Dokumenti**. Podešavanje prikaza cena takođe prati nalog.

## Admin, šef i majstor

1. Primenite [migraciju uloga](migrations/202611150007_team_account_roles.sql) posle prethodnih migracija Stolarije. Zatim objavite funkciju `field-team-accounts` i novu verziju aplikacije.
2. Za svoj nalog izaberite **Authentication → Users → Add user → Create new user**. Unesite e-mail i lozinku, uključite **Auto Confirm User** i kopirajte **User UID**. Koristite zaseban nalog za administraciju ako ste prethodni nalog koristili kao šef.
3. U **SQL Editor → New query** zamenite `OVDE-NALEPITE-USER-UID` kopiranim UID-om i `Ime i prezime` nazivom svog naloga, pa kliknite **Run**.

   ```sql
   begin;
   insert into public.field_team_members (id, name, role, active)
   values ('OVDE-NALEPITE-USER-UID', 'Ime i prezime', 'manager', true)
   on conflict (id) do update set role = 'manager', active = true;

   insert into field_team_private.app_admins (member_id)
   values ('OVDE-NALEPITE-USER-UID')
   on conflict (member_id) do nothing;
   commit;
   ```

4. U Stolariji se prijavite tim nalogom i otvorite **Podešavanja → Korisnici**. Uz vaš nalog piše **Admin**. Šef na svojoj listi vidi ostale šefove i majstore. U porukama i obaveštenjima radnje admina nose naziv **ALU TIM 012**.
5. Kao šef otvorite **Podešavanja → Korisnici**, unesite podatke i u polju **Uloga** izaberite **Šef** ili **Majstor**. Isti izbor važi i pri povezivanju naloga koji još nema pristup Stolariji. Svaki šef može da dodaje šefove i majstore i briše druge šefove ili majstore.

Poslovi i arhivirani dokumenti prikazuju se u Stolariji prema postojećim pravima za posao. Stolarija i Ograde koriste isti Supabase Auth. Brisanje zajedničkog naloga ukida mogućnost prijave u obe aplikacije. Sačuvani poslovi i poruke ostaju povezani sa istorijom korisnika.

## Vidljivost dodeljenih poslova

1. U SQL Editoru primenite [migraciju vidljivosti poslova](migrations/202611150005_team_job_visibility.sql), pa objavite novu verziju Stolarije na Vercelu.
2. Otvorite **Dodeli merenje** i izaberite zaduženu osobu. Podrazumevano posao vidi ceo tim. Za privatni posao označite **Prikaži posao samo zaduženoj osobi i šefovima**.
3. Za promenu vidljivosti sačuvanog posla otvorite **Dodela i vidljivost**, promenite opciju i kliknite **Sačuvaj vidljivost**. Ranije dodeljeni poslovi počinju sa privatnom vidljivošću.
4. Zadužena osoba radi na poslu i prima poruke i obaveštenja o dodeli. Ostali članovi tima imaju pristup pregledu deljenog posla. Mere i dokumenti dostupni su im po završetku merenja.

## Rad u aplikaciji

- Za dodelu merenja drugom šefu primenite [migraciju za dodelu merenja šefovima](migrations/202611160001_team_manager_measurements.sql) posle migracije uloga i objavite novu verziju aplikacije.
- Za vraćanje obrisanih poslova primenite [migraciju korpe](migrations/202611160002_team_job_trash.sql) posle migracije za dodelu merenja šefovima. Šef može da vrati posao kroz **Više → Korpa → Vrati posao**. Vraćaju se i povezane mere, poruke i dokumenti.
- Za **Trajno obriši** i **Selektuj sve** primenite [migraciju trajnog brisanja](migrations/202611160003_team_purge_jobs.sql) posle migracije korpe. Arhivirani PDF-ovi brišu se preko Storage API-ja. Posle prekida veze izaberite **Nastavi brisanje** u korpi. [Supabase Storage — brisanje datoteka](https://supabase.com/docs/guides/storage/management/delete-objects)
- Šef na stranici **Dodeli merenje** bira majstora ili drugog šefa i unosi podatke o poslu. Zadužena osoba dobija obaveštenje o dodeli, a uputstvo može da otvori kroz **Poruke**. Za promenu zadužene osobe otvorite posao i izaberite **Dodela i vidljivost**.
- Ikonice **Obaveštenja** i **Poruke** otvaraju zasebne stranice. U razgovoru je samo poslednja primljena poruka nepročitana dok je korisnik ne vidi, ne označi kao pročitanu ili ne pošalje odgovor. Baza pamti pročitanost po nalogu. Za ovo je potrebna [migracija za pročitanost poruka](migrations/202611130002_team_message_reads.sql).
- Za obaveštenja kada je aplikacija zatvorena otvorite **Nalog → Obaveštenja na uređaju → Uključi na ovom uređaju** i dozvolite obaveštenja. Ponovite na svakom uređaju na kom želite da ih primate. Na iPhone-u i iPad-u prvo dodajte aplikaciju na početni ekran i pokrenite je preko ikonice. Odjava isključuje obaveštenja na tom uređaju.
- Dok je dodeljeni posao u statusu **Merenje**, zadužena osoba može da vidi i menja mere. Ostali šefovi vide podatke o poslu i razgovor. Kada zadužena osoba klikne **Merenje završeno**, posao prelazi u **Poslati ponudu** i ostalim šefovima se otvaraju elementi i ponuda. Vraćanje u **Merenje** ponovo ograničava pristup merama na zaduženu osobu.
- Poslovi, elementi, poruke, obaveštenja, cenovnik i podešavanja prijavljenog naloga čuvaju se u bazi. Obaveštenja se osvežavaju u otvorenoj aplikaciji na svakih pet sekundi i odmah po povratku fokusa ili veze. Nacrt elementa čuva se na uređaju dok majstor ne doda element u posao. Raniji lokalni poslovi ostaju dostupni u lokalnom režimu.

## Provera od merenja do završetka posla

1. Kao šef dodelite novi probni posao Milošu. Ako probni posao već ima predato merenje, vratite ga u **Merenje** i pošaljite Milošu poruku sa ispravkom.
2. Kao Miloš dodajte ili ispravite jedan element. U šefovom prozoru treba da piše **Merenje je u toku**. Proverite da su podaci o kupcu i razgovor dostupni.
3. Kao Miloš kliknite **Merenje završeno**. Kod šefa proverite obaveštenje **Poslati ponudu**. Otvorite posao i uporedite prikazane mere sa poslednjom ispravkom.
4. Kao šef otvorite **Pogledaj cenu i podeli dokument → Ponuda za kupca**, pa preuzmite probni PDF. Nakon provere dokumenta vratite se na posao i postavite status **Ponuda**.
5. Kao Miloš postavite **Prihvaćeno** da simulirate odgovor kupca. Kod šefa proverite obaveštenje da je posao spreman za izradu.
6. Kao šef postavite **U izradi**, pa **Završeno**. Kod Miloša proverite oba statusa i obaveštenja. Završen posao možete naći u **Poslovi → Završeno**.
