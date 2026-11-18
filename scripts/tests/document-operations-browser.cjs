// Real browser + real isolated HTTP backend. Tokens arrive through stdin, never command lines/logs.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
async function main(){
 let input='';for await(const chunk of process.stdin)input+=chunk;const config=JSON.parse(input);
 let pw;try{pw=require('playwright');}catch{
  const links=path.join(process.env.LOCALAPPDATA||'', 'ms-playwright','.links');
  for(const link of fs.existsSync(links)?fs.readdirSync(links):[]){try{pw=require(fs.readFileSync(path.join(links,link),'utf8').trim());break;}catch{}}
 }assert(pw,'Instala Playwright y Chromium para ejecutar la comprobación visual.');
 const root=path.resolve('frontend/dist/nexodocs-frontend/browser');assert(fs.existsSync(path.join(root,'index.html')),'Compila primero el frontend.');
 const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/api/')){const proxy=http.request({hostname:'127.0.0.1',port:config.backendPort,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});proxy.on('error',()=>{res.writeHead(502);res.end();});req.pipe(proxy);return;}
  let file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await pw.chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(token=>{sessionStorage.setItem('nexodocs.access_token',token);localStorage.setItem('nexodocs_lang','es');const subject=JSON.parse(atob(token.split('.')[1])).userId;localStorage.setItem('nexodocs.hasCompletedTour.'+subject,'true');},config.token);
 const page=await context.newPage(),errors=[],apiErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)apiErrors.push(r.status()+' '+new URL(r.url()).pathname);});
 const output=path.resolve('docs/evidencias/operaciones-documentales');fs.mkdirSync(output,{recursive:true});
 try{
  for(const [route,title,file] of [['/physical-archive','Archivo físico y préstamos','01-archivo'],['/physical-archive/'+config.item,'Archivo físico y préstamos','02-custodia'],['/deliveries','Entregas externas','03-entregas'],['/mail-intake','Buzón documental','04-buzon'],['/translations','Traducción documental','09-traducciones']]){
   await page.goto(base+route);await page.getByRole('heading',{name:title,exact:true}).waitFor();await page.waitForTimeout(700);const skip=page.locator('.driver-popover-close-btn');if(await skip.isVisible())await skip.click();
   assert(!await page.getByText('Página no encontrada',{exact:true}).count(),route);assert(!await page.getByText('Acceso restringido',{exact:true}).count(),route);
   const alerts=await page.getByRole('alert').allTextContents();assert.equal(alerts.length,0,'Errores API en '+route+': '+alerts.join(';'));
   await page.screenshot({path:path.join(output,file+'.png'),fullPage:true});
  }
  await page.goto(base+'/physical-archive');await page.getByRole('button',{name:'Registrar original',exact:true}).click();
  const editor=page.locator('dialog[open]');await editor.locator('[name=code]').fill('FIS-BROWSER');await editor.locator('[name=name]').fill('Original creado en navegador');await editor.locator('[name=loc]').selectOption({index:1});await editor.locator('[name=custodian]').selectOption(config.custodianId);
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/v1/physical-archive/items')&&r.request().method()==='POST');await editor.locator('button.primary').click();assert.equal((await saved).status(),201);await page.waitForURL(/physical-archive\/[0-9a-f-]+$/);await page.getByText('Original creado en navegador').last().waitFor();
  await page.screenshot({path:path.join(output,'06-alta-desde-interfaz.png'),fullPage:true});
  const originalUrl=page.url();
  const physicalOutput=path.resolve('docs/evidencias/hu26');fs.mkdirSync(physicalOutput,{recursive:true});
  async function rolePage(token){
   const c=await browser.newContext({viewport:{width:1440,height:1000}});
   await c.addInitScript(t=>{sessionStorage.setItem('nexodocs.access_token',t);localStorage.setItem('nexodocs_lang','es');const subject=JSON.parse(atob(t.split('.')[1])).userId;localStorage.setItem('nexodocs.hasCompletedTour.'+subject,'true');},token);
   const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)apiErrors.push(r.status()+' '+new URL(r.url()).pathname);});return p;
  }
  const requester=await rolePage(config.requesterToken),custodian=await rolePage(config.custodianToken),outsider=await rolePage(config.outsiderToken);
  async function change(p,button,reason,physical=false){
   await p.getByRole('button',{name:button,exact:true}).click();const dialog=p.locator('dialog[open]');await dialog.locator('[name=actionReason]').fill(reason);
   if(button==='Resolver incidencia / conciliar')await dialog.locator('[name=actionCondition]').fill('Original reparado y completo tras inspeccion');
   if(physical)await dialog.locator('[name=physicalConfirmation]').check();
   const [saved]=await Promise.all([p.waitForResponse(r=>r.url().includes('/api/v1/physical-archive/')&&r.request().method()==='POST'),dialog.getByRole('button',{name:'Confirmar movimiento',exact:true}).click()]);assert.equal(saved.status(),200);await dialog.waitFor({state:'hidden'});
  }
  for(let cycle=1;cycle<=2;cycle++){
   await requester.goto(originalUrl);await requester.locator('[name=reason]').waitFor();
   assert.equal(await requester.getByRole('button',{name:'Registrar original',exact:true}).count(),0);
   await requester.locator('[name=reason]').fill('Consulta sintetica ciclo '+cycle);await requester.locator('[name=due]').fill(new Date(Date.now()+2*86400000).toISOString().slice(0,16));
   const requested=requester.waitForResponse(r=>r.url().endsWith('/requests')&&r.request().method()==='POST');await requester.getByRole('button',{name:'Solicitar préstamo',exact:true}).click();assert.equal((await requested).status(),201);
   await requester.getByText('Consulta sintetica ciclo '+cycle,{exact:true}).waitFor();
   assert.equal(await requester.getByRole('button',{name:'Reservar',exact:true}).count(),0);
   await requester.screenshot({path:path.join(physicalOutput,'0'+(cycle===1?1:6)+'-solicitante-ciclo-'+cycle+'.png'),fullPage:true});
   await outsider.goto(originalUrl);await outsider.getByText('Consulta sintetica ciclo '+cycle,{exact:true}).waitFor();assert.equal(await outsider.getByRole('button',{name:'Reservar',exact:true}).count(),0);
   await custodian.goto(originalUrl);await change(custodian,'Reservar','Reserva autorizada por custodio');
   await custodian.getByRole('button',{name:'Confirmar entrega física',exact:true}).waitFor();
   await custodian.screenshot({path:path.join(physicalOutput,'0'+(cycle===1?2:7)+'-reserva-ciclo-'+cycle+'.png'),fullPage:true});
   await change(custodian,'Confirmar entrega física','Original completo e inspeccionado al entregar',true);
   await custodian.getByRole('button',{name:'Recibir devolución',exact:true}).waitFor();
   await custodian.screenshot({path:path.join(physicalOutput,'0'+(cycle===1?3:8)+'-entrega-ciclo-'+cycle+'.png'),fullPage:true});
   await requester.goto(originalUrl);await requester.getByText('Consulta sintetica ciclo '+cycle,{exact:true}).waitFor();assert.equal(await requester.getByRole('button',{name:'Recibir devolución',exact:true}).count(),0);
   await custodian.getByRole('button',{name:'Recibir devolución',exact:true}).click();const returned=custodian.locator('dialog[open]');
   await returned.locator('[name=returnCondition]').fill(cycle===1?'Completo despues de la inspeccion':'Carpeta deteriorada; requiere revision');
   if(cycle===2)await returned.locator('[name=incident]').check();
   const received=custodian.waitForResponse(r=>r.url().endsWith('/return')&&r.request().method()==='POST');await returned.getByRole('button',{name:'Confirmar recepción física',exact:true}).click();assert.equal((await received).status(),200);await returned.waitFor({state:'hidden'});
   if(cycle===2){
    await custodian.getByRole('button',{name:'Resolver incidencia / conciliar',exact:true}).waitFor();
    await custodian.screenshot({path:path.join(physicalOutput,'09-incidencia.png'),fullPage:true});
    await change(custodian,'Resolver incidencia / conciliar','Recuento fisico y reparacion confirmados',true);
   }
   await custodian.locator('p > span.badge').filter({hasText:'Disponible'}).waitFor();
   await custodian.screenshot({path:path.join(physicalOutput,cycle===1?'04-devolucion-ciclo-1.png':'10-conciliado-ciclo-2.png'),fullPage:true});
  }
  await page.goto(originalUrl);await page.getByRole('button',{name:'Reasignar custodia',exact:true}).click();const custody=page.locator('dialog[open]');await custody.locator('[name=newCustodian]').selectOption(config.outsiderId);await custody.locator('[name=custodyReason]').fill('Relevo de custodia verificado desde interfaz');
  const reassigned=page.waitForResponse(r=>r.url().endsWith('/custodian')&&r.request().method()==='POST');await custody.getByRole('button',{name:'Guardar nueva custodia',exact:true}).click();assert.equal((await reassigned).status(),200);await custody.waitFor({state:'hidden'});await page.locator('p > strong').filter({hasText:'Otro Custodio Sintetico'}).waitFor();await page.screenshot({path:path.join(physicalOutput,'12-custodia-reasignada.png'),fullPage:true});
  await custodian.setViewportSize({width:390,height:844});await custodian.waitForTimeout(450);await custodian.evaluate(()=>window.scrollTo(0,0));await custodian.screenshot({path:path.join(physicalOutput,'11-movil-custodio.png'),animations:'disabled'});
  await requester.context().close();await custodian.context().close();await outsider.context().close();
  console.log('HU26_BROWSER_OK: dos ciclos con solicitante y custodio separados, tercero sin custodia, incidencia y conciliacion');

  await page.goto(base+'/deliveries');await page.getByRole('button',{name:'Nueva entrega',exact:true}).click();
  const delivery=page.locator('dialog[open]');const option=delivery.locator('select[name=version] option').filter({hasText:'Documento de prueba aislada'});await option.waitFor({state:'attached'});await delivery.locator('[name=version]').selectOption(await option.getAttribute('value'));await delivery.locator('[name=recipient]').fill('Destinatario de interfaz');await delivery.locator('[name=email]').fill('destino@tests.invalid');await delivery.locator('[name=reason]').fill('Entrega creada desde el navegador');
  const queued=page.waitForResponse(r=>r.url().endsWith('/api/v1/deliveries')&&r.request().method()==='POST');await delivery.locator('button.primary').click();assert.equal((await queued).status(),202);await delivery.waitFor({state:'hidden'});await page.screenshot({path:path.join(output,'07-entrega-desde-interfaz.png'),fullPage:true});
  await page.goto(base+'/mail-intake');await page.getByRole('button',{name:'Revisar',exact:true}).first().click();await page.getByRole('heading',{name:'Revisar adjunto recibido',exact:true}).waitFor();await page.screenshot({path:path.join(output,'08-revision-adjunto.png'),fullPage:true});await page.locator('dialog[open]').getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/mail-intake');await page.getByRole('heading',{name:'Buzón documental',exact:true}).waitFor();await page.screenshot({path:path.join(output,'05-movil.png'),fullPage:true});
  const publicPage=await browser.newPage();await publicPage.goto(base+'/external/delivery');await publicPage.getByText(/enlace/i).first().waitFor();assert(!await publicPage.getByText('Página no encontrada',{exact:true}).count());await publicPage.close();
  assert.deepEqual(errors,[]);assert.deepEqual(apiErrors,[],'Peticiones fallidas del shell o del proceso');console.log('DOCUMENT_OPERATIONS_BROWSER_OK: rutas reales, detalle, portal y vista móvil');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error('Falló la verificación visual:',e.message);process.exitCode=1;});
