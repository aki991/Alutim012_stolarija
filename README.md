# ALU TIM 012 · Terenski rad

Postojeća React/TypeScript aplikacija je preuređena za brz rad na tabletu. Početna strana i brending su zadržani. Sve glavne rute sada koriste trajni AppShell. Novi glavni tok je **naziv posla → vrsta stolarije → merenje → dodavanje → pregled cene i dva PDF-a**.

## Pokretanje

Potrebni su Node.js 22.12+ i npm; projekat je proveren na Node.js 24.

```powershell
npm install
npm run dev
```

Otvorite **http://127.0.0.1:5187/** ili pokrenite `Pokreni aplikaciju.cmd`. Port 5187 je zaseban od drugog projekta na portu 5173. Vite prikazuje LAN adresu za tablet na istoj mreži.

Produkcioni pregled:

```powershell
npm run build
npm run preview
```

Adresa je **http://127.0.0.1:4187/**. Za postavljanje poslužite `dist/`, sa SPA fallback pravilom na `index.html`.

## Scenario prezentacije

1. Na početnoj kliknite **Novi posao**.
2. Unesite **Petrović** u jedino polje i kliknite **Započni merenje**.
3. Izaberite **Prozor**. Odmah se otvara dvokrilni prozor 1600 × 1400 mm.
4. Unesite širinu i visinu; crtež, kote i cena se menjaju odmah. Brojevi su 24–30 px. `−` i `+` menjaju mere za 10 mm.
5. Velikim dugmadima izaberite jedno, dva ili tri krila i način otvaranja. Dodir na krilo u crtežu omogućava podešavanje samo tog krila; **Sva krila** vraća zajedničko podešavanje.
6. Izaberite ALU/PVC. Profil, boju, staklo, okov, dodatke, količinu, radove, napomene i fotografije otvorite kroz **Dodatne opcije**.
7. Kliknite **Dodaj u posao**. Otvara se jednostavna lista elemenata.
8. Izaberite **Dodaj sledeći element**, dodajte drugi prozor i balkonska vrata (početna mera 900 × 2200 mm).
9. Kliknite **Pogledaj cenu**, pa **Ponuda za kupca** i **Specifikacija za kancelariju**.

Telefon, email, adresa, objekat i majstor nisu uslov za početak. Naknadno su dostupni kroz **Podaci o poslu**. Datum se automatski beleži; ako se opciono polje datuma isprazni, zadržava se prethodni datum. Novi poslovi dobijaju ID i ISO vreme kreiranja.

## Ekrani i raspored

- **Izbor vrste:** osam velikih kartica — Prozor, Vrata, Balkonska vrata, Klizni sistem, Fiksni element, Roletna, Komarnik i Ostalo. Ne prolazi se kroz izbor 15 sličnih modela.
- **Merenje na horizontalnom tabletu:** približno 60% prostora za proporcionalan SVG i 40% za osnovne kontrole. Trajni sidebar je u merenju inicijalno skupljen na ikone i može se proširiti.
- **Telefon i uspravni tablet:** crtež je iznad kontrola. Radna površina se skroluje unutar ekrana, dok je veliko dugme za dodavanje ispod nje, bez prekrivanja kontrola. Dostupan je prošireni crtež.
- **Posao:** mala skica, naziv, dimenzije, broj krila, količina i cena. Olovka otvara izmenu; meni sa tri tačke sadrži dupliranje, pomeranje i brisanje.
- **Cena:** čitljiv spisak i izdvojeni zbir sa PDV-om. Popust, ručne cene, paketi i uslovi su u opcionoj sekciji **Korekcija cene i uslovi**.
- **Katalog:** osam velikih kategorija sa različitim SVG ikonama. Svih 17 prethodnih modela je dostupno pod „Svi modeli“. Izbor otvara konfigurator u zapamćenom poslu; bez otvorenog posla traži samo naziv.

