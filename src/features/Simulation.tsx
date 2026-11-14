"use client";

import { useState } from "react";
import { ExternalLink, Maximize2, Minimize2 } from "lucide-react";

export function Simulation() {
  const [expanded, setExpanded] = useState(false);
  return (
    <section aria-label="VanDoot forest simulation">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:12}}>
        <p style={{margin:0,opacity:.75,fontSize:13}}>Interactive forest environment · 3D surveillance and network scenarios</p>
        <div style={{display:"flex",gap:8}}>
          <button type="button" className="button" onClick={()=>setExpanded(!expanded)} aria-label={expanded?"Restore simulation size":"Expand simulation"}>
            {expanded?<Minimize2 size={15}/>:<Maximize2 size={15}/>}
            {expanded?"Restore":"Expand"}
          </button>
          <a className="button" href="/simulation/index.html" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15}/> Open in new tab
          </a>
        </div>
      </div>
      <iframe
        title="VanDoot 3D Forest Surveillance Simulation"
        src="/simulation/index.html"
        allow="fullscreen"
        loading="lazy"
        style={{display:"block",width:"100%",height:expanded?"calc(100vh - 135px)":"min(76vh, 860px)",minHeight:500,background:"#0b1414",border:"1px solid rgba(126,180,151,.3)",borderRadius:16}}
      />
    </section>
  );
}
