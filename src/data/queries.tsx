import { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { computeBoard, type Board, type MarketFrame } from '@engine/board';
import { getSessionInfo } from '@engine/calendar';
import type { ArtifactSet } from '@engine/artifacts';
import { getProvider } from './providers';
import { initialArtifacts,loadArtifacts } from './artifacts';
import { marketBoard } from './market';
const requested=new URLSearchParams(window.location.search).get('at');
export const replayTs=requested&&Number.isFinite(Date.parse(requested))?Date.parse(requested):undefined;
const initialFrame:MarketFrame={ts:initialArtifacts.snapshot.ts,quotes:initialArtifacts.snapshot.rows.map(r=>r.quote),anchors:Object.fromEntries(initialArtifacts.snapshot.rows.map(r=>[r.instrument.symbol,r.reckoning.anchorPrice])),news:initialArtifacts.snapshot.news,candles:{}};
interface DeskState {data:ArtifactSet;board:Board;loading:boolean;error:string|null;fallbacks:string[];generatedAt:number;retry:()=>void}
const Desk=createContext<DeskState|null>(null);
export function DataProvider({children}:{children:React.ReactNode}){
  const artifacts=useQuery({queryKey:['artifacts'],queryFn:loadArtifacts,staleTime:Infinity,retry:1});
  const data=artifacts.data?.data??initialArtifacts;
  const market=useQuery({queryKey:['market',replayTs,artifacts.dataUpdatedAt],enabled:!!artifacts.data,refetchInterval:30000,queryFn:()=>marketBoard(data,replayTs),retry:1});
  const initial=useMemo(()=>computeBoard(data,initialFrame,false),[data]);
  const state:DeskState={data,board:market.data??initial,loading:!market.data&&!market.error,error:market.error?.message??artifacts.error?.message??null,fallbacks:artifacts.data?.fallbacks??[],generatedAt:artifacts.data?.generatedAt??initialArtifacts.snapshot.ts,retry:()=>{void artifacts.refetch();void market.refetch();}};
  return <Desk.Provider value={state}>{children}</Desk.Provider>;
}
export function useDesk():DeskState {const v=useContext(Desk);if(!v)throw new Error('Research data context unavailable');return v;}
export const useReckoning=useDesk;
