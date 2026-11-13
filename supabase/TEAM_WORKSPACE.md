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
5. Za objavljenu verziju postavite novu verziju aplikacije na Vercel sa istim javnim `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`. Za prikaz prijave pri otvaranju početne strane postavite `VITE_TEAM_LOGIN_REQUIRED=true` u okruženju koje testirate, pa pokrenite novi build ili redeploy. Bez te postavke zaposleni otvaraju **Prijava zaposlenih** u navigaciji. U režimu za goste bez veze dostupni su lokalni poslovi sa uređaja.

Deaktiviranje zaposlenog postavljanjem `active = false` odmah ukida pristup zajedničkim podacima na serveru. U aplikaciji ne postoji samostalno otvaranje naloga. Lozinke čuvajte kroz Supabase Auth.

## Rad u aplikaciji

- Šef u **Tim i obaveštenja → Dodeli merenje** bira majstora, unosi kupca, adresu, kontakt, datum i poruku. Dodela kreira posao u statusu **Merenje** i obaveštenje za izabranog majstora. Dodela postojećeg posla dostupna je u njegovom pregledu.
- Dok je dodeljeni posao u statusu **Merenje**, šef vidi podatke o poslu i razgovor. Baza prikazuje elemente i mere samo dodeljenom majstoru. Kada majstor klikne **Merenje završeno**, posao prelazi u **Poslati ponudu** i šefu se otvaraju svi elementi i ponuda. Vraćanje u **Merenje** ponovo skriva elemente dok majstor ne preda ispravke.
- Poslovi, elementi, poruke i obaveštenja čuvaju se u zajedničkoj bazi. Obaveštenja se osvežavaju u otvorenoj aplikaciji na svakih pet sekundi i odmah po povratku fokusa ili veze. Podešavanja i cenovnik i dalje se čuvaju na uređaju. Raniji lokalni poslovi ostaju dostupni u lokalnom režimu.

## Provera od merenja do završetka posla

1. Kao šef dodelite novi probni posao Milošu. Ako probni posao već ima predato merenje, vratite ga u **Merenje** i pošaljite Milošu poruku sa ispravkom.
2. Kao Miloš dodajte ili ispravite jedan element. U šefovom prozoru treba da piše **Merenje je u toku**. Proverite da su podaci o kupcu i razgovor dostupni.
3. Kao Miloš kliknite **Merenje završeno**. Kod šefa proverite obaveštenje **Poslati ponudu**. Otvorite posao i uporedite prikazane mere sa poslednjom ispravkom.
4. Kao šef otvorite **Pogledaj cenu i podeli dokument → Ponuda za kupca**, pa preuzmite probni PDF. Nakon provere dokumenta vratite se na posao i postavite status **Ponuda**.
5. Kao Miloš postavite **Prihvaćeno** da simulirate odgovor kupca. Kod šefa proverite obaveštenje da je posao spreman za izradu.
6. Kao šef postavite **U izradi**, pa **Završeno**. Kod Miloša proverite oba statusa i obaveštenja. Završen posao možete naći u **Poslovi → Završeno**.
