import { test, expect, type Page } from '@playwright/test';
import type { TeamAccount, TeamJob, TeamMember, TeamMessage, TeamNotification, TeamPreferencesRow, TeamPricingRow } from '../src/services/team-api';
import type { Job } from '../src/models';

test('Šef dodeljuje merenje, a majstor vraća mere, poruku i statuse', async ({ browser, page }) => {
 test.setTimeout(110000);
 const boss = { id: '10000000-0000-4000-8000-000000000001', name: 'Šef', role: 'manager', active: true } as const;
 const worker = { id: '10000000-0000-4000-8000-000000000002', name: 'Miloš', role: 'worker', active: true } as const;
 const observer = { id: '10000000-0000-4000-8000-000000000003', name: 'Ivan', role: 'worker', active: true } as const;
 const people = [boss, worker, observer];
 const accounts: TeamAccount[] = [{...boss,email:'manager@example.test'},{...worker,email:'milos@alutim012.local'},{...observer,email:'ivan@alutim012.local'}];
 let pricing: TeamPricingRow = {prices:{},porta_royal_prices:{},vat:20,vat_mode:'exclusive',revision:0};
 const preferences = new Map<string,TeamPreferencesRow>();
 const archived = new Map<string, {pdf:Buffer; createdAt:string}>();
 const jobs = new Map<string, TeamJob>();
 const inbox = new Map<string, TeamNotification[]>();
 const messages: TeamMessage[] = [];
 const reads = new Map<string, string>();
 const now = () => new Date().toISOString();

 function notify(recipient: TeamMember, actor: TeamMember, row: TeamJob, kind: TeamNotification['kind'], body: string) {
  inbox.set(recipient.id, [{ id: crypto.randomUUID(), job_id: row.id, kind, actor_name: actor.name, job_name: row.data.customer.name, body, read_at: null, created_at: now() }, ...(inbox.get(recipient.id) ?? [])]);
 }

 // Supabase responses are intercepted. The browser still uses the real Auth and REST clients.
 async function mockSupabase(target: Page, member: TeamMember) {
  await target.route(/\/(auth|rest|functions|storage)\/v1\//, async route => {
   const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.split('/').pop();
   const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
   const reply = (json: unknown) => route.fulfill({ headers, json });
   const replyRow = (row: TeamJob) => reply(request.headers().accept?.includes('vnd.pgrst.object') ? row : [row]);
   if (request.method() === 'OPTIONS') return route.fulfill({ headers, status: 204 });
   if(url.pathname.startsWith('/storage/v1/')){
    if(url.pathname.startsWith('/storage/v1/object/list/')){
     const {prefix,limit,offset}=request.postDataJSON();
     const files=[...archived.entries()].filter(([path])=>path.startsWith(prefix+'/'));
     return reply(files.slice(offset,offset+limit).map(([path,file])=>({id:path,name:path.split('/').at(-1),created_at:file.createdAt})));
    }
    const path=url.pathname.split('/alutim-job-documents/').at(-1)!;
    const existing=archived.get(path);
    if(request.method()==='HEAD')return route.fulfill({headers,status:existing?200:404});
    if(request.method()==='POST'){
     expect(path).toMatch(new RegExp('^stolarija/AT-[^/]+/kupac/'+member.id+'_cene_[a-f0-9]{64}\\.pdf$'));
     expect(request.headers()['x-upsert']).toBe('false');
     if(existing)return route.fulfill({headers,status:400,json:{message:'The resource already exists'}});
     const multipart=await new Response(new Uint8Array(request.postDataBuffer()!),{headers:{'content-type':request.headers()['content-type']}}).formData();
     const pdf=Buffer.from(await (multipart.get('') as File).arrayBuffer());
     expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
     archived.set(path,{pdf,createdAt:now()});
     return reply({Id:crypto.randomUUID(),Key:path});
    }
    return route.fulfill({headers,status:existing?200:404,contentType:'application/pdf',body:existing?.pdf});
   }
   if (endpoint === 'token') {
    const { email, password } = request.postDataJSON();
    expect(email).toBe(accounts.find(account=>account.id===member.id)?.email);
    if (password !== 'test-password') return route.fulfill({ status: 400, headers, json: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: member.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
    return reply({ access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user: { id: member.id, email, aud: 'authenticated' } });
   }
   if (endpoint === 'logout') return route.fulfill({ headers, status: 204 });
   const body = request.postDataJSON() ?? {};
   const participates = (row:TeamJob) => member.role==='manager'||row.assigned_to===member.id;
   const visible = [...jobs.values()].filter(row => participates(row)||!row.assignee_only);
   const view = (row:TeamJob) => row.assigned_to && row.data.status==='Merenje' &&
    (member.role==='manager'||row.assigned_to!==member.id)?{...row,data:{...row.data,positions:[]}}:row;
   switch (endpoint) {
    case 'field_team_members': return reply(url.searchParams.has('id') ? [member] : people.filter(person => person.role === 'worker'));
    case 'field_team_pricing': return reply(pricing);
    case 'field_team_preferences': return reply(preferences.has(member.id)?[preferences.get(member.id)]:[]);
    case 'field_team_save_preferences': {
     const previous=preferences.get(member.id);
     const next={data:{...previous?.data,...body.p_patch},revision:(previous?.revision??0)+1};
     preferences.set(member.id,next);
     return reply(next);
    }
    case 'field_team_save_pricing': {
     expect(member.role).toBe('manager');
     expect(body.p_revision).toBe(pricing.revision);
     pricing={prices:body.p_prices,porta_royal_prices:body.p_porta_royal_prices,vat:body.p_vat,vat_mode:body.p_vat_mode,revision:pricing.revision+1};
     return reply(pricing);
    }
    case 'field_team_list_accounts': {
     expect(member.role).toBe('manager');
     return reply(accounts);
    }
    case 'field-team-accounts': {
     expect(member.role).toBe('manager');
     expect(request.headers().authorization).toMatch(/^Bearer /);
     if(body.action==='create'){
      expect(body).toEqual({action:'create',identifier:'petar',name:'Petar Petrović',password:'proba-1234'});
      accounts.push({id:crypto.randomUUID(),name:body.name,role:'worker',active:true,email:'petar@alutim012.local'});
     }else if(body.action==='link'){
      expect(body).toEqual({action:'link',identifier:'jelena'});
      accounts.push({id:crypto.randomUUID(),name:'Jelena Ograde',role:'worker',active:true,email:'jelena@alutim012.local'});
     }else{
      const index=accounts.findIndex(account=>account.id===body.id&&account.name==='Petar Petrović');
      expect(index).toBeGreaterThan(-1);
      accounts.splice(index,1);
     }
     return reply({ok:true});
    }
    case 'field_team_visible_jobs': return reply(visible.map(view));
    case 'field_team_messages': return reply(messages.filter(message => `eq.${message.job_id}` === url.searchParams.get('job_id')).reverse());
    case 'field_team_notifications': return reply(inbox.get(member.id) ?? []);
    case 'field_team_message_inbox': return reply(visible.filter(participates).flatMap(job => {
     const last = messages.findLast(message => message.job_id === job.id);
     return last ? [{ ...last, job_name: job.data.customer.name, unread: last.sender_id !== member.id && reads.get(`${member.id}/${job.id}`) !== last.id }] : [];
    }));
    case 'field_team_read_messages': {
     reads.set(`${member.id}/${body.p_job_id}`, body.p_message_id);
     return reply(null);
    }
    case 'field_team_create_job': {
     const data: Job = body.p_job;
     expect(body.p_assignee).toBe(worker.id);
     expect(data.status).toBe('Merenje');
     const privateJob=data.customer.name==='Privatno merenje';
     if(!privateJob)expect(data.customer).toMatchObject({ name: 'Porodica Test', address: 'Glavna 12', phone: '064111222' });
     expect(body.p_assignee_only).toBe(privateJob);
     const row:TeamJob = { id: data.id, data, assigned_to: body.p_assignee, assigned_by: member.id, revision: 1, assignee_only: body.p_assignee_only };
     jobs.set(row.id, row);
     messages.push({ id: crypto.randomUUID(), job_id: row.id, sender_id: member.id, sender_name: member.name, body: body.p_message, created_at: now() });
     notify(worker, member, row, 'assignment', body.p_message);
     return replyRow(view(row));
    }
    case 'field_team_assign': {
     const row=jobs.get(body.p_id)!;
     expect(member.id).toBe(boss.id);
     expect(body.p_assignee).toBe(row.assigned_to);
     expect(body.p_message).toBe('');
     row.assignee_only=body.p_assignee_only;
     row.revision++;
     return replyRow(view(row));
    }
    case 'field_team_update_job': {
     const row = jobs.get(body.p_id)!;
     row.data = { ...row.data, ...body.p_patch, updated: now() };
     row.revision++;
     if (body.p_patch.status) notify(member.role === 'worker' ? boss : worker, member, row, 'status', body.p_patch.status);
     return replyRow(view(row));
    }
    case 'field_team_send_message': {
     const row = jobs.get(body.p_id)!;
     messages.push({ id: body.p_message_id, job_id: row.id, sender_id: member.id, sender_name: member.name, body: body.p_body, created_at: now() });
     reads.set(`${member.id}/${row.id}`, body.p_message_id);
     return reply(null);
    }
    case 'field_team_read_notification': {
     const notification = inbox.get(member.id)?.find(item => item.id === body.p_id);
     if (notification) notification.read_at = now();
     return reply(null);
    }
    default: return route.abort();
   }
  });
 }

 async function login(target: Page, member: TeamMember) {
  await mockSupabase(target, member);
  await target.goto('/obavestenja');
  await expect(target).toHaveURL(/\/prijava$/);
  await expect(target.getByRole('heading', { name: 'Prijava', exact: true })).toBeVisible();
  await expect(target.getByRole('button', { name: 'Nastavi bez interneta (gost)' })).toHaveCount(0);
  const identifier = target.getByLabel('E-mail ili korisničko ime');
  const password = target.getByLabel('Lozinka', { exact: true });
  await identifier.fill(member.id === boss.id ? ' Manager@Example.test ' : member.id === worker.id ? ' MiLoS ' : ' ivan ');
  if (member.role === 'manager') {
   await password.fill('wrong-password');
   await target.getByRole('button', { name: 'Prijavi se' }).click();
   await expect(target.getByRole('alert')).toContainText('Proverite e-mail ili korisničko ime i lozinku');
   await expect(password).toHaveValue('');
  }
  await password.fill('test-password');
  await target.getByRole('button', { name: 'Prikaži lozinku' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await target.getByRole('button', { name: 'Sakrij lozinku' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await target.getByRole('button', { name: 'Prijavi se' }).click();
  await expect(target.getByRole('heading', { name: 'Obaveštenja', exact: true })).toBeVisible();
 }

 await login(page, boss);
 await page.goto('/podesavanja');
 await page.getByRole('link', {name:/Korisnici/}).click();
 await expect(page.getByText('Administrator · Vaš nalog')).toBeVisible();
 await expect(page.getByText('milos', {exact:true})).toBeVisible();
 await expect(page.getByRole('button', {name:'Obriši nalog za Šef'})).toHaveCount(0);
 await page.getByLabel('Korisničko ime ili e-mail').fill('petar');
 await page.getByLabel('Ime i prezime').fill('Petar Petrović');
 const newPassword=page.getByLabel('Lozinka',{exact:true});
 await newPassword.fill('proba-1234');
 await expect(newPassword).toHaveAttribute('type','password');
 await page.getByRole('button',{name:'Prikaži lozinku'}).click();
 await expect(newPassword).toHaveAttribute('type','text');
 await expect(newPassword).toHaveValue('proba-1234');
 await page.getByRole('button',{name:'Sakrij lozinku'}).click();
 await expect(newPassword).toHaveAttribute('type','password');
 await page.getByRole('button',{name:'Prikaži lozinku'}).click();
 await page.getByRole('button', {name:'Dodaj korisnika'}).click();
 await expect(page.getByText('petar', {exact:true})).toBeVisible();
 await expect(newPassword).toHaveValue('');
 await expect(newPassword).toHaveAttribute('type','password');
 await page.getByRole('button', {name:'Obriši nalog za Petar Petrović'}).click();
 await page.getByRole('dialog').getByRole('button', {name:'Obriši nalog',exact:true}).click();
 await expect(page.getByText('Nalog za Petar Petrović je obrisan.')).toBeVisible();
 await expect(page.getByText('petar', {exact:true})).toHaveCount(0);
 await page.getByRole('checkbox',{name:'Postojeći nalog'}).check();
 await expect(newPassword).toHaveCount(0);
 await page.getByLabel('Korisničko ime ili e-mail').fill('jelena');
 await page.getByRole('button',{name:'Dodeli pristup'}).click();
 await expect(page.getByText('Jelena Ograde',{exact:true})).toBeVisible();
 await page.goto('/podesavanja/dokumenti');
 const validity=page.getByLabel('Važenje ponude');
 await validity.fill('30 dana');
 await expect.poll(()=>preferences.get(boss.id)?.data.documentDefaults?.validity).toBe('30 dana');
 await page.reload();
 await expect(validity).toHaveValue('30 dana');
 await page.goto('/cenovnik');
 await page.getByRole('spinbutton', {name:'PVC profil (€/m²)',exact:true}).fill('126');
 await page.getByRole('button', {name:'Sačuvaj cenovnik'}).click();
 await expect(page.getByText('Cene su sačuvane za ceo tim.')).toBeVisible();
 await expect(page.getByLabel('Majstor', { exact: true })).toHaveCount(0);
 await page.getByRole('navigation', { name: 'Glavna navigacija' }).getByRole('link', { name: 'Dodeli merenje' }).click();
 await expect(page.getByRole('heading', { name: 'Dodeli merenje' })).toBeVisible();
 const visibilityLabel='Samo dodeljeni majstor vidi posao';
 await expect(page.getByRole('checkbox',{name:visibilityLabel})).not.toBeChecked();
 await page.getByRole('combobox', { name: 'Majstor', exact: true }).selectOption({ label: 'Miloš' });
 await page.getByLabel('Naziv firme ili ime kupca').fill('Porodica Test');
 await page.getByLabel('Adresa merenja').fill('Glavna 12');
 await page.getByLabel('Telefon').fill('064111222');
 await page.getByLabel('Poruka majstoru').fill('Izmeri prozore u prizemlju.');
 await page.getByRole('button', { name: 'Dodeli i pošalji' }).click();
 await expect(page.getByRole('heading', { name: 'Posao: Porodica Test' })).toBeVisible();
 const jobUrl = page.url();
 const statusName = 'Status posla: Porodica Test';
 const bossStatus = page.getByRole('combobox', { name: statusName });

 const workerContext = await browser.newContext({ baseURL: page.url(), viewport: { width: 390, height: 844 } });
 const observerContext = await browser.newContext({ baseURL: page.url() });
 try {
  const mobile = await workerContext.newPage();
  await login(mobile, worker);
  await expect(mobile.getByRole('heading', { name: 'Dodeli merenje' })).toHaveCount(0);
  const assignment = mobile.getByRole('listitem').filter({ hasText: 'Dodeljeno merenje' });
  await assignment.getByRole('button', { name: 'Označi kao pročitano' }).click();
  await expect(assignment.getByRole('button', { name: 'Označi kao pročitano' })).toHaveCount(0);
  await expect(mobile.getByRole('link', { name: 'Poruke (1 novih)' })).toBeVisible();
  await mobile.getByRole('link', { name: 'Poruke (1 novih)' }).click();
  await expect(mobile.getByRole('heading', { name: 'Poruke', exact: true })).toBeVisible();
  await expect(mobile.locator('.main-shell')).toHaveCSS('background-color','rgb(25, 26, 27)');
  await expect(mobile.getByRole('link', { name: 'Poruke (1 novih)' })).toBeVisible();
  await mobile.getByRole('link', { name: /^Obaveštenja/ }).click();
  await mobile.getByRole('link', { name: /Dodeljeno merenje.*Porodica Test/ }).click();
  await expect(mobile.getByText('Glavna 12')).toBeVisible();
  await expect(mobile.getByText('Izmeri prozore u prizemlju.')).toHaveCount(0);
  await mobile.getByRole('link', { name: 'Poruke o poslu' }).click();
  await expect(mobile.getByText('Izmeri prozore u prizemlju.')).toBeVisible();
  await expect(mobile.getByRole('link', { name: 'Poruke', exact: true })).toBeVisible();
  await mobile.getByRole('link', { name: 'Otvori posao' }).click();
  await mobile.getByRole('link', { name: 'Dodaj element' }).first().click();
  await mobile.getByRole('link', { name: 'Prozor', exact: true }).click();
  const fieldLinks = mobile.getByRole('navigation', { name: 'Poruke i obaveštenja' });
  await expect(fieldLinks.getByRole('link', { name: /^Obaveštenja/ })).toBeVisible();
  await expect(fieldLinks.getByRole('link', { name: /^Poruke/ })).toBeVisible();
  expect((await fieldLinks.boundingBox())!.x).toBeGreaterThan(250);
  await mobile.getByRole('button', { name: 'Dodaj u posao' }).click();
  await expect(mobile.getByRole('region', { name: 'Elementi posla' })).toBeVisible();
  await expect.poll(() => [...jobs.values()][0].data.positions.length).toBe(1);
  const readonlyPage=await observerContext.newPage();
  await login(readonlyPage,observer);
  await expect(readonlyPage.getByText('Nema obaveštenja.')).toBeVisible();
  await readonlyPage.goto('/poslovi');
  await readonlyPage.getByRole('link',{name:'Otvori Porodica Test'}).click();
  await expect(readonlyPage.getByRole('heading',{name:'Merenje je u toku'})).toBeVisible();
  await expect(readonlyPage.getByRole('button',{name:'Merenje završeno'})).toHaveCount(0);
  await expect(readonlyPage.getByRole('link',{name:'Poruke o poslu'})).toHaveCount(0);
  await page.goto(`${jobUrl}/ponuda`);
  await expect(page).toHaveURL(jobUrl);
  await expect(page.getByRole('heading', { name: 'Merenje je u toku' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Elementi posla' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Dodaj element' })).toHaveCount(0);
  await expect(bossStatus).toBeDisabled();
  await expect(mobile.getByRole('combobox', { name: statusName })).toBeDisabled();
  await mobile.getByRole('button', { name: 'Merenje završeno' }).click();
  await expect(mobile.getByRole('combobox', { name: statusName })).toHaveValue('Poslati ponudu');
  await expect(bossStatus).toHaveValue('Poslati ponudu', { timeout: 10000 });
  await expect(page.getByRole('region', { name: 'Elementi posla' })).toBeVisible();
  await expect(readonlyPage.getByRole('region',{name:'Elementi posla'})).toBeVisible({timeout:10000});
  await expect(readonlyPage.getByRole('combobox',{name:statusName})).toBeDisabled();
  await expect(readonlyPage.getByRole('link',{name:'Dodaj element'})).toHaveCount(0);
  await readonlyPage.goto(`${jobUrl}/dodaj`);
  await expect(readonlyPage).toHaveURL(jobUrl);

  await bossStatus.selectOption('Merenje');
  await expect(page.getByRole('heading', { name: 'Merenje je u toku' })).toBeVisible();
  await expect(mobile.getByRole('button', { name: 'Merenje završeno' })).toBeEnabled({ timeout: 10000 });
  await mobile.getByRole('link', { name: 'Izmeni element 1' }).click();
  await mobile.getByLabel('Širina (mm)').fill('1700');
  await mobile.getByRole('button', { name: 'Sačuvaj izmene' }).click();
  await expect(mobile.getByText(/1700 ×/)).toBeVisible();
  await expect(page.getByText(/1700 ×/)).toHaveCount(0);
  await mobile.getByRole('button', { name: 'Merenje završeno' }).click();
  await expect(page.getByText(/1700 ×/)).toBeVisible({ timeout: 10000 });

  await mobile.getByRole('link', { name: 'Poruke o poslu' }).click();
  await mobile.getByLabel('Poruka šefu').fill('Svi prozori izmereni.');
  await mobile.getByRole('button', { name: 'Pošalji poruku' }).click();
  await expect(mobile.getByText('Svi prozori izmereni.')).toBeVisible();
  await mobile.getByRole('link', { name: 'Otvori posao' }).click();
  await page.getByRole('link', { name: 'Poruke (1 novih)' }).click();
  await expect(page.getByRole('heading', { name: 'Poruke', exact: true })).toBeVisible();
  const messagePreview = page.getByRole('listitem').filter({ hasText: 'Svi prozori izmereni.' });
  await messagePreview.getByRole('button', { name: 'Označi kao pročitano' }).click();
  await expect(messagePreview.getByRole('button', { name: 'Označi kao pročitano' })).toHaveCount(0);
  await messagePreview.getByRole('link').click();
  await page.getByLabel('Poruka majstoru').fill('Hvala na merenju.');
  await page.getByRole('button', { name: 'Pošalji poruku' }).click();
  await expect(page.getByText('Hvala na merenju.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Poruke', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Otvori posao' }).click();
  await bossStatus.selectOption('Ponuda');
  const workerStatus = mobile.getByRole('combobox', { name: statusName });
  await expect(workerStatus).toHaveValue('Ponuda', { timeout: 10000 });
  await workerStatus.selectOption('Prihvaćeno');

  await page.getByRole('link', { name: /^Obaveštenja/ }).click();
  await expect(page.getByRole('link', { name: /Promena statusa.*Poslati ponudu/ })).toHaveCount(2);
  await expect(page.getByRole('link', { name: /Promena statusa.*Prihvaćeno/ })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Svi prozori izmereni.')).toHaveCount(0);
  await page.getByRole('link', { name: /Promena statusa.*Prihvaćeno/ }).click();
  await expect(bossStatus).toHaveValue('Prihvaćeno');
  await expect(page.getByRole('region', { name: 'Elementi posla' })).toBeVisible();
  await page.goto(`${jobUrl}/ponuda`);
  await page.getByRole('button', { name: 'Ponuda za kupca', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Pregled: Ponuda za kupca' }).getByRole('button', { name: 'Preuzmi PDF' })).toBeVisible();
  expect(archived.size).toBe(1);
  await mobile.goto(`${jobUrl}/korekcija`);
  await expect(mobile).toHaveURL(`${jobUrl}/ponuda`);
  await expect(mobile.getByRole('link', {name:'Korekcija cene'})).toHaveCount(0);
  await expect(mobile.getByRole('button', {name:/Auto za/})).toHaveCount(0);
  await expect(mobile.getByRole('region', {name:'Pregled cene'}).getByText(/€/)).toBeVisible();
  await mobile.getByText('Sačuvani dokumenti',{exact:true}).click();
  await mobile.locator('.job-document-archive').getByRole('button',{name:'Ponuda za kupca'}).click();
  await expect(mobile.getByRole('dialog',{name:'Pregled: Ponuda za kupca'}).getByRole('button',{name:'Preuzmi PDF'})).toBeVisible();
  expect(archived.size).toBe(1);
  await mobile.goto('/podesavanja');
  await mobile.getByRole('checkbox',{name:/Prikaži cene/}).uncheck();
  await expect.poll(()=>preferences.get(worker.id)?.data.showPrices).toBe(false);
  await mobile.goto(`${jobUrl}/ponuda`);
  await mobile.getByText('Sačuvani dokumenti',{exact:true}).click();
  await expect(mobile.getByText('Nema sačuvanih dokumenata za trenutni prikaz.')).toBeVisible();
  await mobile.goto('/podesavanja');
  await mobile.getByRole('checkbox',{name:/Prikaži cene/}).check();
  await expect.poll(()=>preferences.get(worker.id)?.data.showPrices).toBe(true);
  await mobile.goto('/podesavanja/korisnici');
  await expect(mobile).toHaveURL(/\/podesavanja$/);
  await expect(mobile.getByRole('link', {name:/Korisnici/})).toHaveCount(0);
  await mobile.goto('/cenovnik');
  const sharedRate=mobile.locator('dl').filter({hasText:'PVC profil (€/m²)'}).locator('dd');
  await expect(sharedRate).toHaveText('126');
  await sharedRate.click();
  await expect(sharedRate).not.toBeFocused();
  await expect(mobile.getByRole('spinbutton')).toHaveCount(0);
  await expect(mobile.getByRole('button',{name:'Sačuvaj cenovnik'})).toHaveCount(0);
  await mobile.getByText('Sobna vrata Porta Royal',{exact:true}).click();
  await expect(mobile.getByText('Cena po upitu',{exact:true}).first()).toBeVisible();
  await expect(mobile.getByRole('spinbutton')).toHaveCount(0);
  await mobile.goto('/podesavanja/pdv');
  await expect(mobile.getByText('Cene bez PDV-a · porez se dodaje',{exact:true})).toBeVisible();
  await expect(mobile.getByRole('combobox')).toHaveCount(0);
  await expect(mobile.getByRole('spinbutton')).toHaveCount(0);
  await mobile.goto(jobUrl);
  await page.goto(jobUrl);
  await bossStatus.selectOption('U izradi');
  await expect(workerStatus).toHaveValue('U izradi', { timeout: 10000 });
  await bossStatus.selectOption('Završeno');
  await expect(workerStatus).toHaveValue('Završeno', { timeout: 10000 });
  await mobile.goto('/obavestenja');
  await expect(mobile.getByRole('link', { name: /Promena statusa.*U izradi/ })).toBeVisible();
  await expect(mobile.getByRole('link', { name: /Promena statusa.*Završeno/ })).toBeVisible();
  await page.getByRole('link',{name:'Dodela i vidljivost'}).click();
  await page.getByRole('checkbox',{name:visibilityLabel}).check();
  await page.getByRole('button',{name:'Sačuvaj vidljivost'}).click();
  await expect(page.getByText('Vidljivost posla · Samo dodeljeni majstor')).toBeVisible();
  await expect(readonlyPage.getByRole('heading',{name:'Posao nije pronađen'})).toBeVisible({timeout:10000});
  await mobile.goto(jobUrl);
  await expect(mobile.getByRole('heading',{name:'Posao: Porodica Test'})).toBeVisible();
  await page.goto('/dodeli-merenje');
  await page.getByRole('combobox',{name:'Majstor',exact:true}).selectOption({label:'Miloš'});
  await page.getByRole('checkbox',{name:visibilityLabel}).check();
  await page.getByLabel('Naziv firme ili ime kupca').fill('Privatno merenje');
  await page.getByLabel('Adresa merenja').fill('Sporedna 5');
  await page.getByLabel('Poruka majstoru').fill('Izmeri vrata.');
  await page.getByRole('button',{name:'Dodeli i pošalji'}).click();
  await expect(page.getByRole('heading',{name:'Posao: Privatno merenje'})).toBeVisible();
  await mobile.goto(page.url());
  await expect(mobile.getByRole('heading',{name:'Posao: Privatno merenje'})).toBeVisible();
  await readonlyPage.goto(page.url());
  await expect(readonlyPage.getByRole('heading',{name:'Posao nije pronađen'})).toBeVisible();
  await mobile.goto('/nalog');
  await mobile.getByRole('button', { name: 'Odjavi se' }).click();
  await expect(mobile.getByRole('heading', { name: 'Prijava', exact: true })).toBeVisible();
  await workerContext.setOffline(true);
  await expect(mobile.getByRole('button', { name: 'Nastavi bez interneta (gost)' })).toHaveCount(0);
 } finally { await Promise.all([workerContext.close(),observerContext.close()]); }
});
