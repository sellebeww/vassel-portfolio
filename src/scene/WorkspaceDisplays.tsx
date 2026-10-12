import type { MutableRefObject } from "react";
import { monitorOf } from "../data/portfolio";
import MonitorPortfolio from "./MonitorPortfolio";
import { Block, type V3 } from "./materials";

type DisplayProps = { progress: MutableRefObject<number>; selected: number; still: boolean };

function Monitor({ index, progress, still, focus, position, yaw = 0, active = false }: { index: number; progress: MutableRefObject<number>; still: boolean; focus: number; position: V3; yaw?: number; active?: boolean }) {
  return <group name={`desk-monitor-${index + 1}`} position={position} rotation={[0, yaw, 0]}>
    <Block position={[0, -.592, -.02]} size={[.37, .022, .22]} color="#283038" metalness={.68} roughness={.34} radius={.008} />
    <Block position={[0, -.393, -.025]} size={[.047, .394, .041]} color="#263139" metalness={.72} roughness={.3} radius={.008} />
    <Block position={[0, -.165, -.032]} size={[.116, .185, .038]} color="#1c252c" metalness={.4} roughness={.56} radius={.016} />
    <Block size={[.875, .576, .039]} color="#151f2a" metalness={.55} roughness={.37} radius={.012} />
    {/* The glass is a plain dark panel; the projects are drawn over it (MonitorPortfolio). */}
    <mesh position={[0, .004, .022]}><planeGeometry args={[.845, .528125]} /><meshBasicMaterial color="#0a1117" toneMapped={false} /></mesh>
    <MonitorPortfolio index={index} progress={progress} still={still} focus={focus} />
    <mesh position={[.39, -.278, .022]}><circleGeometry args={[.0018, 10]} /><meshBasicMaterial color={active ? "#b0cebe" : "#6e9a9e"} toneMapped={false} /></mesh>
    <Block position={[0, -.279, .024]} size={[.071, .003, .001]} color="#78828a" radius={.001} />
  </group>;
}

/** Three actual monitors, each carrying its own share of the projects. */
export default function WorkspaceDisplays({ progress, selected, still }: DisplayProps) {
  return <group name="triple-screen-workspace">
    <Monitor index={0} progress={progress} still={still} focus={selected} position={[1.56, 1.409, -.50]} yaw={.16} active={monitorOf(selected) === 0} />
    <Monitor index={1} progress={progress} still={still} focus={selected} position={[2.44, 1.409, -.56]} active={monitorOf(selected) === 1} />
    <Monitor index={2} progress={progress} still={still} focus={selected} position={[3.32, 1.409, -.50]} yaw={-.16} active={monitorOf(selected) === 2} />
  </group>;
}
