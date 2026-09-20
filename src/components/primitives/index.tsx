import { Component,useId,type ButtonHTMLAttributes,type ReactNode,type ErrorInfo } from 'react';
export function Button({variant='secondary',className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'quiet'}){return <button {...props} className={`button ${variant} ${className}`}/>;}
export function Tag({children,tone='dim'}:{children:ReactNode;tone?:'dim'|'amber'|'verdigris'|'brass'}){return <span className={`tag tone-${tone}`}>{children}</span>;}
export function Panel({title,children,className=''}:{title:string;children:ReactNode;className?:string}){return <section className={`panel ${className}`}><h2>{title}</h2>{children}</section>;}
export function Field({label,children}:{label:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}</label>;}
export function Tooltip({label,children}:{label:string;children:ReactNode}){const id=useId();return <span className="tooltip"><button className="help" type="button" aria-label={label} aria-describedby={id}>?</button><span role="tooltip" id={id}>{children}</span></span>;}
export function Loading({label}:{label:string}){return <div className="loading" role="status">Loading {label}</div>;}
export function Notice({children,retry}:{children:ReactNode;retry?:()=>void}){return <div className="notice">{children}{retry&&<Button variant="quiet" onClick={retry}>Retry</Button>}</div>;}
export function Table({children,label}:{children:ReactNode;label:string}){return <div className="table-scroll"><table aria-label={label}>{children}</table></div>;}
export class Boundary extends Component<{children:ReactNode;name:string},{error:string|null}>{
  override state:{error:string|null}={error:null};
  static getDerivedStateFromError(error:Error){return {error:error.message};}
  override componentDidCatch(_error:Error,_info:ErrorInfo){}
  override render(){return this.state.error?<Notice retry={()=>this.setState({error:null})}>{this.props.name} could not render: {this.state.error}. Retry this panel.</Notice>:this.props.children;}
}
