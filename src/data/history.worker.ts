import { chartReckonings } from '@engine/board';
self.onmessage=event=>{try{self.postMessage({points:chartReckonings(event.data.data,event.data.board,event.data.symbol)});}catch(error){self.postMessage({error:String(error)});}};
