import { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { type Board } from '@engine/board';
import { explainedShare } from '@engine/attribute';
import { findAnalogs } from '@engine/analogs';
import type { ArtifactSet } from '@engine/artifacts';
import { initialArtifacts,loadArtifacts } from './artifacts';
import { marketBoard } from './market';
const requested=new URLSearchParams(window.location.search).get('at');
export const replayTs=requested&&Number.isFinite(Date.parse(requested))?Date.parse(requested):undefined;
interface DeskState {data:ArtifactSet;board:Board;loading:boolean;error:string|null;fallbacks:string[];generatedAt:number;retry:()=>void}
const Desk=createContext<DeskState|null>(null);
export function DataProvider({children}:{children:React.ReactNode}){
  const {pathname}=useLocation(),includeLedgers=pathname==='/record'||pathname==='/ask';
  const artifacts=useQuery({queryKey:['artifacts',includeLedgers],queryFn:()=>loadArtifacts(includeLedgers),staleTime:Infinity,retry:1,structuralSharing:false});
  const data=artifacts.data?.data??initialArtifacts;
  const market=useQuery({queryKey:['market',replayTs,artifacts.dataUpdatedAt],enabled:!!artifacts.data,refetchInterval:30000,queryFn:()=>marketBoard(data,replayTs),retry:1,structuralSharing:false});
  // The snapshot already contains computed figures. Avoid repeating the engine on the UI
  // thread just to paint it; fresh calculations arrive from the existing market worker.
  const initial=useMemo<Board>(()=>({ts:data.snapshot.ts,session:data.snapshot.session,news:data.snapshot.news,frame:{ts:data.snapshot.ts,quotes:data.snapshot.rows.map(r=>r.quote),anchors:Object.fromEntries(data.snapshot.rows.map(r=>[r.instrument.symbol,r.reckoning.anchorPrice])),news:data.snapshot.news,candles:{}},rows:data.snapshot.rows.map(row=>{
    const features={absDrift:Math.abs(row.reckoning.drift),drift:row.reckoning.drift,explainedShare:explainedShare(row.reckoning.components),trust:row.reckoning.trust,windowType:data.snapshot.session.state==='holiday'?'holiday' as const:data.snapshot.session.windowDurationMs>30*3600000?'weekend' as const:'overnight' as const,sectorKey:row.instrument.sector,windowProgress:data.snapshot.session.windowProgress,realisedVolRegime:1,newsCategory:null};
    return {...row,features,analogs:findAnalogs(features,[]),path:[]};
  })}),[data]);
  const state:DeskState={data,board:market.data??initial,loading:!market.data&&!market.error,error:market.error?.message??artifacts.error?.message??null,fallbacks:artifacts.data?.fallbacks??[],generatedAt:artifacts.data?.generatedAt??initialArtifacts.snapshot.ts,retry:()=>{void artifacts.refetch();void market.refetch();}};
  return <Desk.Provider value={state}>{children}</Desk.Provider>;
}
export function useDesk():DeskState {const v=useContext(Desk);if(!v)throw new Error('Research data context unavailable');return v;}
export const useReckoning=useDesk;
