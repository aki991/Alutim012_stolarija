type GuideBlock =
 | { heading?: string; text: string }
 | { heading?: string; items: readonly string[]; ordered?: boolean };

type GuideChapter = {
 id: string;
 title: string;
 blocks: readonly GuideBlock[];
};

export const guideTitle = 'Uputstvo za terenski rad';
export const guideIntro = 'Vodič kroz aplikaciju ALU TIM 012 Stolarija za majstore, šefove i administratore.';

export const guideChapters: readonly GuideChapter[] = [
 {
  id: 'pocetak', title: 'Prvi ulazak i brz početak',
  blocks: [
   { text: 'Otvorite aplikaciju dok imate internet. Prijavite se e-mail adresom ili korisničkim imenom i lozinkom koju ste dobili za svoj nalog. Ako ste već prijavljeni, aplikacija otvara sačuvanu sesiju kada može da je obnovi.' },
   { heading: 'Instalacija na telefon', text: 'Na Androidu otvorite meni pregledača i izaberite Instaliraj aplikaciju ili Dodaj na početni ekran. Na iPhone-u ili iPad-u otvorite aplikaciju u Safariju, dodirnite Deli i izaberite Dodaj na početni ekran. Posle instalacije pokrenite aplikaciju preko ikonice. Kada se pojavi dugme Ažuriraj, njime učitavate novu verziju.' },
   { heading: 'Od novog posla do ponude', ordered: true, items: [
    'Na početnoj strani izaberite Novi posao, unesite naziv posla ili prezime kupca i pritisnite Započni merenje.',
    'Izaberite vrstu elementa ili model iz kataloga. Unesite mere u milimetrima i proverite crtež, otvaranje i dodatne opcije.',
    'Pritisnite Dodaj u posao. Za sledeći prozor ili vrata na poslu izaberite Dodaj element.',
    'Sačuvajte podatke o kupcu, pregledajte izmerene pozicije i otvorite Pogledaj cenu i podeli dokument.',
   ] },
   { text: 'Na telefonu su Početna, Poslovi i Katalog u donjoj traci. Više otvara dodatne stavke, uključujući Podešavanja i Nalog. Na većem ekranu koristite bočnu navigaciju. Nastavi merenje vraća vas na zapamćeni posao ili nacrt.' },
  ],
 },
 {
  id: 'poslovi', title: 'Poslovi, kupci i statusi',
  blocks: [
   { text: 'U Poslovima pretražujte po kupcu, adresi ili broju posla. Filter statusa sužava spisak. Otvorite karticu da vidite izmerene pozicije, količine, datum i trenutni status. Ponude prikazuju poslove sa statusom Poslati ponudu ili Ponuda.' },
   { heading: 'Podaci o kupcu i pozicije', items: [
    'U poslu otvorite Podaci o kupcu. Dodajte telefon, e-mail, adresu i napomene. U Dodatnim podacima su datum merenja, majstor i tip objekta. Potvrdite dugmetom Sačuvaj podatke.',
    'Olovka uz poziciju otvara izmenu. Meni sa tri tačke nudi dupliranje, promenu redosleda i brisanje, u skladu sa pravima naloga.',
    'Meni na kartici posla nudi dupliranje i brisanje prema pravima naloga. Posao se prvo premešta u Korpu.',
   ] },
   { heading: 'Kako se koristi status', items: [
    'Merenje označava posao koji se priprema ili meri. Za dodeljeno merenje zadužena osoba koristi dugme Merenje završeno.',
    'Poslati ponudu znači da su mere spremne za ponudu. Kada je ponuda pripremljena ili poslata, upišite status Ponuda.',
    'Prihvaćeno i Odbijeno beleže odgovor kupca. U izradi označava posao koji je prešao u realizaciju. Završeno koristite kad je posao gotov.',
    'Završeni i odbijeni poslovi i dalje su dostupni kroz odgovarajući filter u Poslovima.',
   ] },
  ],
 },
 {
  id: 'tim', title: 'Dodela merenja i timski rad',
  blocks: [
   { heading: 'Dodela za šefa i administratora', ordered: true, items: [
    'Otvorite Dodeli merenje, izaberite zaduženog majstora ili drugog šefa i unesite kupca, adresu i uputstvo za teren.',
    'Za datum izaberite danas ili budući dan. Ako želite uži pristup, uključite Prikaži posao samo zaduženoj osobi i šefovima.',
    'Pritisnite Dodeli i pošalji. Zadužena osoba dobija obaveštenje, a uputstvo joj je dostupno u razgovoru o poslu.',
    'Za promenu zadužene osobe ili pristupa otvorite posao i izaberite Dodela i vidljivost. Za novi termin sa istom osobom uredite Datum merenja u Dodatnim podacima posla.',
   ] },
   { heading: 'Od dodele do predaje mera', items: [
    'Otvorite dodelu iz Obaveštenja ili pronađite posao kroz Poslovi → Merenje. U pregledu posla piše kog dana treba uraditi merenje.',
    'Ako merenje ostane nezavršeno, pojavljuje se u rasporedu za naredni dan, po vremenu u Srbiji. Na primer, nezavršeno merenje od 17.11. se 18.11. računa u merenja danas. Prenos se ponavlja dok se merenje ne završi ili se ručno upiše drugi termin.',
    'Sačuvajte izmerene elemente pa izaberite Merenje završeno. Rok završetka unosi se kasnije, kada je posao u statusu Ponuda. Upisuje se stvarni datum merenja. Posao prelazi u Poslati ponudu. Kod prenetog merenja upisuje se datum dana završetka.',
    'Dok traje merenje, zadužena osoba radi na merama. Ostali sa pravom pregleda vide podatke prema podešenoj vidljivosti i dobijaju pristup izmerenim elementima nakon predaje.',
   ] },
   { text: 'Šef u Podešavanjima bira Prikaži cene majstorima. Isključivanje skriva cene majstorima u timu, bez promene šefovog prikaza. Majstori tada ne mogu svojim podešavanjem uključiti cene. Cene i PDV i dalje menja samo šef.' },
   { heading: 'Poruke i obaveštenja', text: 'Otvorite Poruke o poslu kada tražite uputstvo ili šaljete dopunu. Za obaveštenja dok je aplikacija zatvorena otvorite Nalog → Obaveštenja na uređaju → Uključi na ovom uređaju i dozvolite obaveštenja. Podešavanje važi za svaki uređaj posebno. Na iPhone-u ili iPad-u pokrenite instaliranu aplikaciju preko ikonice. Odjava isključuje obaveštenja na tom uređaju.' },
  ],
 },
 {
  id: 'elementi', title: 'Merenje prozora i vrata',
  blocks: [
   { heading: 'Osnovni element', ordered: true, items: [
    'U poslu izaberite Dodaj element, zatim Prozor, Vrata, Balkonska vrata, Klizni sistem ili Fiksni element, prema situaciji na terenu.',
    'Unesite ukupnu širinu i visinu u milimetrima. Ako postoji kutija roletne, pratite oznaku da li se unosi visina rama ili celog otvora.',
    'Izaberite broj krila i otvaranje. Dodirnite pojedinačno krilo na crtežu za zasebno podešavanje. U Dodatnim opcijama, kroz Raspored krila, proverite širine polja.',
    'Proverite crtež iznutra i smer otvaranja. Za detalje koristite Proširi prikaz. Pre potvrde proverite oznake, zbir širina i količinu.',
   ] },
   { heading: 'Katalog i fiksna polja', items: [
    'Iz posla otvorite Dodaj element → Pretraži sve modele. Pretražujte naziv ili grupu, izaberite model i unesite mere. Katalog možete otvoriti i iz glavne navigacije.',
    'Kod modela sa više redova ili polja podesite njihove visine, širine, ispune i otvaranja. Kod osnovnih elemenata koristite fiksna polja za nadsvetlo i bočne delove.',
    'Materijal i dodatnu opremu (roletnu, komarnik i klupicu) izaberite na glavnom ekranu. U Dodatnim opcijama podesite naziv, količinu, profil, boju, staklo i okov. Tamo se dodaju montaža, demontaža, pristup objektu, dodatni radovi, napomene i do četiri fotografije po elementu.',
   ] },
   { text: 'Na stranici Poslovi možete istovremeno uključiti više statusa, na primer U izradi i Ponuda. Svi poništava izbor. U cenovniku koristite Pretraži cenovnik za traženje stavki i grupa.' },
   { text: 'Na listi i u poslu vide se tvorac posla, pošiljalac zahteva i osoba zadužena za merenje. Postojeću dodelu može da promeni samo šef koji je poslao zahtev; drugi šef ili majstor ne može da preuzme merenje. Majstor može da unese ukupnu cenu montaže i puta za šefa i kada mu je prikaz cena stolarije isključen.' },
   { text: 'Na listi poslova piše kome je dodeljeno merenje. U Evidenciji posla vide se datumi merenja, završetka i ugradnje. Rok završetka bira se u statusu Ponuda; bez izabranog roka nije moguće promeniti taj status. Kada je posao ugrađen, zaduženi radnik ili šef bira Ugrađeno; datum se beleži automatski. Za stare poslove bez zabeleženog datuma prikazuje se Nije zabeleženo.' },
   { text: 'Gotovo zatvara dodatne opcije. Dodaj u posao potvrđuje novu poziciju, a Sačuvaj izmene potvrđuje postojeću. Nacrt omogućava nastavak rada. Potvrđene pozicije su vidljive u spisku i ulaze u dokument. Mere sa terena i izvodljivost konfiguracije proverava kancelarija.' },
  ],
 },
 {
  id: 'posebne-pozicije', title: 'Kombinacije, roletne i sobna vrata',
  blocks: [
   { heading: 'Vrata sa prozorom', text: 'Izaberite Kombinacija. Za vrata i za prozor izaberite jedno ili dva krila, pa unesite odvojene mere i otvaranja; kod dvokrilnog dela unesite i širinu svakog krila. Odredite da li je prozor levo ili desno i izaberite poravnanje. U poslu se vodi kao jedna pozicija, sa posebnim merama i okovom za svaki deo.' },
   { heading: 'Glavno krilo dvokrilnih vrata', text: 'Kod dvokrilnih vrata, samostalnih ili u kombinaciji, izaberite koje je krilo glavno: Levo ili Desno. Ako ne izaberete nijedno (Oba), oba krila su glavna. Ručka na skici označava glavno krilo, a izbor se vidi i u ponudi i specifikaciji.' },
   { heading: 'Mere na kotama vrata', text: 'Kliknite ili dodirnite kotu na crtežu vrata. Otvara se prozor sa trenutnom merom i pregledom koji prati unos. Primeni meru potvrđuje promenu, a Otkaži zadržava prethodnu meru. Kote određuju ukupne mere, širine krila i polja, nadsvetlo, bočna fiksna polja i visine stakla i parapeta. Kod modela sa parapetom promena njegove visine menja preostalu visinu stakla u istom polju. Mere polja prate granice polja na terenskoj skici; kancelarija potvrđuje proizvodne mere.' },
   { heading: 'Donji deo vrata', text: 'Na glavnom ekranu vrata izaberite ALU prag 24 mm, Ram u krug ili Bez praga. Opcija Bez praga uklanja prag i donji profil rama, dok ram ostaje gore i sa strane. Uneta ukupna visina vrata uključuje prag: za visinu 2100 mm prag ostaje unutar tih 2100 mm. Kod kombinacije prag pripada samo delu vrata. Izbor se čuva uz element i vidi na skici, u ponudi i specifikaciji.' },
   { heading: 'Roletna, komarnik i klupica', items: [
    'Roletnu dodajte kao poseban element ili kao dodatak prozoru. Izaberite tip i unesite mere prema mestu ugradnje. Kada je kutija u otvoru, proverite ukupnu visinu otvora i preostalu visinu rama.',
    'Za kutiju roletne izaberite PVC ili ALU, a za vodilicu Ravna vodilica ili Vodilica sa dodatkom. Poluobla kutija ima izbore Poluobla rondo i Poluobla eko. Izaberite pogon bez motora sa kanapom ili trakom i levu ili desnu stranu (gledano iznutra), ili pogon sa motorom pa sa daljinskim ili bez daljinskog upravljača. Kod motorne roletne izaberite i levu ili desnu stranu motora, gledano iznutra. Izbori se čuvaju uz poziciju i navode u dokumentima.',
    'Kod kombinacije unesite roletnu na deo na koji se ugrađuje. Komarnik možete dodati kao poseban element ili kroz dodatnu opremu. Klupicu i okapnicu uključite u dodatnoj opremi pozicije. Komarnik počinje sa širinom elementa manjom za 50 mm i visinom manjom za 10 mm. Mere komarnika, dužinu i dubinu klupice i okapnice možete menjati zasebno. Vrati automatske mere uklanja ručne izmene. Motor za komarnik uključite po potrebi; šef u cenovniku unosi zasebnu cenu po komadu.',
    'Za jednu stvarnu roletnu ili komarnik koristite jedan način unosa, da se u ponudi obračuna jednom.',
   ] },
   { heading: 'Sobna vrata Porta Royal', text: 'Otvorite Sobna vrata iz kataloga ili pri dodavanju elementa. Odaberite seriju, dekor i tip. Upišite mere otvora, debljinu zida i raspoložive opcije kao što su smer, ispuna, ostakljenje i oprema. Sačuvajte vrata u poslu. Cena se određuje prema podešenoj seriji. Za seriju bez cene aplikacija označava da je potrebna provera ili ručni unos.' },
  ],
 },
 {
  id: 'crtanje', title: 'Crtanje nepravilnih elemenata',
  blocks: [
   { heading: 'Od konture do pozicije', ordered: true, items: [
    'Izaberite Nacrtaj. Počnite od gotovog oblika, kao što su pravougaonik, trougao, trapez, polukrug ili krug, ili slobodno nacrtajte konturu.',
    'Unesite ukupne mere i primenite ih na oblik. Za krug se koristi prečnik. U slobodnom crtežu liniju povucite od početne do krajnje tačke. Luk dobija oblik kada posle krajeva odredite i kontrolnu tačku.',
    'Zatvorite konturu alatom Završi oblik. Ako aplikacija prijavi nepovezane ili presečene stranice, korigujte skicu pa ponovo zatvorite oblik.',
    'Dodajte prečke gde postoje. Za pokretno polje otvorite Označi otvaranje, dodirnite polje i podesite stranu šarki i kip prema potrebi.',
    'Podesite namenu, širinu rama, materijal, profil i ispunu. Proverite ukupne dimenzije i izaberite Dodaj u posao.',
   ] },
   { heading: 'Ispravke i preciznost', items: [
    'Izaberi / Pomeri služi za izbor stranice i pomeranje čvorova. Dodir stranice ili oznake mere otvara unos dužine, a kod luka i radijusa.',
    'Za pravu liniju dostupno je vodoravno ili uspravno poravnanje. Pri izmeni izaberite kraj koji ostaje fiksan. Zaključajte meru kada želite da se zadrži pri pomeranju okoline. Dugmad Zaključaj vodoravno i Zaključaj uspravno poravnavaju stranicu i zadržavaju je na istoj vodoravnoj ili uspravnoj liniji. Pravac i meru zaključavate i otključavate zasebno. Kada su zaključani i mera i pravac, cela stranica ostaje na mestu.',
    'Vratite potez komandom Undo ili ga ponovite komandom Redo. Uvećanje, pomeranje platna i opcija Uklopi ceo nacrt služe za pregled. Kontura predstavlja spoljašnju ivicu rama.',
   ] },
  ],
 },
 {
  id: 'cene', title: 'Cenovnik, obračun i korekcije',
  blocks: [
   { heading: 'Šta aplikacija računa', items: [
    'Ram, krilo i prečke računaju se po dužnom metru. U Cenovniku se podešavaju stope za PVC i ALU profile. Kod zakrivljenih profila dodatno se obračunava savijanje, prema dužini luka.',
    'Staklo se računa po kvadratnom metru. Kod okruglog ili nepravilnog prozora koristi se širina puta visina pravougaonog komada iz kog se staklo seče. Za prečnik 2.400 mm površina za obračun je 2,40 × 2,40 = 5,76 m².',
    'Okov se obračunava po pokretnom krilu. Standardni i sigurnosni okov imaju zasebne cene za prozore i vrata. Kod kombinacije vrata sa prozorom primenjuje se odgovarajuća cena za svaki deo.',
    'Na iznos utiču ispuna, boja, dodaci, posebni mehanizmi i radovi. Demontaža se računa po obimu. Ukupnu cenu montaže i puta unesite u poslu tokom merenja. Ti troškovi se raspoređuju po komadu i uključuju u jedinične cene elemenata, bez zasebnih stavki u ponudi. Uneta ukupna montaža zamenjuje automatsku montažu po obimu. Količina množi jedinični iznos.',
   ] },
   { heading: 'Od okvirne do ponuđene cene', items: [
    'U Podešavanjima → Cenovnik, šef ili administrator podešava stope, dodatke i maržu. Početne stope su demonstracione. U timskom režimu pritisnite Sačuvaj cenovnik da izmena važi za tim.',
    'U Korekciji cene ovlašćeni korisnik može da promeni paket, ručnu cenu po komadu, popust, uvećanje, uključene troškove montaže i puta, zajedničke radove i konačni iznos. Prazna ručna cena ili dugme Auto vraća obračun prema cenovniku.',
    'U Podešavanjima → PDV i obračun izaberite da li su cene bez PDV-a, sa uračunatim PDV-om ili se PDV ne obračunava. Na pojedinačnom poslu proverite izabrani režim pre slanja.',
    'Na naslovnoj strani Podešavanja prekidač Prikaži cene uključuje ili skriva iznose u pregledu i pri izradi dokumenata.',
   ] },
  ],
 },
 {
  id: 'dokumenti', title: 'Ponuda, specifikacija i deljenje',
  blocks: [
   { ordered: true, items: [
    'Sačuvajte bar jednu ispravnu poziciju. U poslu otvorite Pogledaj cenu i podeli dokument. Ako ste isključili cene, izaberite Pregledaj i podeli dokument.',
    'Izaberite Ponuda za kupca ili Specifikacija za kancelariju. U prozoru se prikazuje pregled PDF-a. Pritisnite Preuzmi PDF da ga sačuvate na uređaju.',
    'Za slanje izaberite Podeli, vrstu dokumenta i aplikaciju iz sistemskog menija, na primer Viber ili WhatsApp. Uređaj može ponuditi i preuzimanje fajla.',
   ] },
   { items: [
    'Ponuda za kupca sadrži pozicije, količine, mere i uslove ponude, sa iznosima ako je prikaz cena uključen. Specifikacija za kancelariju daje detaljnije mere, crteže, otvaranja, radove, napomene, fotografije i obračun kada je uključen.',
    'Pošalji u app šalje kancelarijsku specifikaciju u bazu i traži internet. Sačekajte potvrdu Sačuvano. Samo preuzimanje PDF-a čuva fajl na uređaju.',
    'Za timske poslove ranije generisani dokumenti mogu se otvoriti kroz Sačuvani dokumenti, u skladu sa pristupom poslu i izabranim prikazom cena. Za arhivu je potrebna veza sa bazom.',
   ] },
  ],
 },
 {
  id: 'offline', title: 'Rad bez interneta i prenos u tim',
  blocks: [
   { heading: 'Pre odlaska na teren', text: 'Otvorite objavljenu aplikaciju bar jednom dok imate internet i sačekajte da se učita. Koristite isti pregledač, adresu i uređaj na terenu, jer se tamo čuvaju aplikacija i lokalni poslovi. U režimu Radi bez interneta možete da merite i preuzmete PDF za lokalni posao.' },
   { heading: 'Merenje bez veze', ordered: true, items: [
    'Na ekranu za prijavu izaberite Radi bez interneta. Otvorite lokalni posao ili pokrenite Novi posao.',
    'Unesite mere i pritisnite Dodaj u posao ili Sačuvaj izmene. Novi posao ima status Merenje. Sačuvane pozicije i fotografije dostupne su na tom uređaju.',
    'Ako se pojavi greška lokalnog upisa, sačuvajte nacrt i ponovite upis kada oslobodite prostor. Uspešno čuvanje proverite u pregledu posla.',
   ] },
   { heading: 'Kada se internet vrati', ordered: true, items: [
    'Pri sledećem ulasku aplikacija pokušava da obnovi poslednju sesiju. Ako sesija nije dostupna, prijavite se.',
    'U Poslovima pronađite lokalno merenje označeno sa Na telefonu. Pritisnite Dodaj u bazu kad želite da ga predate timu. Prenos traži internet i najmanje jednu sačuvanu poziciju.',
    'Posao se pojavljuje u timu sa statusom Poslati ponudu. Dugme Otvori u timu vodi do prenete verzije. Lokalna kopija ostaje na uređaju.',
   ] },
  ],
 },
 {
  id: 'podesavanja', title: 'Podešavanja, nalozi i rezervne kopije',
  blocks: [
   { heading: 'Lična i zajednička podešavanja', items: [
    'Profili i materijali određuju početni materijal, profil, boju, staklo i okov za nove elemente. Dokumenti određuju početne uslove važenja, isporuke i plaćanja za nove poslove.',
    'Prekidačem Prikaži cene birate da li radite sa prikazanim iznosima. Cenovnik i PDV menjaju ovlašćeni nalozi. U timskom radu sačuvane stope važe za ceo tim.',
    'Otvorite Nalog → Promeni lozinku. Unesite trenutnu lozinku i dva puta novu, pa pritisnite Sačuvaj lozinku. Ovo je dostupno majstoru, šefu i administratoru dok su prijavljeni i imaju internet. Ako isti nalog koristite u Ogradama, nova lozinka važi i tamo.',
   ] },
   { heading: 'Upravljanje korisnicima', text: 'Šef i administrator otvaraju Podešavanja → Korisnici. Izaberite Dodaj korisnika za novi nalog ili Postojeći nalog za dodelu pristupa već napravljenom nalogu. Uredi otvara podatke profila za koje imate pravo izmene. Šef može urediti ime i korisničko ime naloga koji koristi prijavu bez stvarne e-mail adrese, a administrator može urediti i stvarnu e-mail adresu. Brisanje zajedničkog naloga ukida pristup Stolariji i Ogradama.' },
   { heading: 'Lokalna kopija i korpa', items: [
    'U lokalnom režimu otvorite Podešavanja → Podaci i rezervne kopije → Izvezi rezervnu kopiju. JSON kopija sadrži sačuvane poslove, fotografije, korpu i podešavanja. Nacrti koji još nisu dodati u posao čuvaju se odvojeno.',
    'Za oporavak izaberite Uvezi kopiju, pronađite JSON fajl i potvrdite zamenu lokalnih podataka. Pre zamene možete izvesti postojeće stanje.',
    'U Korpi izaberite Vrati posao za povratak u spisak. Šef ili administrator sa pravom upravljanja zajedničkim poslovima vidi i timsku korpu. Komanda Trajno obriši uklanja izabrane poslove iz korpe.',
   ] },
  ],
 },
 {
  id: 'podesavanje-na-terenu', title: 'Najčešće situacije na terenu',
  blocks: [
   { items: [
    'Dugme Dodaj u posao nije dostupno. Proverite da li su mere u rasponu, da li zbir širina odgovara elementu i da li je nacrtana kontura zatvorena.',
    'Posao je ostao na telefonu. Posle prijave otvorite Poslove, pronađite oznaku Na telefonu i izaberite Dodaj u bazu. Za timski prenos proverite vezu i sačuvane pozicije.',
    'Cene se ne vide. Proverite Prikaži cene u Podešavanjima i prava naloga. U timskom radu sačekajte da se zajednički cenovnik učita.',
    'PDF se ne priprema. Proverite da posao ima sačuvane elemente sa ispravnim merama. Za lokalno preuzimanje bez veze aplikacija prethodno mora da bude učitana na istom uređaju.',
    'Drugi tab već je izmenio isti lokalni posao ili nema dovoljno prostora za čuvanje. Pročitajte poruku o grešci i izvezite rezervnu kopiju pre ponovnog učitavanja ako treba sačuvati trenutne izmene.',
   ] },
  ],
 },
];
