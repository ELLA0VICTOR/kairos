import {vertex,fragment} from './earth-shaders';
export interface EarthState {width:number;height:number;paused:boolean;reduced:boolean;visible:boolean;x:number;y:number}
export function renderEarth(canvas:HTMLCanvasElement|OffscreenCanvas,initial:EarthState,ready:()=>void){
 const context=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false}) as WebGLRenderingContext|null;
 if(!context)throw new Error('WebGL unavailable');
 const gl:WebGLRenderingContext=context;
 let state=initial,disposed=false,frame=0,angle=1.7,last=0,loaded=false;
 const pointer=[0,0],textures:WebGLTexture[]=[],controller=new AbortController();
 const shader=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Globe shader unavailable');return s;};
 const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment),program=gl.createProgram()!;
 gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Globe shader unavailable');
 gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
 const uniforms={aspect:gl.getUniformLocation(program,'aspect'),angle:gl.getUniformLocation(program,'angle'),pointer:gl.getUniformLocation(program,'pointer')};
 function draw(ts:number){
  frame=0;if(disposed||!loaded||!state.visible)return;
  if(last&&ts-last<1000/30){frame=requestAnimationFrame(draw);return;}
  if(!state.paused&&!state.reduced&&last)angle+=Math.min(ts-last,60)*.000018;
  pointer[0]!+=(state.x-pointer[0]!)*.04;pointer[1]!+=(state.y-pointer[1]!)*.04;
  if(canvas.width!==state.width||canvas.height!==state.height){canvas.width=state.width;canvas.height=state.height;}
  gl.viewport(0,0,canvas.width,canvas.height);gl.uniform1f(uniforms.aspect,canvas.width/canvas.height);gl.uniform1f(uniforms.angle,angle);gl.uniform2f(uniforms.pointer,pointer[0]!,pointer[1]!);gl.drawArrays(gl.TRIANGLES,0,6);last=ts;
  if(!state.paused&&!state.reduced)frame=requestAnimationFrame(draw);
 }
 async function load(){
  for(const [index,url] of ['/media/earth-day.jpg','/media/earth-night.jpg'].entries()){
   const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error('Globe texture unavailable');
   const bitmap=await createImageBitmap(await response.blob(),{imageOrientation:'flipY'});
   if(disposed){bitmap.close();return;}
   const texture=gl.createTexture()!;textures.push(texture);gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,bitmap);bitmap.close();
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.uniform1i(gl.getUniformLocation(program,index?'nightMap':'dayMap'),index);
  }
  loaded=true;draw(performance.now());ready();
 }
 void load().catch(()=>{/* Keep the existing static Earth visible if textures fail. */});
 return {update(next:EarthState){const resume=!state.visible&&next.visible;state=next;if(resume)last=0;if(!frame&&loaded)draw(performance.now());},dispose(){disposed=true;controller.abort();cancelAnimationFrame(frame);textures.forEach(t=>gl.deleteTexture(t));gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);}};
}
