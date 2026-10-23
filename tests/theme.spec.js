import {test,expect} from '@playwright/test';
import messages from '../src/locales/messages.js';
const translate=(key,language)=>language==='fr'?key:messages[key][language];
const pages=['Vue d’ensemble','Courbes','Saisie de production','Historique des relevés','Presses & moules','Configuration','Bilan J−1'];

test('Jour et nuit couvrent les sept pages, conservent les saisies et restent mémorisés',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Mode nuit',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await expect(page.getByRole('button',{name:'Mode nuit',exact:true})).toHaveAttribute('aria-pressed','true');
 for(const navigation of pages){
  await page.getByRole('navigation').getByRole('button',{name:navigation,exact:true}).click();
  const surface=page.locator('.panel,.daily-toolbar').first();
  await expect(surface).toBeVisible();
  const colors=await surface.evaluate(element=>({background:getComputedStyle(element).backgroundColor,text:getComputedStyle(element).color}));
  expect(colors.background).not.toBe('rgb(255, 255, 255)');
  if(navigation==='Vue d’ensemble'){
   for(const selector of ['.timeline-facts','.analysis-footnote','.production-strip']){
    expect(await page.locator(selector).first().evaluate(element=>getComputedStyle(element).backgroundColor)).not.toBe('rgb(255, 255, 255)');
   }
   await expect(page.locator('.cockpit-banner,.press-scene')).toHaveCount(0);
   await expect(page.getByText('Une nouvelle perspective.',{exact:true})).toHaveCount(0);
   await expect(page.locator('.kpi-grid')).toBeVisible();
   await expect(page.locator('.trend-chart .chart-point-value').first()).toBeVisible();
   await page.screenshot({path:'.runtime/theme-night-dashboard.png',fullPage:true});
  }
  if(navigation==='Courbes')await page.screenshot({path:'.runtime/theme-night-curves.png',fullPage:true});
  if(navigation==='Saisie de production')expect(await page.locator('.journal-toggle').evaluate(element=>getComputedStyle(element).backgroundColor)).not.toBe('rgb(255, 255, 255)');
  if(navigation==='Presses & moules'){
   await page.getByRole('button',{name:'Ajouter une presse',exact:true}).click();
   await expect(page.locator('dialog[open]')).toBeVisible();
   expect(await page.locator('dialog[open]').evaluate(element=>getComputedStyle(element).backgroundColor)).toBe('rgb(18, 31, 46)');
   await page.keyboard.press('Escape');
  }
  if(navigation==='Bilan J−1'){
   await page.getByLabel('Date du bilan journalier').fill('2026-10-08');
   await expect(page.locator('.daily-press-card')).toHaveCount(3);
   await page.screenshot({path:'.runtime/theme-night-daily.png',fullPage:true});
  }
 }
 await page.getByRole('button',{name:'Saisie de production',exact:true}).click();
 await page.getByLabel('Quantité conforme',{exact:true}).fill('123');
 await page.getByLabel("Manque d'effectif",{exact:true}).fill('17');
 await page.getByRole('button',{name:'Mode jour',exact:true}).click();
 await expect(page.getByLabel('Quantité conforme',{exact:true})).toHaveValue('123');
 await expect(page.getByLabel("Manque d'effectif",{exact:true})).toHaveValue('17');
 await expect(page.locator('.machine-time')).toContainText('463,0');
 await page.getByRole('button',{name:'Mode nuit',exact:true}).click();
 await page.screenshot({path:'.runtime/theme-night-entry.png',fullPage:true});
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#0b1420');
 await page.getByRole('button',{name:'Mode jour',exact:true}).click();await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByRole('button',{name:'Vue d’ensemble',exact:true}).click();
 await page.screenshot({path:'.runtime/theme-day-dashboard.png',fullPage:true});
 expect(errors).toEqual([]);
});

test('Le sélecteur reste traduit et utilisable sur mobile, en arabe et sans débordement',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 for(const [language,buttonName] of [['ar','العربية (AR)'],['en','English (EN)'],['it','Italiano (IT)'],['zh','中文 (ZH)'],['fr','Français (FR)']]){
  await page.getByRole('button',{name:buttonName,exact:true}).click();
  for(const [key,theme] of [['Mode nuit','dark'],['Mode jour','light']]){
   await page.getByRole('button',{name:translate(key,language),exact:true}).click();
   await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const size=await page.getByRole('button',{name:translate(key,language),exact:true}).boundingBox();
   expect(size.height).toBeGreaterThanOrEqual(40);
   if(language==='ar'&&theme==='dark')await page.screenshot({path:'.runtime/theme-night-ar-mobile.png',fullPage:true});
  }
 }
});

test('Le thème suit le système au premier démarrage puis respecte le choix explicite',async({page,context})=>{
 await page.emulateMedia({colorScheme:'dark'});await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'Mode jour',exact:true}).click();
 await page.emulateMedia({colorScheme:'light'});await page.emulateMedia({colorScheme:'dark'});
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 const second=await context.newPage();await second.goto('/');
 await expect(second.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByRole('button',{name:'Mode nuit',exact:true}).click();
 await expect(second.locator('html')).toHaveAttribute('data-theme','dark');
});

test('Le sélecteur et les contrôles principaux restent lisibles dans les deux thèmes',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Saisie de production',exact:true}).click();
 for(const theme of ['Mode jour','Mode nuit']){
  await page.getByRole('button',{name:theme,exact:true}).click();
  const contrast=await page.evaluate(()=>{
   const rgb=color=>(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
   const luminance=color=>rgb(color).map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((s,value,i)=>s+value*[.2126,.7152,.0722][i],0);
   return [...document.querySelectorAll('.page-heading h1,.field>span,.loss-help,.theme-switcher button[aria-pressed=true]')].map(element=>{
    let parent=element,background;
    while(parent){const next=getComputedStyle(parent).backgroundColor;if(next!=='rgba(0, 0, 0, 0)'&&next!=='transparent'){background=next;break}parent=parent.parentElement}
    const text=luminance(getComputedStyle(element).color),bg=luminance(background||getComputedStyle(document.body).backgroundColor);
    return {text:element.textContent.trim(),ratio:(Math.max(text,bg)+.05)/(Math.min(text,bg)+.05)};
   });
  });
  for(const item of contrast)expect(item.ratio,`${theme}: ${item.text}`).toBeGreaterThanOrEqual(4.5);
 }
});
