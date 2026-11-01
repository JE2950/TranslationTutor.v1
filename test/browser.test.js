const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TYPES = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json'};
const server = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, {'Content-Type': TYPES[path.extname(f)] || 'text/plain'});
  res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise(r => server.listen(8099, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  console.log('title: ' + await page.title());

  async function q(){ return (await page.textContent('#qtext')).trim(); }
  async function fb(){ return (await page.textContent('#fb')).trim(); }
  async function detail(){ return (await page.textContent('#qdetail')).trim(); }
  async function answerText(v){
    await page.fill('#answer', v);
    await page.click('#inputs .btn');
    await page.waitForTimeout(520);
  }
  async function answerChoice(v){
    const opts = await page.locator('#inputs .choices button').allTextContents();
    const i = opts.findIndex(t => t.trim() === v);
    if (i < 0) throw new Error('no option "' + v + '" among: ' + JSON.stringify(opts));
    await page.locator('#inputs .choices button').nth(i).click();
    await page.waitForTimeout(520);
  }
  async function isChoice(){ return await page.locator('#inputs .choices').count() > 0; }

  // ---- Latin into English, full depth ----
  await page.fill('#sentence', 'puellae in villa laborabant.');
  await page.click('#beginbtn');
  await page.waitForTimeout(250);
  console.log('\n--- session 1 (Latin into English) ---');

  const script = [
    ['villa', false], ['laborabant', true],          // find the verb
    ['he, she or it', false], ['they', true],          // person
    ['present', false], ['imperfect', true],           // tense
    ['works', false], ['were working', true],          // meaning
    ['puellae', true],                                  // subject
    ['nominative', true],                               // ambiguity
    ['in the house', true],                             // phrase
    ['the girls were working in the house', true]       // whole
  ];
  for (const [ans, shouldPass] of script) {
    const prompt = await q();
    const choice = await isChoice();
    if (choice) await answerChoice(ans); else await answerText(ans);
    const f = await fb();
    const advanced = (await q()) !== prompt;
    console.log(`  "${ans}" → ${advanced ? 'ADVANCED' : 'stayed'}  | ${f.slice(0,80)}`);
    if (shouldPass && !advanced) { console.log('    !! expected this to be accepted'); }
    if (!shouldPass && advanced) { console.log('    !! expected this to be rejected'); }
  }
  await page.waitForTimeout(600);
  const doneVisible = await page.locator('#done').isVisible();
  console.log('  finished panel shown: ' + doneVisible);
  if (doneVisible) {
    console.log('  summary: ' + (await page.textContent('#summary')).replace(/\s+/g,' ').trim());
    const rows = await page.locator('#record li').count();
    console.log('  working rows: ' + rows);
  }
  await page.screenshot({ path: '/tmp/shot-done.png', fullPage: true });

  // ---- hints and the table ----
  await page.click('#againbtn');
  await page.waitForTimeout(200);
  await page.fill('#sentence', 'dominus servum necavit.');
  await page.click('#beginbtn');
  await page.waitForTimeout(250);
  console.log('\n--- session 2 (hints, then the table) ---');
  console.log('  Q: ' + await q());
  for (let i=0;i<3;i++){
    await page.click('#hintbtn');
    await page.waitForTimeout(150);
    console.log('  hint ' + (i+1) + ': ' + (await fb()).slice(0,90));
  }
  const tableBtnVisible = await page.locator('#tablebtn').isVisible();
  console.log('  table button visible after hints: ' + tableBtnVisible);
  await answerText('necavit');
  console.log('  Q: ' + await q());
  // wrong three times → table offered
  await answerChoice('I'); await answerChoice('we'); await answerChoice('you (plural)');
  console.log('  after 3 wrong: ' + (await fb()).slice(0,110));
  console.log('  table button visible: ' + await page.locator('#tablebtn').isVisible());
  await page.click('#tablebtn');
  await page.waitForTimeout(200);
  const tbl = await page.textContent('#tablebox');
  console.log('  table: ' + tbl.replace(/\s+/g,' ').trim().slice(0,150));
  await page.screenshot({ path: '/tmp/shot-table.png', fullPage: true });

  // ---- build-it mode ----
  await page.click('#quitbtn');
  await page.waitForTimeout(200);
  await page.click('#seg-mode button[data-value="build"]');
  await page.click('#seg-depth button[data-value="core"]');
  await page.fill('#sentence', 'servus cibum portat.');
  await page.click('#beginbtn');
  await page.waitForTimeout(250);
  console.log('\n--- session 3 (core depth, build it) ---');
  await answerText('portat');
  await answerChoice('he, she or it');
  await answerChoice('present');
  await answerText('servus');
  await answerText('cibum');
  console.log('  Q: ' + await q());
  const tiles = await page.locator('#bank .tile').allTextContents();
  console.log('  tiles: ' + tiles.map(t=>'['+t+']').join(' '));
  for (const want of ['the slave','carries','the food']) {
    {
      const tt = await page.locator('#bank .tile').allTextContents();
      const j = tt.findIndex(t => t.trim() === want);
      if (j < 0) throw new Error('no tile "' + want + '" among: ' + JSON.stringify(tt));
      await page.locator('#bank .tile').nth(j).click();
    }
    await page.waitForTimeout(80);
  }
  console.log('  built: ' + (await page.locator('#built .tile').allTextContents()).join(' | '));
  await page.click('#inputs .btn');
  await page.waitForTimeout(600);
  console.log('  finished: ' + await page.locator('#done').isVisible());
  await page.screenshot({ path: '/tmp/shot-build.png', fullPage: true });

  // ---- English into Latin ----
  await page.click('#againbtn');
  await page.waitForTimeout(200);
  await page.click('#seg-direction button[data-value="e2l"]');
  await page.click('#seg-depth button[data-value="full"]');
  await page.waitForTimeout(100);
  await page.fill('#sentence', 'the girls were working in the house');
  await page.click('#beginbtn');
  await page.waitForTimeout(250);
  console.log('\n--- session 4 (English into Latin) ---');
  const e2l = [
    ['laboro', true],
    ['imperfect', true],
    ['they', true],
    ['laborabant', true],
    ['puella', true],
    ['subject', true],
    ['nominative plural', true],
    ['puellae', true],
    ['in + ablative', true],
    ['villa', true],
    ['villa', true],
    ['puellae in villa laborabant', true]
  ];
  for (const [ans] of e2l) {
    const prompt = await q();
    if (await isChoice()) await answerChoice(ans); else await answerText(ans);
    const advanced = (await q()) !== prompt;
    console.log(`  "${ans}" → ${advanced?'ADVANCED':'stayed'}  | ${(await fb()).slice(0,80)}`);
  }
  await page.waitForTimeout(600);
  console.log('  finished: ' + await page.locator('#done').isVisible());
  await page.screenshot({ path: '/tmp/shot-e2l.png', fullPage: true });

  // ---- rejection of out-of-scope words ----
  await page.click('#againbtn');
  await page.waitForTimeout(150);
  await page.click('#seg-direction button[data-value="l2e"]');
  await page.fill('#sentence', 'milites urbem oppugnabant.');
  await page.click('#beginbtn');
  await page.waitForTimeout(200);
  console.log('\n--- out of scope at Level 1 ---');
  console.log('  note: ' + (await page.textContent('#setupnote')).trim());

  console.log('\nconsole errors: ' + (errors.length ? JSON.stringify(errors.slice(0,6)) : 'none'));
  await browser.close();
  server.close();
})().catch(e => { console.error('TEST CRASH: ' + e.message); process.exit(1); });
