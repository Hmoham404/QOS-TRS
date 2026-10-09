import React,{useState} from 'react';
import { RotateCcw, RotateCw, Box } from 'lucide-react';

function Block({name,w,h,d,x,y,z,color,children}){
 return <div className={`press-block ${name||''}`} style={{'--w':w+'px','--h':h+'px','--d':d+'px','--half':d/2+'px','--color':color,width:w,height:h,transform:`translate3d(${x}px,${y}px,${z}px)`}}><span className="face front">{children}</span><span className="face back"/><span className="face left"/><span className="face right"/><span className="face top"/><span className="face bottom"/></div>;
}
export default function PressScene(){
 const [angle,setAngle]=useState(-28);
 return <div className="press-scene"><div className="scene-caption"><Box size={14}/><span>PRESSE À INJECTER</span><span className="scene-3d">3D</span></div><div className="scene-perspective" aria-label="Représentation illustrative en trois dimensions d’une presse à injecter" role="img"><div className="scene-orbit" style={{transform:`rotateX(-18deg) rotateY(${angle}deg)`}}><div className="scene-ground"/>
  <Block name="foot" w={34} h={20} d={76} x={26} y={168} z={0} color="#132f43"/><Block name="foot" w={34} h={20} d={76} x={251} y={168} z={0} color="#132f43"/>
  <Block name="machine-base" w={326} h={52} d={104} x={0} y={119} z={0} color="#245468"><span className="base-vents">||||||||||||||</span><span className="machine-brand">QOS / INJECTION</span></Block>
  <Block name="clamp-back" w={17} h={96} d={85} x={24} y={22} z={0} color="#608d9a"/>
  <Block name="clamp" w={20} h={92} d={84} x={116} y={26} z={0} color="#81a8ae"/>
  <Block name="tie-bar" w={89} h={5} d={5} x={38} y={37} z={36} color="#c2d9d8"/><Block name="tie-bar" w={89} h={5} d={5} x={38} y={98} z={36} color="#bad3d2"/>
  <Block name="mold" w={38} h={60} d={64} x={62} y={45} z={0} color="#40b9a3"><span className="mold-line"/></Block>
  <Block name="guard" w={123} h={104} d={5} x={18} y={18} z={52} color="#0d5262"><span className="guard-window"><span>INJECTION UNIT</span><i/><i/><i/></span></Block>
  <Block name="barrel" w={110} h={26} d={28} x={142} y={74} z={0} color="#a6b6b7"><span className="barrel-rings">│ │ │ │ │</span></Block>
  <Block name="motor" w={56} h={57} d={62} x={252} y={59} z={0} color="#246c75"><span className="motor-lines">||||||||</span></Block>
  <Block name="hopper-base" w={17} h={31} d={22} x={208} y={45} z={0} color="#a7c0c2"/>
  <Block name="hopper" w={40} h={37} d={39} x={197} y={10} z={0} color="#d0dfdf"><span className="hopper-label">01</span></Block>
  <Block name="control" w={32} h={66} d={17} x={286} y={51} z={64} color="#396576"><span className="control-screen"><i/><i/><i/></span><span className="control-buttons">● ●</span></Block>
 </div></div><div className="scene-footer"><span>Vue illustrative · sans télémétrie</span><div><button type="button" aria-label="Tourner la presse à gauche" onClick={()=>setAngle(a=>Math.max(-65,a-15))} disabled={angle<=-65}><RotateCcw size={15}/></button><button type="button" aria-label="Tourner la presse à droite" onClick={()=>setAngle(a=>Math.min(35,a+15))} disabled={angle>=35}><RotateCw size={15}/></button></div></div></div>;
}