Osnovni pravougaoni prozori, vrata, fiksni i klizni paneli imaju funkcionalan SVG. Jednostruko krilo ne može dobiti kombinaciju „Levo + desno“; prikazuje se kratka poruka. Otklop se ne nudi za vrata. Menjanje broja i otvaranja krila čuva ukupne mere. Stari četvorokrilni elementi ostaju podržani.

Nadsvetla, kombinacije sa različitim visinama i složene proizvodne geometrije nisu implementirane. Nasleđene kataloške kombinacije imaju pojednostavljen pravougaoni prikaz i zahtevaju razradu u kancelariji. Crteži služe za terensku specifikaciju, nisu proizvodno verifikovani.

## Čuvanje i migracija

- Postojeći ključ **`alu-tim-teren-v1`** je zadržan. Nema resetovanja ili zamene postojećih poslova demo podacima pri redovnom učitavanju.
- Migracija dodaje podrazumevani profil kada ga stara pozicija nema (`PVC 70 mm` ili `ALU termo profil`). ID-jevi, mere, količine, ručne cene, paketi, popusti, radovi i fotografije ostaju sačuvani.
- Novo vreme kreiranja se beleži tačno. Za stare poslove koji ga ranije nisu imali koristi se postojeće vreme izmene, ili datum posla kao rezervna vrednost.
- **Sačuvani poslovi** su u `localStorage`, sa odlaganjem upisa 350 ms i upisom pri napuštanju stranice. Greška ili puna kvota imaju jasnu poruku.
- **Otvorene izmene elementa** se čuvaju kao odvojen nacrt u `sessionStorage`. Osvežavanje iste kartice ih čuva; sačuvan element u poslu ostaje neizmenjen dok se ne klikne **Sačuvaj izmene**. Novi element se dodaje tek preko **Dodaj u posao**. Nakon potvrde nacrt se uklanja. Zatvaranje kartice može ukloniti nepotvrđeni nacrt.
- JSON rezervna kopija iz Podešavanja sadrži sačuvane poslove i fotografije, a ne nepotvrđene nacrte. Uvoz proverava podatke i traži potvrdu zamene.
- Skladišta su odvojena po browseru, adresi i portu. `127.0.0.1`, `localhost`, LAN IP i produkcioni port nemaju iste podatke.

Fotografije: do četiri po elementu, JPG/PNG/WebP do 10 MB pre optimizacije. Slike se smanjuju na najviše 1000 px, JPEG kvalitet 0,65 i ograničenje približno 475 KB posle optimizacije. Ako kvota nije dovoljna, izvezite kopiju i uklonite veće slike.

## Kalkulacija je zadržana

Sve cene su **demonstracione** i nisu zvanični cenovnik firme. Valuta ostaje **EUR**; iznosi u RSD sa referentne slike nisu kopirani niti je uvedena prećutna konverzija.

Obračun kombinuje površinu profila i stakla, broj otvarajućih krila za okov, površinu dodataka, dužinu klupice, obim za montažu/demontažu, radove, količinu i transport.

- **Standard:** faktor profila 1; **Optimal:** 1,12; **Premium:** 1,28. Odabrano staklo i okov ostaju prema elementu.
- Naziv profila se beleži i pojavljuje u dokumentima. Ova verzija nema verifikovan cenovnik pojedinačnih proizvođačkih profila; cena profila je postojeća demo stopa po materijalu.
- Ručna cena menja jedinični iznos cele pozicije, sa njenim dodacima i radovima. Prazno polje vraća automatski obračun; nula je dozvoljena. Ručna cena ostaje ista pri promeni paketa.
- Popust važi za elemente, transport i zajedničke radove pre poreza.
- PDV: neto cene dodaju porez; bruto cene izdvajaju već uključeni porez; režim bez PDV-a ne dodaje porez. Nema dvostrukog obračuna.
- Promena cenovnika i dalje ažurira postojeće okvirne obračune; nema zaključanih istorijskih verzija cena.
- Roletnu/komarnik nemojte istovremeno dodavati kao samostalni element i dodatak istoj poziciji ako želite samo jedan obračun.

## Dokumenti i deljenje

