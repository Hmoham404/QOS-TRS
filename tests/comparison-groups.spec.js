import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { departmentSeed } from '../src/departments.js';

test('Trois départements : totaux, choix au titre, lignes et filtres indépendants', async ({page}) => {
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-26T12:00:00Z'));
  const seed=JSON.parse(readFileSync(new URL('../src/seed.json',import.meta.url),'utf8'));
  const ids=['injection','welding','metallization','screen-printing','assembly'];
  const datasets=ids.map(id=>id==='injection'?seed:departmentSeed(id));
  await page.goto('/');
  await page.evaluate(({ids,datasets,template})=>{
    ids.forEach((department,index)=>{
      const data=datasets[index];
      const presses=department==='metallization'?data.presses:[data.presses[0]];
      const records=presses.map((press,i)=>({...template,id:`${department}-${i}`,department,press_id:press.id,article_id:data.articles[0].id,date:'2026-11-26',good_qty:100,startup_rejects:0,production_rejects:0,opening_min:60,planned_min:0,cycle_seconds:10,standard_seconds:10,labor_hours:1}));
      localStorage.setItem(`qos-${department}-v1`,JSON.stringify({...data,records}));
    });
  },{ids,datasets,template:seed.records[0]});
  await page.reload(); await page.locator('.brand').click();
  const injection=page.locator('.comparison-card[data-department=injection]');
  const metal=page.locator('.comparison-card[data-department=metallization]');
  const assembly=page.locator('.comparison-card[data-department=assembly]');
  await expect(page.locator('.comparison-card')).toHaveCount(3);
  await expect(page.locator('.comparison-name h3')).toHaveText(['Injection','Métallisation','Assemblage']);
  await expect(injection.locator('.comparison-count')).toHaveText('2 relevés');
  await expect(metal.locator('.comparison-count')).toHaveText('3 relevés');
  await expect(assembly.locator('.comparison-count')).toHaveText('2 relevés');
  await expect(injection.locator('.comparison-quality strong').nth(1)).toHaveText('200');
  const factoryValues=await page.locator('.comparison-intro dd').allTextContents();
  await injection.locator('.comparison-scope-trigger').click();
  await injection.getByRole('option',{name:'Soudure',exact:true}).click();
  await expect(injection.locator('.comparison-count')).toHaveText('1 relevés');
  await expect(injection.locator('.comparison-scope-current')).toHaveText('Soudure');
  await injection.getByRole('button',{name:'Machines · Injection',exact:true}).click();
  await injection.getByRole('option',{name:/Ligne Soudure/}).click();
  for (const line of ['Ligne de métallisation','Ligne de peinture','Ligne de support Bosage']) {
    await metal.locator('.comparison-scope-trigger').click();
    await metal.getByRole('option',{name:line,exact:true}).click();
    await expect(metal.locator('.comparison-count')).toHaveText('1 relevés');
    await expect(metal.locator('.comparison-quality strong').nth(1)).toHaveText('100');
  }
  await assembly.locator('.comparison-scope-trigger').click();
  await assembly.getByRole('option',{name:'Décoration',exact:true}).click();
  await expect(assembly.locator('.comparison-count')).toHaveText('1 relevés');
  await injection.locator('.comparison-scope-trigger').click();
  await injection.getByRole('option',{name:'Total du département',exact:true}).click();
  await expect(injection.locator('.comparison-count')).toHaveText('2 relevés');
  await expect(injection.getByRole('button',{name:'Machines · Injection',exact:true})).toContainText('Total');
  await expect(page.locator('.comparison-intro dd')).toHaveText(factoryValues);
  await page.screenshot({path:'.runtime/grouped-departments-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await metal.locator('.comparison-scope-trigger').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await metal.screenshot({path:'.runtime/grouped-departments-mobile.png'});
  await page.keyboard.press('Escape');
  await expect(metal.locator('.comparison-scope-trigger')).toBeFocused();
  await page.getByLabel('Date analysée').fill('2026-11-25');
  await expect(page.locator('.comparison-empty')).toHaveCount(3);
  expect(errors).toEqual([]);
});
