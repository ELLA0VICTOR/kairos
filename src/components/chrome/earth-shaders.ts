export const vertex = `attribute vec2 position; varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
export const fragment = `precision highp float;
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