Oba postojeća generatora koriste jsPDF i lokalne Arial fontove sa srpskim slovima. Tehničke ilustracije koriste isti SVG kao aplikacija.

- **Ponuda za kupca:** kupac, elementi, dimenzije, količine, karakteristike i profil, jedinične/ukupne cene, PDV i uslovi. Ne sadrži interne nabavne cene ili marže.
- **Specifikacija za kancelariju:** svi podaci o poslu i pozicijama, širine i otvaranja krila, profili, staklo, okovi, radovi, napomene, fotografije i detaljan okvirni obračun.

Dva glavna dugmeta direktno preuzimaju odgovarajuće dokumente. **Podeli** koristi podržano sistemsko deljenje fajlova, uz preuzimanje kao rezervu. Otkazivanje nije označeno kao slanje. Email dugme priprema poruku; PDF se dodaje ručno.

Posle testova primeri su u `output/pdf/AT-2026-012-ponuda.pdf` i `output/pdf/AT-2026-012-specifikacija.pdf`.

## Offline

Posle prvog uspešnog otvaranja produkcione verzije service worker kešira aplikaciju, fontove, slike i PDF module. Provereno je ponovno otvaranje i PDF izvoz bez interneta. Za Android tablet preko LAN adrese potrebna je HTTPS verzija za service worker i Web Share; na localhost/127.0.0.1 radi i HTTP. Razvojni Vite server nema offline keš.

## Provere

```powershell
npm test
npm run test:e2e
```

E2E skripta pravi produkcionu verziju i koristi instalirani Microsoft Edge. Sama pokreće potrebne servere ako već ne rade. Izveštaj: `playwright-report/index.html`. Snimci svih radnih ekrana na 1366×900, 1024×768, 768×1024 i 390×844 su u `test-results/field-*.png`; odabrani konačni snimci su u `output/design/`.

Testovi pokrivaju jedno obavezno polje, osam izbora, više elemenata, mere/SVG, broj i otvaranje krila, dodatke i profile, nacrte, ponovnu izmenu, fotografije, nedozvoljene mere, stari format podataka, kopije, PDV i popuste, oba dokumenta, orijentacije ekrana i offline izvoz.

## Organizacija koda

- `src/models.ts`, `src/catalog.ts`, `src/field-types.ts` — sačuvani modeli, sporedni katalog i osam brzih izbora.
- `src/store.ts`, `src/services/storage.ts` — postojeće lokalno skladište i kompatibilna migracija.
- `src/pages-editor.tsx` — izbor tipa, centralno merenje i lista elemenata posla.
- `src/pages-quote.tsx` — pregled cene, opcione korekcije i dokumenti.
- `src/components/NewJobDialog.tsx`, `FieldHeader.tsx`, `ElementGlyph.tsx`, `PositionOptions.tsx` — delovi novog toka.
- `src/components/Drawing.tsx` — proporcionalni SVG bez dekorativnih profila i kvaka.
- `src/services/calculation.ts` — zadržan kalkulacioni servis.
- `src/services/documents.tsx` — oba PDF dokumenta.
- `src/field.css` — tablet i mobilni radni ekrani, bez promene početne kompozicije.

Backend je potreban za korisnike i stvarne uloge, centralni verifikovani cenovnik, sinhronizaciju između uređaja, serverske fotografije i kopije, istorijske ponude i potvrđeno slanje priloga. Ništa od toga nije simulirano kao izvršeno.

## Trajna navigacija i ostali moduli

