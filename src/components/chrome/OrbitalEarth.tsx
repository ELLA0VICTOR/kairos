import { memo, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const vertex = `attribute vec2 position; varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragment = `precision highp float;
varying vec2 uv;
uniform sampler2D dayMap; uniform sampler2D nightMap;
uniform float aspect; uniform float angle; uniform vec2 pointer;
vec3 rotateY(vec3 p,float a){return vec3(cos(a)*p.x+sin(a)*p.z,p.y,-sin(a)*p.x+cos(a)*p.z);}
void main(){
 vec2 p=(uv-.5)*vec2(aspect,1.)*2.;
 float radius=.70; float r=length(p); float z=sqrt(max(0.,radius*radius-r*r));
 vec3 color=vec3(0.); float alpha=0.;
 float halo=exp(-max(0.,r-radius)*37.)*.25;
 if(r>radius){color=vec3(.18,.42,.65)*halo;alpha=halo*.8;}
 if(r<=radius){
  vec3 n=normalize(vec3(p,z));
  float tilt=.22+pointer.y*.07;
  vec3 axis=vec3(n.x,cos(tilt)*n.y+sin(tilt)*n.z,-sin(tilt)*n.y+cos(tilt)*n.z);
  vec3 world=rotateY(axis,angle+pointer.x*.13);
  vec2 tex=vec2(atan(world.z,world.x)/6.2831853+.5,asin(clamp(world.y,-1.,1.))/3.14159265+.5);
  vec3 day=texture2D(dayMap,tex).rgb;
  vec3 night=texture2D(nightMap,tex).rgb;
  vec3 light=normalize(vec3(-.9,.5,1.1));float diffuse=dot(n,light);
  float sun=smoothstep(-.2,.35,diffuse);
  color=day*(.09+.91*max(0.,diffuse)) + night*vec3(1.,.75,.43)*(1.-sun)*.85;
  float ocean=clamp((day.b-day.r)*4.,0.,1.);
  float spec=pow(max(0.,dot(reflect(-light,n),vec3(0.,0.,1.))),28.);
  color+=vec3(.46,.67,.85)*spec*ocean*.38;
  color+=vec3(.18,.43,.70)*pow(1.-n.z,3.)*.45;
  alpha=1.;
 }
 for(int i=0;i<4;i++){
  float f=float(i);vec3 normal=normalize(vec3(sin(f*1.7+.3),cos(f*1.2+.4),.32+f*.13));
  float rz=-(normal.x*p.x+normal.y*p.y)/normal.z;
  float distanceToRing=abs(length(vec3(p,rz))-(.86+f*.052));
  float orbit=1.-smoothstep(.0015,.0045,distanceToRing);
  if(r>radius||rz>z){
   vec3 tint=i==0?vec3(.50,.74,.91):i==1?vec3(.80,.55,.31):i==2?vec3(.41,.69,.52):vec3(.40,.50,.77);
   float opacity=orbit*(.24+.34*smoothstep(-1.,1.,rz));
   color=mix(color,tint,opacity);alpha=max(alpha,opacity);
  }
 }
 gl_FragColor=vec4(color,alpha);
}`;

/** A native WebGL globe. No scene framework, network runtime, or React frame loop. */
export const OrbitalEarth = memo(function OrbitalEarth() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(1.7);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) return;
    let disposed = false, frame = 0, visible = true, angle = angleRef.current, last = 0;
    const target = [0, 0], pointer = [0, 0];
    const shader = (type: number, source: string) => {
      const result = gl.createShader(type)!;
      gl.shaderSource(result, source); gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) { gl.deleteShader(result); return null; }
      return result;
    };
    const vs = shader(gl.VERTEX_SHADER, vertex), fs = shader(gl.FRAGMENT_SHADER, fragment);
    if (!vs || !fs) return;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniforms = { aspect: gl.getUniformLocation(program, 'aspect'), angle: gl.getUniformLocation(program, 'angle'), pointer: gl.getUniformLocation(program, 'pointer') };
    const textures: WebGLTexture[] = [];
    const draw = (ts: number) => {
      if (disposed) return;
      // The slow orbit needs only 30fps; avoid redrawing the full shader at
      // high-refresh display rates. Rotation still uses elapsed time.
      if (!reduced && !paused && last && ts-last<1000/30) {frame=requestAnimationFrame(draw);return;}
      if (visible && !document.hidden) {
        if (!paused && !reduced && last) angle += Math.min(ts-last, 60) * .000018;
        pointer[0]! += (target[0]! - pointer[0]!) * .04; pointer[1]! += (target[1]! - pointer[1]!) * .04;
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.uniform1f(uniforms.aspect,canvas.width/canvas.height);
        gl.uniform1f(uniforms.angle,angle);
        gl.uniform2f(uniforms.pointer,pointer[0]!,pointer[1]!);
        gl.drawArrays(gl.TRIANGLES,0,6);
        angleRef.current=angle;
      }
      last=ts;
      if (!reduced && !paused) frame=requestAnimationFrame(draw);
    };
    const resize = new ResizeObserver(() => {
      const box=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio,1.5);
      canvas.width=Math.max(1,Math.round(box.width*ratio));canvas.height=Math.max(1,Math.round(box.height*ratio));
      if(textures.length===2&&(paused||reduced)) draw(performance.now());
    }); resize.observe(canvas);
    const observer = new IntersectionObserver(([entry])=>{visible=entry?.isIntersecting??false;}); observer.observe(canvas);
    const move = (event: PointerEvent) => {if(reduced||paused)return;const rect=canvas.getBoundingClientRect();target[0]=(event.clientX-rect.left)/rect.width-.5;target[1]=(event.clientY-rect.top)/rect.height-.5;};
    canvas.addEventListener('pointermove',move);
    const images=[new Image(),new Image()];
    images.forEach((image,index)=>{
      image.onload=()=>{
        if(disposed)return;
        const texture=gl.createTexture()!;textures.push(texture);
        gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.uniform1i(gl.getUniformLocation(program,index?'nightMap':'dayMap'),index);
        if(textures.length===2){setReady(true);draw(performance.now());}
      };
      image.src=index?'/media/earth-night.jpg':'/media/earth-day.jpg';
    });
    return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();canvas.removeEventListener('pointermove',move);images.forEach(i=>i.onload=null);textures.forEach(t=>gl.deleteTexture(t));gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);};
  }, [paused,reduced]);

  return <div className="orbital-earth">
    <svg className="star-field" viewBox="0 0 700 550" aria-hidden="true">{Array.from({length:85},(_,i)=><circle key={i} cx={(i*173+43)%700} cy={(i*127+19)%550} r={i%7===0?1:.55} fill="white" opacity={.15+(i%5)*.1}/>)}</svg>
    <div className={`earth-fallback ${ready?'is-ready':''}`} aria-hidden="true"/>
    <canvas ref={canvasRef} aria-label="Slowly rotating Earth with intersecting orbital paths" role="img"/>
    <span className="orbital-label orbital-label-one"><i/>24/7 · ONCHAIN</span>
    <span className="orbital-label orbital-label-two"><i/>NEW YORK · 40.71° N</span>
    {!reduced&&<button className="orbit-control" onClick={()=>setPaused(!paused)} aria-label={paused?'Resume globe motion':'Pause globe motion'}>{paused?'PLAY':'PAUSE'} <span>{paused?'▷':'Ⅱ'}</span></button>}
  </div>;
});
