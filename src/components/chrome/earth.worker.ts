import {renderEarth,type EarthState} from './earth-renderer';
let renderer:ReturnType<typeof renderEarth>|undefined;
self.onmessage=(event:MessageEvent<{canvas?:OffscreenCanvas;state:EarthState}>)=>{
 try{if(event.data.canvas)renderer=renderEarth(event.data.canvas,event.data.state,()=>self.postMessage('ready'));else renderer?.update(event.data.state);}
 catch{self.postMessage('unavailable');}
};