- `src/components/AppShell.tsx` objedinjuje bočnu i donju navigaciju; `src/navigation.ts` pamti otvoreni posao, poslednju radnu putanju i izbor širine sidebara u `sessionStorage` ključu `alu-navigation-v1`.
- Na telefonu je donja traka **Početna / Poslovi / Katalog / Više**, sa safe-area prostorom. Više otvara Ponude, Cenovnik i Podešavanja. Dostupna je i dok je otvoren dijalog dodatnih opcija. Ostaje dostupna i u proširenom 2D prikazu; crtež zauzima prostor iznad nje.
- Na tabletu i desktopu sidebar ostaje prisutan u poslu, katalogu, konfiguratoru, pregledu cene i svim podešavanjima. Dugme iznad stavki menja proširen i kompaktan prikaz. Na radnim ekranima početno je kompaktan radi većeg crteža.
- Izvan posla, traka **Nastavi merenje** vraća na zapamćeni ekran. Kada postoji nacrt, prikazuje se i **Pregled posla**. Prelazak na drugu stranicu sinhrono čuva dimenzije i konfiguraciju nacrta; dovršena obrada fotografije se takođe upisuje u nacrt. Time se ne dodaje završena pozicija.
- Sadržaj, radni footer i globalna navigacija imaju odvojene zone. Safe-area i visina mobilne navigacije ulaze u račun dostupne visine; dugmad za dodavanje i dokumente ostaju iznad donje trake.
- Svi poslovi i Ponude koriste kompaktne horizontalne kartice: naziv, broj pozicija/elemenata, status, postojeći okvirni iznos, datum i mala skica. Pretraga i statusni filteri su sačuvani. Dupliranje i potvrđeno brisanje su u meniju sa tri tačke.

Podešavanja su hub sa pet podstranica:

| Celina | Ruta | Sadržaj |
| --- | --- | --- |
| Profili i materijali | `/podesavanja/profili` | Podrazumevani materijal, profil, boja, staklo i okov za nove elemente |
| Cenovnik | `/cenovnik` ili `/podesavanja/cenovnik` | Svi prethodni parametri, grupisani na profile, staklo, okove, dodatke i usluge |
| PDV i obračun | `/podesavanja/pdv` | Postojeći način unosa cena i stopa PDV-a |
| Dokumenti | `/podesavanja/dokumenti` | Važenje, isporuka i plaćanje za nove poslove |
| Podaci i rezervne kopije | `/podesavanja/podaci` | Majstor, izvoz i uvoz sa upozorenjem pre zamene |

Nove opcije `settings.elementDefaults` i `settings.documentDefaults` su opcione i proveravaju se pri uvozu. Nisu potrebne u starim kopijama. Njihova izmena ne prepisuje stare poslove, postojeće pozicije ili uslove ranijih ponuda. `calculation.ts` i PDF servis su zadržani.

Preuređeni moduli su u `src/pages-lists.tsx` i `src/pages-settings.tsx`, zaglavlje u `src/components/ModuleHeader.tsx`, a zajednički raspored u `src/shell.css`. Playwright scenariji u `tests/navigation.spec.ts` pokrivaju duboku navigaciju i nacrte, izbor kataloga sa i bez otvorenog posla, cene/podešavanja, fullscreen, sidebar i širine 390, 768, 1024 i 1280 px. Njihovi snimci su `test-results/navigation-*.png`.

## Pojednostavljene mobilne opcije

`src/refinements.css` uređuje panel Dodatne opcije i meni Više kao mobilne panele koji se otvaraju odozdo. Naziv i količina su u istom redu; Bela, Antracit i Orah su dugmad. Ranije sačuvana druga boja ostaje dostupan izbor. Profil, staklo i okov ostaju obična polja. Dodatna oprema, Montaža, Napomena i Fotografije otvaraju se po potrebi, a Raspored krila čuva pristup pojedinačnim širinama. Gotovo i zatvaranje panela čuvaju postojeći način rada sa nacrtom. Na tabletu i desktopu panel je centriran, a bočna navigacija ostaje dostupna.

Gornji hamburger je uklonjen. Osnovni crtež ima reset i proširenje; kontrole uvećanja su u proširenom prikazu. Obračun, skladištenje i PDF servis nisu menjani.

## Nacrtaj po meri

Nova opcija **Nacrtaj** dostupna je u katalogu i izboru novog elementa. Modul je deo postojećeg posla, sa istim lokalnim skladištem, dupliranjem i brisanjem. Geometrija se čuva u opcionom `Position.customGeometry` modelu, verzija 1; stare pozicije i kopije ostaju kompatibilne.

