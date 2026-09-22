import {ols} from './stats.js';
export interface BetaFit {beta:number;betaStdErr:number;tStat:number|null;nObs:number}
export interface BetaValidation {full:BetaFit;first:BetaFit;last:BetaFit;estimateStability:'stable'|'unstable';reasons:string[];identityAnchor:boolean}
/** Apply one policy to every name; never alter the fitted slope to pass it. */
export function validateBeta(x:number[],y:number[],identityAnchor=false):BetaValidation {
 const fit=(xs:number[],ys:number[]):BetaFit=>{const f=ols(xs,ys);return {beta:f.slope,betaStdErr:f.slopeStdErr,tStat:f.slopeStdErr>0?f.slope/f.slopeStdErr:null,nObs:xs.length};};
 const split=Math.floor(x.length/2),full=fit(x,y);
 if(split<3)return {full,first:full,last:full,estimateStability:'unstable',reasons:['Insufficient sessions for split-half estimation'],identityAnchor};
 const first=fit(x.slice(0,split),y.slice(0,split)),last=fit(x.slice(split),y.slice(split));
 const reasons:string[]=[];
 if(x.length<250)reasons.push('Fewer than 250 matched sessions');
 const significant=(f:BetaFit)=>f.betaStdErr===0?f.beta!==0:Math.abs(f.tStat??0)>=2;
 if(!significant(full))reasons.push('Full-sample slope is not significant');
 if(!significant(first)||!significant(last))reasons.push('A split-half slope is not significant');
 if(Math.sign(first.beta)!==Math.sign(last.beta)||first.beta===0)reasons.push('Split-half slope changes sign or is zero');
 const ratio=Math.abs(last.beta/first.beta);
 if(!Number.isFinite(ratio)||ratio<.5||ratio>2)reasons.push('Split-half magnitude differs by more than a factor of two');
 return {full,first,last,estimateStability:reasons.length?'unstable':'stable',reasons,identityAnchor};
}
