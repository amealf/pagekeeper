import {mkdir,writeFile} from 'node:fs/promises';
import {png} from './binary.mjs';
const out=new URL('../extension/icons/',import.meta.url);await mkdir(out,{recursive:true});
const teal=[9,103,107,255],white=[255,255,255,255],pale=[144,205,206,255];
function rounded(x,y,left,top,width,height,r){const dx=Math.max(left+r-x,0,x-(left+width-r)),dy=Math.max(top+r-y,0,y-(top+height-r));return x>=left&&x<=left+width&&y>=top&&y<=top+height&&dx*dx+dy*dy<=r*r;}
function segment(x,y,x1,y1,x2,y2,width){const dx=x2-x1,dy=y2-y1,t=Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy)));return (x-x1-t*dx)**2+(y-y1-t*dy)**2<=(width/2)**2;}
function pixel(x,y){
  if(!rounded(x,y,0,0,128,128,25))return[0,0,0,0];
  let c=teal;
  if(rounded(x,y,27,24,57,72,7))c=pale;
  if(rounded(x,y,37,33,57,72,7))c=white;
  if(segment(x,y,65.5,49,65.5,82,5)||segment(x,y,54,72,65.5,84,5)||segment(x,y,65.5,84,77,72,5))c=teal;
  return c;
}
for(const size of [16,32,48,128]){
  const data=Buffer.alloc(size*size*4),samples=4;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const sums=[0,0,0,0];
    for(let sy=0;sy<samples;sy++)for(let sx=0;sx<samples;sx++){
      const c=pixel((x+(sx+.5)/samples)*128/size,(y+(sy+.5)/samples)*128/size);
      for(let k=0;k<4;k++)sums[k]+=c[k];
    }
    for(let k=0;k<4;k++)data[(y*size+x)*4+k]=Math.round(sums[k]/(samples*samples));
  }
  await writeFile(new URL(`icon-${size}.png`,out),png(size,size,data));
}
console.log('Generated local extension icons.');
