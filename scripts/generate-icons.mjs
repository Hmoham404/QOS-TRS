// Rasterisation du symbole vectoriel existant (public/favicon.svg), sans dépendance.
import { deflateSync } from 'node:zlib';
import { mkdirSync,writeFileSync } from 'node:fs';
const directory=new URL('../public/icons/',import.meta.url);mkdirSync(directory,{recursive:true});
function crc32(bytes){let n=0xffffffff;for(const byte of bytes){n^=byte;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([size,name,data,crc]);}
function icon(size){
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
  const pixels=Buffer.alloc((size*3+1)*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)*64/size,v=(y+.5)*64/size;
    const bar=v<44&&((u>=16&&u<24&&v>=25)||(u>=28&&u<36&&v>=16)||(u>=40&&u<48&&v>=32));
    const color=bar?[78,224,180]:[16,44,55],offset=y*(size*3+1)+1+x*3;
    color.forEach((c,i)=>pixels[offset+i]=c);
  }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
for(const [name,size] of [['icon-192.png',192],['icon-512.png',512],['maskable-512.png',512],['apple-touch-icon.png',180]])writeFileSync(new URL(name,directory),icon(size));
