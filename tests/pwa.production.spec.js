import {test,expect} from '@playwright/test';
async function ready(page){
  await page.goto('/');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
}
async function entry(page){
  if(await page.getByRole('button',{name:'Ouvrir le menu'}).isVisible())await page.getByRole('button',{name:'Ouvrir le menu'}).click();
  await page.getByRole('button',{name:'Saisie de production',exact:true}).click();
}
test('PWA mobile : manifeste, ressources hors ligne et brouillon après redémarrage',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await ready(page);
  const manifest=await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');expect(manifest.icons).toHaveLength(3);
  await entry(page);
  await page.getByLabel('Quantité planifiée',{exact:true}).fill('7200');
  await page.getByLabel('Quantité conforme',{exact:true}).fill('6100');
  await page.getByLabel('Commentaire du poste').fill('Brouillon hors ligne');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.getByLabel('Quantité planifiée',{exact:true}).evaluate(e=>getComputedStyle(e).fontSize)).toBe('16px');
  await page.screenshot({path:'.runtime/pwa-entry-mobile.png',fullPage:true});
  await context.setOffline(true);
  const fresh=await context.newPage();await fresh.setViewportSize({width:390,height:844});
  await fresh.goto('/');await expect(fresh.getByText('Hors connexion',{exact:true})).toBeVisible();
  await entry(fresh);
  await expect(fresh.getByLabel('Quantité planifiée',{exact:true})).toHaveValue('7200');
  await expect(fresh.getByLabel('Commentaire du poste')).toHaveValue('Brouillon hors ligne');
  expect(errors).toEqual([]);
});
test('Mise à jour proposée, activation volontaire et conservation du brouillon',async({page,request})=>{
  await ready(page);await entry(page);
  await page.getByLabel('Quantité planifiée',{exact:true}).fill('8000');
  await page.getByLabel('Commentaire du poste').fill('Conserver après mise à jour');
  await request.post('/__test/version');
  await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});
  await expect(page.getByRole('button',{name:'Mettre à jour',exact:true})).toBeVisible();
  await expect(page.getByLabel('Quantité planifiée',{exact:true})).toHaveValue('8000');
  await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Mettre à jour',exact:true}).click()]);
  await entry(page);await expect(page.getByLabel('Quantité planifiée',{exact:true})).toHaveValue('8000');
  await expect(page.getByLabel('Commentaire du poste')).toHaveValue('Conserver après mise à jour');
});
test('Installation : parcours iPhone et événement natif simulé',async({browser})=>{
  const iphone=await browser.newContext({viewport:{width:375,height:812},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
  const page=await iphone.newPage();await page.goto('/');
  await page.getByRole('button',{name:'Installer sur iPhone'}).click();
  await expect(page.getByRole('link',{name:'Télécharger l’APK Android'})).toHaveCount(0);
  await expect(page.getByRole('dialog')).toContainText('Safari');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.runtime/pwa-install-iphone.png',fullPage:true});
  await iphone.close();
  const android=await browser.newContext();const other=await android.newPage();await other.goto('/');
  await expect(other.getByRole('button',{name:'Installer depuis le navigateur'})).toBeVisible();
  await other.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.nativePromptCalled=true;};e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e);});
  await other.getByRole('button',{name:'Installer depuis le navigateur'}).click();
  expect(await other.evaluate(()=>window.nativePromptCalled)).toBe(true);
  await android.close();
});

test('APK : téléchargement du binaire avec le service worker actif',async({page})=>{
  await page.setViewportSize({width:390,height:844});await ready(page);
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Télécharger l’APK Android'}).click()]);
  expect(download.suggestedFilename()).toBe('QOS-Injection.apk');
  const {readFile}=await import('node:fs/promises');
  const bytes=await readFile(await download.path());
  expect(bytes.subarray(0,2).toString()).toBe('PK');expect(bytes.length).toBeGreaterThan(10000);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.runtime/apk-download-mobile.png',fullPage:true});
});