- Linija: povući od početka do kraja. Sledeći potez nastavlja poslednji čvor; bliski krajevi se spajaju. Stvarne koordinate zadržavaju preciznost; sve prikazane mere i polja za dimenzije koriste cele milimetre bez decimalnih i hiljadarskih separatora.
- Luk: povući između krajeva, pa dodirnuti ili povući treću, kontrolnu tačku. Žuti čvor uređuje zakrivljenost. Centar, radijus i dužina se računaju analitički.
- Izaberi / Pomeri: dodir linije otvara meru; čvor ili izabrana stranica mogu da se povuku. Pri izmeni dužine bira se fiksni kraj, a drugi kraj i vezani segmenti se ažuriraju. Nevalidna promena se odbija uz poruku.
- Početni oblici: trougao, trapez, polukružni prozor, krug i petougao. Širina i visina se primenjuju na izabrani početni oblik; za krug se koristi prečnik, a pravi polukružni vrh ima R = širina / 2. Posle slobodne izmene oblik prelazi u slobodnu konturu.
- Završi oblik spaja poslednji i prvi čvor, uz proveru samopresecanja, preklapanja i validnosti lukova. Otvoren ili nevalidan oblik ne može da se doda u posao.
- Dodaj prečku povezuje dve tačke na konturi ili postojećim prečkama. Podržane su prave unutrašnje prečke. Ako izmena konture odvoji prečku, promena se odbija; prečku prvo ukloniti.
- Undo / Redo pokrivaju izmene; zoom, pan i dva prsta menjaju samo pogled. Na telefonu postoji poseban fullscreen režim. U običnom režimu ostaje globalna navigacija.
- Fiksno zastakljenje je jedina podržana izvedba nepravilnog elementa u ovom modulu. Prečke su terenska skica, bez pretpostavke o proizvodnom rešenju ili standardnom okovu.

Nepravilni elementi ne koriste standardnu kalkulaciju površine, profila i okova. Bez ručne cene prikazuje se **Cena zahteva proveru u kancelariji**; zbir posla i oba PDF-a označavaju nepotpun zbir poznatih stavki. Nula je dozvoljena samo kada je ručno uneta. Ručna cena važi po komadu. Kancelarijska specifikacija sadrži koordinate, dužine, centre i radijuse lukova, prečke, napomenu i fotografije, sa oznakom **Terenska skica — potrebna tehnička provera**.

Izvori: `src/custom/geometry.ts`, `CustomDrawing.tsx`, `CustomEditor.tsx`, `custom.css`. Testovi: `src/custom/geometry.test.ts` i `tests/custom.spec.ts`. Uzorci dokumenata: `output/pdf/custom-ponuda.pdf` i `output/pdf/custom-specifikacija.pdf`.

### Dorada alata i zaključavanje mera

Svih osam osnovnih alata prikazano je u dva reda, bez horizontalnog skrolovanja. Oznaka dimenzije i linija otvaraju isti editor; ukupna širina i visina su u posebnoj info zoni ispod platna. Oznake izbegavaju jedna drugu i dodirne čvorove, uz tanke pomoćne linije kada je potrebno.

U editoru mere dugme Zaključaj meru čuva tačnu dužinu, a za luk i radijus. Zaključane linije imaju katanac i plavu isprekidanu oznaku. Izmena susednih stranica i čvorova rešava povezane dužine uz izabrani fiksni kraj; kada ograničenja ne mogu da se ispune, izmena se odbija bez promene nacrta. Lock stanje se čuva uz geometriju i učestvuje u Undo/Redo. Zaključanu liniju treba otključati pre direktne izmene ili brisanja; promena početnog oblika traži otključavanje. Obriši sve namerno započinje novu konturu.

Žuta kontrola je u sredini luka. Pomeranjem ka tetivi ili od nje menja zakrivljenost, uz živi prikaz radijusa. Tangencijalno klizanje duž postojećeg luka ne pomera kontrolu. Kada je luk zaključan, kontrola je skrivena.
