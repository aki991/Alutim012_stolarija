import { expect, test } from '@playwright/test';

const job='/posao/AT-2026-012';

test('Brisanje broja ostavlja prazno polje za unos na telefonu',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto(job+'/nov/nacrtaj');
 const frame=page.getByRole('spinbutton',{name:'Širina rama (mm)'});
 await expect(frame).toHaveValue('70');
 await frame.press('End');
 await frame.press('Backspace');
 await frame.press('Backspace');
 await expect(frame).toHaveValue('');
 await frame.pressSequentially('55');
 await expect(frame).toHaveValue('55');
 await frame.fill('');
 await frame.press('Tab');
 await expect(frame).toHaveValue('55');

 await page.goto(job+'/nov/prozor');
 const width=page.getByLabel('Širina (mm)',{exact:true});
 await width.fill('');
 await expect(width).toHaveValue('');
 await width.pressSequentially('1500');
 await expect(width).toHaveValue('1500');
 await expect(page.getByRole('button',{name:'Dodaj u posao',exact:true})).toBeEnabled();
});

test('Brisanje popusta ostavlja prazno polje i poništava popust',async({page})=>{
 await page.goto(job+'/korekcija');
 const discount=page.getByRole('spinbutton',{name:'Popust',exact:true});
 const total=page.getByTestId('correction-total');
 const original=await total.innerText();
 await discount.fill('10');
 await expect(total).not.toHaveText(original);
 await discount.fill('');
 await expect(discount).toHaveValue('');
 await expect(total).toHaveText(original);
});
