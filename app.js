'use strict';
const $=id=>document.getElementById(id), canvas=$('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
let tool='brush',color='#2563eb',size=6,drawing=false,start,last,snapshot,history=[],future=[],dirty=false,textPoint;
const names={brush:'✎ 画笔',eraser:'▱ 橡皮',fill:'◒ 填充',picker:'⌖ 取色',text:'T 文字',line:'╱ 直线',rect:'□ 矩形',ellipse:'○ 椭圆'};
const palette=['#172033','#64748b','#a1aab8','#ffffff','#ef4444','#f97316','#facc15','#22c55e','#14b8a6','#06b6d4','#2563eb','#6366f1','#a855f7','#ec4899','#92400e','#fbcfe8'];
function setColor(value){color=value;$('color').value=value;$('hex').textContent=value;document.querySelectorAll('#palette button').forEach(b=>b.classList.toggle('active',b.dataset.color===value));}
palette.forEach(c=>{const b=document.createElement('button');b.style.background=c;b.title=c;b.setAttribute('aria-label','颜色 '+c);b.dataset.color=c;b.onclick=()=>setColor(c);$('palette').append(b)});
$('color').oninput=e=>setColor(e.target.value);setColor(color);
function selectTool(value){tool=value;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('selected',b.dataset.tool===value));$('toolLabel').textContent=names[value];canvas.style.cursor=value==='text'?'text':'crosshair'}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>selectTool(b.dataset.tool));
$('size').oninput=e=>{size=Number(e.target.value);$('sizeLabel').textContent=size+' px'};
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),2200)}
function state(){return {w:canvas.width,h:canvas.height,data:ctx.getImageData(0,0,canvas.width,canvas.height)}}
function remember(){history.push(state());if(history.length>20)history.shift();future=[];dirty=true;buttons()}
function buttons(){$('undo').disabled=!history.length;$('redo').disabled=!future.length}
function restore(s){canvas.width=s.w;canvas.height=s.h;ctx.putImageData(s.data,0,0);layout()}
$('undo').onclick=()=>{if(!history.length)return;future.push(state());restore(history.pop());dirty=true;buttons()};
$('redo').onclick=()=>{if(!future.length)return;history.push(state());restore(future.pop());dirty=true;buttons()};
function white(){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height)}
function layout(){const z=Number($('zoom').value)/100;canvas.style.transform=`scale(${z})`;$('wrap').style.width=canvas.width*z+'px';$('wrap').style.height=canvas.height*z+'px';$('zoomLabel').textContent=Math.round(z*100)+'%';$('dimensions').textContent=`${canvas.width} × ${canvas.height} 像素`}
function fit(){const w=$('workspace');$('zoom').value=Math.max(10,Math.min(100,Math.floor(Math.min((w.clientWidth-32)/canvas.width,(w.clientHeight-32)/canvas.height)*100)));layout()}
$('zoom').oninput=layout;$('fit').onclick=fit;
// Keep the canvas point under the cursor stationary as the view zooms.
function wheelZoom(e){
  e.preventDefault();
  if(drawing||!e.deltaY)return;
  const control=$('zoom'),oldZoom=Number(control.value);
  const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?$('workspace').clientHeight:1);
  const next=Math.max(Number(control.min),Math.min(Number(control.max),Math.round(oldZoom*Math.exp(-Math.max(-240,Math.min(240,delta))*.002))));
  if(next===oldZoom)return;
  const before=canvas.getBoundingClientRect(),x=(e.clientX-before.left)/(oldZoom/100),y=(e.clientY-before.top)/(oldZoom/100);
  control.value=next;layout();
  const after=canvas.getBoundingClientRect(),workspace=$('workspace');
  workspace.scrollLeft+=after.left+x*next/100-e.clientX;
  workspace.scrollTop+=after.top+y*next/100-e.clientY;
}
$('workspace').addEventListener('wheel',wheelZoom,{passive:false});
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
function stroke(a,b){ctx.strokeStyle=tool==='eraser'?'#ffffff':color;ctx.lineWidth=size;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
function shape(p){ctx.putImageData(snapshot,0,0);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=size;ctx.lineCap='round';ctx.beginPath();if(tool==='line'){ctx.moveTo(start.x,start.y);ctx.lineTo(p.x,p.y)}else if(tool==='rect'){ctx.rect(start.x,start.y,p.x-start.x,p.y-start.y)}else{ctx.ellipse((start.x+p.x)/2,(start.y+p.y)/2,Math.abs(p.x-start.x)/2,Math.abs(p.y-start.y)/2,0,0,Math.PI*2)}if($('solid').checked&&tool!=='line')ctx.fill();else ctx.stroke()}
function flood(p){const w=canvas.width,h=canvas.height,x=Math.floor(p.x),y=Math.floor(p.y);if(x<0||x>=w||y<0||y>=h)return;const img=ctx.getImageData(0,0,w,h),d=img.data,i=(y*w+x)*4,target=Array.from(d.slice(i,i+4)),rgb=color.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16));if(target.every((v,k)=>v===[...rgb,255][k]))return;remember();const visited=new Uint8Array(w*h),stack=[y*w+x];const match=j=>target.every((v,k)=>Math.abs(d[j+k]-v)<=12);while(stack.length){const n=stack.pop(),j=n*4;if(visited[n]||!match(j))continue;visited[n]=1;d[j]=rgb[0];d[j+1]=rgb[1];d[j+2]=rgb[2];d[j+3]=255;const px=n%w;if(px>0&&match(j-4))stack.push(n-1);if(px<w-1&&match(j+4))stack.push(n+1);if(n>=w&&match(j-w*4))stack.push(n-w);if(n<w*(h-1)&&match(j+w*4))stack.push(n+w)}ctx.putImageData(img,0,0)}
canvas.onpointerdown=e=>{if(e.button!==0)return;const p=point(e);if(tool==='picker'){const d=ctx.getImageData(Math.min(canvas.width-1,Math.max(0,Math.floor(p.x))),Math.min(canvas.height-1,Math.max(0,Math.floor(p.y))),1,1).data;setColor('#'+Array.from(d.slice(0,3)).map(v=>v.toString(16).padStart(2,'0')).join(''));selectTool('brush');return}if(tool==='fill'){flood(p);return}if(tool==='text'){textPoint=p;$('textDialog').showModal();$('textInput').focus();return}remember();drawing=true;start=last=p;snapshot=ctx.getImageData(0,0,canvas.width,canvas.height);canvas.setPointerCapture(e.pointerId);if(tool==='brush'||tool==='eraser')stroke(p,{x:p.x+.01,y:p.y})};
canvas.onpointermove=e=>{const p=point(e);$('coords').textContent=`${Math.round(p.x)}, ${Math.round(p.y)} px`;if(!drawing)return;if(tool==='brush'||tool==='eraser'){stroke(last,p);last=p}else shape(p)};
function end(){drawing=false;snapshot=null}canvas.onpointerup=end;canvas.onpointercancel=end;
$('textDialog').onclose=()=>{if($('textDialog').returnValue!=='ok'||!$('textInput').value.trim())return;remember();const fs=Math.min(240,Math.max(8,Number($('fontSize').value)||32));ctx.font=`${fs}px "Microsoft YaHei", sans-serif`;ctx.fillStyle=color;ctx.textBaseline='top';$('textInput').value.split('\n').forEach((line,i)=>ctx.fillText(line,textPoint.x,textPoint.y+i*fs*1.3));$('textInput').value=''};
$('save').onclick=()=>{canvas.toBlob(blob=>{if(!blob){toast('保存失败，请重试');return}const url=URL.createObjectURL(blob),a=document.createElement('a');a.download=$('filename').textContent.replace(/\.[^.]+$/,'')+'.png';a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);dirty=false;toast('已导出 PNG 图片')},'image/png')};
$('new').onclick=()=>{if(dirty&&!confirm('当前作品尚未保存。确定新建画布吗？'))return;remember();canvas.width=1200;canvas.height=760;white();$('filename').textContent='未命名作品';fit()};
$('open').onclick=()=>$('file').click();$('file').onchange=e=>{const file=e.target.files[0];if(!file)return;if(dirty&&!confirm('打开图片会替换当前画布，是否继续？')){e.target.value='';return}const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{if(img.width*img.height>16000000){toast('图片过大，请使用不超过 1600 万像素的图片');URL.revokeObjectURL(url);return}remember();canvas.width=img.width;canvas.height=img.height;white();ctx.drawImage(img,0,0);$('filename').textContent=file.name;URL.revokeObjectURL(url);fit();toast('图片已打开')};img.onerror=()=>{URL.revokeObjectURL(url);toast('无法读取这张图片')};img.src=url;e.target.value=''};
$('resize').onclick=()=>{const answer=prompt('输入画布尺寸：宽 × 高（每边 1–4000 像素）',`${canvas.width} x ${canvas.height}`);if(answer===null)return;const m=answer.match(/^\s*(\d+)\s*[x×*,， ]\s*(\d+)\s*$/i);if(!m||+m[1]<1||+m[2]<1||+m[1]>4000||+m[2]>4000){toast('请输入有效尺寸，例如 1200 x 760');return}const old=state();remember();canvas.width=+m[1];canvas.height=+m[2];white();ctx.putImageData(old.data,0,0);fit()};
window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName)||$('textDialog').open)return;if(e.ctrlKey||e.metaKey){if(e.key.toLowerCase()==='z'){e.preventDefault();(e.shiftKey?$('redo'):$('undo')).click()}if(e.key.toLowerCase()==='y'){e.preventDefault();$('redo').click()}if(e.key.toLowerCase()==='s'){e.preventDefault();$('save').click()}return}const keys={b:'brush',e:'eraser',f:'fill',i:'picker',t:'text',l:'line',r:'rect',o:'ellipse'};if(keys[e.key.toLowerCase()])selectTool(keys[e.key.toLowerCase()])});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});window.addEventListener('resize',layout);white();buttons();requestAnimationFrame(fit);
