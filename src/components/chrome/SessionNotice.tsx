import {useSession} from '@/hooks/useSession';
/** Use the current clock immediately, rather than waiting for refreshed prices. */
export function SessionNotice(){
 const {session}=useSession();
 return session.isDark?null:<p className="session-status" role="status"><span className="status-dot"/><span>{session.state==='extended'?'Extended trading':'Exchange open'}</span><span>Gap forecasts resume when the exchange goes dark.</span></p>;
}
