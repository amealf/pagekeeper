import http from 'node:http';import {readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));const port=Number(process.env.PAGEKEEPER_PREVIEW_PORT || 8766);
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let relative=pathname==='/'?'extension/control.html':pathname.slice(1);
    if(!relative.startsWith('extension/')&&!relative.startsWith('tests/fixtures/')){res.writeHead(404);res.end();return;}
    const filename=path.resolve(root,relative);
    if(!['extension','tests/fixtures'].some(dir=>filename.startsWith(path.resolve(root,dir)+path.sep)))throw Error('Outside preview root');
    let data=await readFile(filename);
    if(relative==='extension/control.html')data=Buffer.from(data.toString().replace('<script src="core.js" defer>', '<script src="../tests/fixtures/chrome-preview.js" defer></script><script src="core.js" defer>').replace('<body>','<body><div class="preview-banner">界面与流程预览 · Chrome API 为测试模拟 · 未安装真实插件</div>'));
    const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'}[path.extname(filename)] || 'application/octet-stream';
    res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Pagekeeper preview http://127.0.0.1:${port}/extension/control.html`));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
