import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Block } from "./materials";
import { setCursorLabel } from "../lib/cursor";

type ProjectionState = { time: number; changedAt: number; brightness: number; dissolve: number };
type ProjectionRef = MutableRefObject<ProjectionState>;
const lens = new THREE.Vector3(.4, -.96, .69);
const screen = new THREE.Vector3(0, .066, .016);
const aim = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), screen.clone().sub(lens).normalize());
const vertexShader = `varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

function ProjectedImage({ src, state, still }: { src: string; state: ProjectionRef; still: boolean }) {
  const texture = useTexture(src);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const previous = useRef<THREE.Texture | null>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uFrom: { value: texture }, uTo: { value: texture },
    uFromAspect: { value: 1 }, uToAspect: { value: 1 },
    uMix: { value: 1 }, uTime: { value: 0 }, uLight: { value: 1 }, uWeave: { value: 0 },
  // The same material retains the outgoing texture until the incoming one loads.
  }), []);
  useEffect(() => {
    if (!material.current) return;
    const uniforms = material.current.uniforms;
    const outgoing = previous.current ?? texture;
    uniforms.uFrom.value = outgoing;
    uniforms.uTo.value = texture;
    uniforms.uFromAspect.value = outgoing.image.width / outgoing.image.height;
    uniforms.uToAspect.value = texture.image.width / texture.image.height;
    if (previous.current !== texture && previous.current) state.current.changedAt = state.current.time;
    if (!previous.current || still) state.current.changedAt = state.current.time - 1;
    previous.current = texture;
  }, [texture, uniforms, state, still]);
  useFrame(() => {
    if (!material.current) return;
    const uniforms = material.current.uniforms;
    const value = state.current;
    uniforms.uMix.value = still ? 1 : value.dissolve;
    uniforms.uTime.value = value.time;
    uniforms.uLight.value = value.brightness;
    uniforms.uWeave.value = still ? 0 : Math.sin(value.dissolve * Math.PI) * .00065;
  });
  return <mesh name="cinematic-projected-photo" position={screen}>
    <planeGeometry args={[1.53, .91]} />
    <shaderMaterial ref={material} uniforms={uniforms} toneMapped={false} vertexShader={vertexShader} fragmentShader={`
      varying vec2 vUv;
      uniform sampler2D uFrom, uTo;
      uniform float uFromAspect, uToAspect, uMix, uTime, uLight, uWeave;
      vec3 photograph(sampler2D photo, float aspect, vec2 uv) {
        vec2 fit = vec2(max(1.0, 1.53 / .91 / aspect), max(1.0, aspect / (1.53 / .91)));
        vec2 sampleUv = (uv - .5) * fit + .5;
        float inside = step(0.0, sampleUv.x) * step(sampleUv.x, 1.0) * step(0.0, sampleUv.y) * step(sampleUv.y, 1.0);
        return mix(vec3(.024, .029, .026), texture2D(photo, clamp(sampleUv, 0.0, 1.0)).rgb, inside);
      }
      void main() {
        vec2 uv = vUv + vec2(sin(uTime * 12.0), cos(uTime * 9.0)) * uWeave;
        vec3 color = mix(photograph(uFrom, uFromAspect, uv), photograph(uTo, uToAspect, uv), uMix);
        float grain = fract(sin(dot(floor(vUv * vec2(1100., 655.)), vec2(12.9898,78.233)) + floor(uTime * 12.)) * 43758.5453) - .5;
        float vignette = 1.0 - .17 * pow(length((vUv - .5) * 1.4), 2.0);
        vec2 edge = smoothstep(vec2(0.), vec2(.012), vUv) * smoothstep(vec2(0.), vec2(.012), 1. - vUv);
        // Raised blacks, warm paper, barely visible grain and softly feathered light.
        color = (color * vec3(1., .955, .875) * .91 + vec3(.016, .013, .008)) * vignette * uLight;
        color += grain * .009;
        gl_FragColor = vec4(mix(vec3(.025, .028, .024), color, edge.x * edge.y), 1.);
        #include <colorspace_fragment>
      }`} />
  </mesh>;
}

function Beam({ state }: { state: ProjectionRef }) {
  const light = useRef<THREE.SpotLight>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => {
    const vertices: number[] = [], uvs: number[] = [];
    // A cone of thin slices with smooth edge extinction, all sharing one draw call.
    for (let i = 0; i < 22; i++) {
      const t = (i + .5) / 22, center = lens.clone().lerp(screen, t);
      const width = .018 + t * .765, height = .012 + t * .455;
      vertices.push(center.x-width,center.y-height,center.z, center.x+width,center.y-height,center.z, center.x+width,center.y+height,center.z,
        center.x-width,center.y-height,center.z, center.x+width,center.y+height,center.z, center.x-width,center.y+height,center.z);
      uvs.push(0,0, 1,0, 1,1, 0,0, 1,1, 0,1);
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    result.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    return result;
  }, []);
  const uniforms = useMemo(() => ({ uLight: { value: 1 } }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    if (material.current) material.current.uniforms.uLight.value = state.current.brightness;
    if (light.current) light.current.intensity = .5 * state.current.brightness;
    if (glow.current) glow.current.opacity = .72 * state.current.brightness;
  });
  return <group name="warm-projector-beam">
    <mesh geometry={geometry} raycast={() => null} renderOrder={2}>
      <shaderMaterial ref={material} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={`
        varying vec2 vUv; uniform float uLight;
        void main() {
          vec2 edge = smoothstep(vec2(0.), vec2(.26), vUv) * smoothstep(vec2(0.), vec2(.26), 1.-vUv);
          gl_FragColor = vec4(1., .77, .46, edge.x * edge.y * .005 * uLight);
        }`} />
    </mesh>
    <primitive object={target} position={screen} />
    <spotLight ref={light} position={lens} target={target} color="#ffdba9" intensity={.5} angle={.75} penumbra={.8} distance={2.3} decay={2} />
    <group position={lens} quaternion={aim}>
      <mesh rotation={[0, Math.PI, 0]}><circleGeometry args={[.027, 24]} /><meshBasicMaterial ref={glow} color="#fff0d2" transparent opacity={.72} toneMapped={false} /></mesh>
    </group>
  </group>;
}

function BeamDust({ state }: { state: ProjectionRef }) {
  const points = useRef<THREE.Points>(null);
  const uniforms = useMemo(() => ({ uLight: { value: 1 } }), []);
  const seeds = useMemo(() => Array.from({ length: 54 }, (_, i) => ({
    depth: .1 + ((i * .61803398875) % 1) * .82,
    x: ((i * .754877666) % 1) * 1.7 - .85, y: ((i * .569840296) % 1) * 1.7 - .85,
  })), []);
  const positions = useMemo(() => new Float32Array(seeds.length * 3), [seeds]);
  // Each mote's place along the beam is fixed; only its drift changes. Precomputed, so the frame loop allocates nothing.
  const centers = useMemo(() => seeds.map(seed => lens.clone().lerp(screen, seed.depth)), [seeds]);
  useFrame(() => {
    if (!points.current) return;
    const time = state.current.time;
    seeds.forEach((seed, i) => {
      const t = seed.depth, center = centers[i];
      positions[i * 3] = center.x + (seed.x + Math.sin(time * .15 + i) * .065) * t * .70;
      positions[i * 3 + 1] = center.y + (seed.y + Math.sin(time * .12 + i * 3) * .065) * t * .42;
      positions[i * 3 + 2] = center.z;
    });
    points.current.geometry.attributes.position.needsUpdate = true;
    (points.current.material as THREE.ShaderMaterial).uniforms.uLight.value = state.current.brightness;
  });
  return <points name="dust-inside-projection" ref={points} raycast={() => null} frustumCulled={false} renderOrder={3}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={uniforms}
      vertexShader={`void main() { vec4 p = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * p; gl_PointSize = clamp(6. / -p.z, 1., 3.); }`}
      fragmentShader={`uniform float uLight; void main() { float a = 1. - smoothstep(.08,.5,length(gl_PointCoord-.5)); gl_FragColor=vec4(1.,.85,.6,a*.30*uLight); }`} />
  </points>;
}

/** One optical system: photograph, light, dust and small lens movement share time. */
export default function CinematicProjection({ src, still, onNext }: { src: string; still: boolean; onNext: () => void }) {
  const state = useRef<ProjectionState>({ time: 0, changedAt: -1, brightness: 1, dissolve: 1 });
  const barrel = useRef<THREE.Group>(null), lastTick = useRef<number | null>(null);
  useEffect(() => {
    const reset = () => { lastTick.current = null; };
    reset(); document.addEventListener("visibilitychange", reset);
    return () => document.removeEventListener("visibilitychange", reset);
  }, [still]);
  useFrame(() => {
    const now = performance.now(), current = state.current;
    if (still || document.hidden) { lastTick.current = null; current.brightness = 1; }
    else {
      if (lastTick.current !== null) current.time += (now - lastTick.current) / 1000;
      lastTick.current = now;
      current.dissolve = THREE.MathUtils.smoothstep(current.time - current.changedAt, 0, .9);
      // Low amplitude, aperiodic film transport; never a strobe or hard blackout.
      const transport = Math.sin(current.dissolve * Math.PI);
      current.brightness = 1 + Math.sin(current.time * 17.3) * .006 + Math.sin(current.time * 27.1) * .004 - transport * .045;
    }
    if (barrel.current) barrel.current.position.z = still ? 0 : Math.sin(current.dissolve * Math.PI) * .0018;
  }, -.5);
  return <group name="cinematic-projection-system">
    <Suspense fallback={null}><ProjectedImage src={src} state={state} still={still} /></Suspense>
    <Beam state={state} /><BeamDust state={state} />
    <group name="physical-projector" position={[.4, -1.06, .83]} onClick={event => { event.stopPropagation(); onNext(); }}
      onPointerOver={event => { event.stopPropagation(); setCursorLabel("Next photo"); }} onPointerOut={() => setCursorLabel("")}>
      <Block size={[.33, .15, .28]} color="#bfb6a3" roughness={.56} radius={.024} />
      <Block position={[0, .079, .014]} size={[.275, .009, .2]} color="#344042" radius={.012} />
      {Array.from({ length: 7 }, (_, i) => <Block key={i} position={[-.13, -.035 + i * .011, .035]} size={[.08, .004, .15]} color="#24313a" radius={.001} />)}
      {[-1, 1].map(side => <Block key={side} position={[side * .114, -.095, .04]} size={[.05, .042, .13]} color="#243238" radius={.007} />)}
      <mesh position={[.105, .085, .048]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.006, 12]} /><meshBasicMaterial color="#abcdb4" /></mesh>
    </group>
    <group position={lens} quaternion={aim}><group ref={barrel}>
      <mesh position={[0, 0, .026]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.045, .047, .053, 32]} /><meshStandardMaterial color="#26343a" metalness={.7} roughness={.3} /></mesh>
      <mesh><torusGeometry args={[.033, .006, 8, 32]} /><meshStandardMaterial color="#ac9576" metalness={.72} roughness={.28} /></mesh>
    </group></group>
    <Block position={[.4, -1.188, .82]} size={[.54, .037, .44]} color="#8d7153" roughness={.6} />
    {[-.20, .20].map(x => <Block key={x} position={[.4 + x, -1.354, .82]} size={[.025, .30, .30]} color="#35444a" metalness={.65} radius={.005} />)}
  </group>;
}
