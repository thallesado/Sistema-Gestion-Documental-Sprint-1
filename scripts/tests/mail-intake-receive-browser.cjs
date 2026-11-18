// Disposable fixtures only. Auth token arrives on stdin and is never logged.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
async function main(){
 let input='';for await(const chunk of process.stdin)input+=chunk;const config=JSON.parse(input);
 let pw;try{pw=require('playwright');}catch{const links=path.join(process.env.LOCALAPPDATA||'','ms-playwright','.links');for(const name of fs.existsSync(links)?fs.readdirSync(links):[]){try{pw=require(fs.readFileSync(path.join(links,name),'utf8').trim());break;}catch{}}}assert(pw,'Playwright requerido');
 const root=path.resolve('frontend/dist/nexodocs-frontend/browser');
 const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/api/')){const proxy=http.request({hostname:'127.0.0.1',port:config.backendPort,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});proxy.on('error',()=>{res.writeHead(502);res.end();});req.pipe(proxy);return;}
  let file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await pw.chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(token=>{sessionStorage.setItem('nexodocs.access_token',token);localStorage.setItem('nexodocs_lang','es');const user=JSON.parse(atob(token.split('.')[1])).userId;localStorage.setItem('nexodocs.hasCompletedTour.'+user,'true');},config.token);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/mail-intake');await page.getByRole('heading',{name:'Recepción de documentos',exact:true}).waitFor();
  await page.getByRole('button',{name:'Actualizar',exact:true}).waitFor();
  const row=page.getByRole('row').filter({hasText:'solo-recepcion.pdf'});await row.getByRole('button',{name:'Descargar adjunto',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Revisar',exact:true}).count(),0);
  assert.equal(await page.getByText('El escáner antimalware no está configurado.',{exact:false}).count(),0);
  assert.equal((await row.locator('.badge').innerText()).trim(),'Recibido');
  const collapse=page.getByRole('button',{name:'Colapsar menú',exact:true});if(await collapse.isVisible())await collapse.click();
  const output=path.resolve('docs/evidencias/hu28');fs.mkdirSync(output,{recursive:true});
  await page.screenshot({path:path.join(output,'01-recepcion-sin-escaner.png'),fullPage:true});
  await row.getByRole('button',{name:'Ver recepción',exact:true}).click();
  const dialog=page.locator('dialog[open]');await dialog.getByRole('heading',{name:'Detalle de recepción',exact:true}).waitFor();
  assert.equal(await dialog.getByRole('button',{name:'Incorporar al archivo',exact:true}).count(),0);
  const [download]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:'Descargar adjunto',exact:true}).click()]);
  assert.equal(download.suggestedFilename(),'solo-recepcion.pdf');const file=await download.path();assert(fs.readFileSync(file).subarray(0,5).equals(Buffer.from('%PDF-')));
  await page.screenshot({path:path.join(output,'02-detalle-y-descarga.png'),fullPage:true});
  await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'03-recepcion-movil.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('HU28_RECEIVE_BROWSER_OK: API real, recibido, sin revision/escaner, detalle, descarga PDF y vista movil');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
