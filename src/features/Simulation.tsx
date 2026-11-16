"use client";
import { useEffect, useRef, useState } from "react";
import { RotateCcw, Pause, Play, Map, Eye, Layers, Radio, Thermometer, Wind, Activity } from "lucide-react";
// Original simulation modules are reused directly, not embedded in an iframe.
// @ts-ignore - imported original JavaScript engine
import { SimulationEngine, SCENARIOS } from "./simulation/core/engine.js";
// @ts-ignore - imported original Three.js renderer
import { createForest } from "./simulation/core/forest.js";
import styles from "./Simulation.module.css";
import { useDashboard } from "@/hooks/useDashboard";
import { overlayLiveTelemetry, liveNodeMap } from "./simulation/liveAdapter";

type NodeInfo = {id:string;name:string;location:string;temp:number;humidity:number;gas:number;motion:boolean;online:boolean;link:string;battery:number|null};
type SimState = {phase:string;scenario:string;running:boolean;speed:number;elapsed:number;nodes:NodeInfo[];gatewayOnline:boolean;delivered:number;dropped:number;buffered:number;risk:{score:number;level:string};events:{id?:string;message?:string;description?:string;type?:string}[]};
type ForestView = {update:(state:unknown)=>void;resetView:()=>void;topView:()=>void;setLayer:(layer:string,enabled:boolean)=>void;dispose:()=>void};
export function Simulation() {
 const {data, settings} = useDashboard();
 const liveMode = settings.mode === "live";
 const [now, setNow] = useState(() => Date.now());
 useEffect(() => {
   if (!liveMode) return;
   const timer = setInterval(() => setNow(Date.now()), 1000);
   return () => clearInterval(timer);
 }, [liveMode]);
 const mount = useRef<HTMLDivElement>(null);
 const engine = useRef<InstanceType<typeof SimulationEngine>|null>(null);
 const forest = useRef<ForestView|null>(null);
 const selectedRef = useRef('n1');
 const [selected,setSelected] = useState('n1');
 const [snapshot,setSnapshot] = useState<SimState|null>(null);
 const [layers,setLayers] = useState({links:true,labels:true,coverage:false});
 useEffect(()=>{
  if(!mount.current)return;
  const simulation = new SimulationEngine(); engine.current=simulation;
  let alive=true;
  const scene = createForest(mount.current,{onSelect:(id:string)=>{selectedRef.current=id;setSelected(id);scene.update({...simulation.getState(),selectedNode:id});}}) as ForestView;
  forest.current=scene;
  const unsubscribe=simulation.subscribe((state:SimState)=>{if(alive){setSnapshot({...state,nodes:[...state.nodes],events:[...state.events]});scene.update({...state,selectedNode:selectedRef.current});}});
  let frame=0,last=performance.now(),lastUI=0;
  const animate=(now:number)=>{const dt=Math.min((now-last)/1000,.15);last=now;simulation.tick(dt);if(now-lastUI>220){const s=simulation.getState();setSnapshot({...s,nodes:[...s.nodes],events:[...s.events]});scene.update({...s,selectedNode:selectedRef.current});lastUI=now;}frame=requestAnimationFrame(animate);};
  frame=requestAnimationFrame(animate);
  return()=>{alive=false;cancelAnimationFrame(frame);unsubscribe();scene.dispose();forest.current=null;engine.current=null;};
 },[]);
 useEffect(()=>{if(snapshot)forest.current?.update({...snapshot,selectedNode:selectedRef.current});},[selected,snapshot]);
 const chooseScenario=(id:string)=>{const item=SCENARIOS.find((s:{id:string;proposedOnly:boolean})=>s.id===id);if(item?.proposedOnly&&snapshot?.phase!=='proposed')engine.current?.setPhase('proposed');engine.current?.trigger(id);};
 const display = snapshot && liveMode ? overlayLiveTelemetry(snapshot, data, liveNodeMap, now) : snapshot;
 const node=display?.nodes.find(n=>n.id===selected);
 useEffect(() => {
   if (display) forest.current?.update({...display, selectedNode:selectedRef.current});
 }, [display, liveMode]);
 const selectedLive = liveMode ? data.nodes.find(n=>n.id===liveNodeMap[selected]) : undefined;
 const toggleLayer=(name:keyof typeof layers)=>{const enabled=!layers[name];setLayers(old=>({...old,[name]:enabled}));forest.current?.setLayer(name,enabled);};
 return <div className={styles.root}>
  <div className={styles.intro}><div><div className={styles.eyebrow}>FOREST INTELLIGENCE / DIGITAL TWIN</div><h2>Interactive forest surveillance</h2><p>Explore sensor stations, wireless routes and simulated environmental events within the VanDoot workspace.</p></div><span className={styles.demo}>{liveMode ? "● LIVE TELEMETRY OVERLAY" : "● DEMO SIMULATION"}</span></div>
  <div className={styles.stats}>
   <div className={styles.stat}><span>Sensor stations</span><strong>{snapshot?.nodes.length??'—'}</strong><small>{display?.nodes.filter(n=>n.online).length??0} modeled online</small></div>
   <div className={styles.stat}><span>Gateway</span><strong>{snapshot?.gatewayOnline?'Online':'Offline'}</strong><small>{liveMode ? "Simulation gateway (not live)" : "Illustrative connectivity"}</small></div>
   <div className={styles.stat}><span>Risk level</span><strong>{snapshot?.risk.level??'—'}</strong><small>Simulated risk; not fire confirmation</small></div>
   <div className={styles.stat}><span>Packets delivered</span><strong>{snapshot?.delivered??0}</strong><small>{snapshot?.dropped??0} dropped</small></div>
  </div>
  <div className={styles.layout}>
   <section className={styles.scenePanel}>
    <div className={styles.panelHead}><div><strong>3D Forest Network</strong><small>Drag to orbit · Scroll to zoom · Select a node</small></div><div className={styles.actions}><button onClick={()=>forest.current?.resetView()} title="Reset camera"><RotateCcw size={15}/></button><button onClick={()=>forest.current?.topView()} title="Top-down view"><Map size={15}/></button><button onClick={()=>engine.current?.setRunning(!snapshot?.running)} title={snapshot?.running?'Pause':'Play'}>{snapshot?.running?<Pause size={15}/>:<Play size={15}/>}</button></div></div>
    <div ref={mount} className={styles.forest}></div>
    <div className={styles.sceneFooter}><div className={styles.actions}><button className={layers.links?styles.active:''} onClick={()=>toggleLayer('links')}><Radio size={14}/> Links</button><button className={layers.labels?styles.active:''} onClick={()=>toggleLayer('labels')}><Eye size={14}/> Labels</button><button className={layers.coverage?styles.active:''} onClick={()=>toggleLayer('coverage')}><Layers size={14}/> Coverage</button></div><select aria-label="Simulation speed" value={snapshot?.speed??1} onChange={e=>engine.current?.setSpeed(Number(e.target.value))}><option value={1}>1× speed</option><option value={2}>2× speed</option><option value={4}>4× speed</option></select></div>
   </section>
   <aside className={styles.side}>
    <section className={styles.panel}><div className={styles.panelHead}><strong>Scenario lab</strong><button onClick={()=>engine.current?.reset()} title="Reset simulation"><RotateCcw size={15}/></button></div><div className={styles.phase}><button className={snapshot?.phase==='prototype'?styles.active:''} onClick={()=>engine.current?.setPhase('prototype')}>Prototype</button><button className={snapshot?.phase==='proposed'?styles.active:''} onClick={()=>engine.current?.setPhase('proposed')}>Proposed</button></div><div className={styles.scenarios}>{SCENARIOS.map((s:{id:string;label:string;proposedOnly:boolean})=><button key={s.id} onClick={()=>chooseScenario(s.id)} className={snapshot?.scenario===s.id?styles.active:''}>{s.label}{s.proposedOnly&&<small>Planned</small>}</button>)}</div></section>
    <section className={styles.panel}><div className={styles.panelHead}><strong>Selected sensor station</strong><small>{liveMode ? "Live readings / stale status" : "Modeled readings"}</small></div><select className={styles.nodeSelect} value={node?.id??'n1'} onChange={e=>{selectedRef.current=e.target.value;setSelected(e.target.value);}}>{snapshot?.nodes.map(n=><option key={n.id} value={n.id}>{n.name} — {n.location}</option>)}</select>{node?<div className={styles.readings}><div><Thermometer size={16}/> Temperature <b>{(Number.isFinite(node.temp) ? node.temp.toFixed(1) : '—')} °C</b></div><div><Wind size={16}/> Humidity <b>{(Number.isFinite(node.humidity) ? node.humidity.toFixed(0) : '—')}%</b></div><div><Activity size={16}/> Gas (raw) <b>{(Number.isFinite(node.gas) ? node.gas.toFixed(0) : '—')}</b></div><div><Radio size={16}/> Link <b>{liveMode && !selectedLive ? 'Unmapped' : node.online ? node.link.toUpperCase() : 'Offline'}</b></div></div>:<p>Loading sensors…</p>}</section>
   </aside>
  </div>
  <p className={styles.notice}>The forest, network scenarios, packet counters and risk score remain simulated. In Live mode, mapped sensor readings and online status come from the existing dashboard telemetry. Unmapped and stale nodes are shown offline; no demo values are substituted for missing live telemetry. This is not a certified fire alarm.</p>
 </div>;
}
