import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { DayCycleState } from "./dayCycle";

const seed = (n: number) => { const value = Math.sin(n * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };

/** Actual low-poly city depth: 54 instanced buildings and one window batch.
 * No panorama downloads, transmission passes, or individual window lights. */
export default function CartoonWindow({ atmosphere, elapsed }: {
  atmosphere: MutableRefObject<DayCycleState>; elapsed: MutableRefObject<number>;
}) {
  const { gl, invalidate } = useThree();
  const buildings = useRef<THREE.InstancedMesh>(null), windows = useRef<THREE.InstancedMesh>(null);
  const cityMaterial = useRef<THREE.MeshStandardMaterial>(null), windowMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const qa = useMemo(() => new URLSearchParams(window.location.search).has("qa"), []);
  const uniforms = useMemo(() => ({ uDaylight: { value: 0 }, uWarmth: { value: 0 }, uTime: { value: 0 } }), []);
  const colors = useMemo(() => ({ night: new THREE.Color("#344861"), day: new THREE.Color("#c9bda6"), sunset: new THREE.Color("#ba8571") }), []);
  const city = useMemo(() => {
    const blocks: { position: THREE.Vector3; scale: THREE.Vector3; color: THREE.Color }[] = [];
    const lights: { position: THREE.Vector3; scale: THREE.Vector3; color: THREE.Color }[] = [];
    for (let row = 0; row < 3; row++) for (let column = 0; column < 18; column++) {
      const id = row * 18 + column, x = 7.0 + row * 2.6 + seed(id + 1) * .4;
      const z = (column - 8.5) * 1.22 + (row % 2) * .53;
      const width = .65 + seed(id + 3) * .4, depth = .7 + seed(id + 7) * .65;
      const height = 1.4 + row * .65 + seed(id + 11) * (1.4 + row * .5), base = -.9;
      blocks.push({ position: new THREE.Vector3(x, base + height / 2, z), scale: new THREE.Vector3(depth, height, width), color: new THREE.Color().setHSL(.57 + row * .013, .12 + row * .025, .64 - row * .08 + seed(id) * .1) });
      const floors = Math.floor(height / .24);
      for (let floor = 1; floor < floors; floor++) for (let c = 0; c < 3; c++) {
        if (seed(id * 701 + floor * 17 + c) < .39) continue;
        lights.push({ position: new THREE.Vector3(x - depth / 2 - .008, base + floor * .24, z + (c - 1) * width * .25), scale: new THREE.Vector3(.08, .115, 1), color: new THREE.Color(seed(id + floor) > .55 ? "#ffcd86" : "#e7b16b") });
      }
    }
    return { blocks, lights };
  }, []);
  useEffect(() => {
    const object = new THREE.Object3D();
    city.blocks.forEach((block, index) => {
      object.position.copy(block.position); object.scale.copy(block.scale); object.rotation.set(0, 0, 0); object.updateMatrix();
      buildings.current?.setMatrixAt(index, object.matrix); buildings.current?.setColorAt(index, block.color);
    });
    city.lights.forEach((light, index) => {
      object.position.copy(light.position); object.scale.copy(light.scale); object.rotation.set(0, -Math.PI / 2, 0); object.updateMatrix();
      windows.current?.setMatrixAt(index, object.matrix); windows.current?.setColorAt(index, light.color);
    });
    for (const mesh of [buildings.current, windows.current]) if (mesh) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); }
    invalidate(); return () => { if (qa) gl.domElement.dataset.atmosphereReady = "false"; };
  }, [city, gl, invalidate, qa]);
  useFrame(() => {
    const state = atmosphere.current;
    uniforms.uDaylight.value = state.daylight; uniforms.uWarmth.value = state.warmth; uniforms.uTime.value = elapsed.current;
    if (cityMaterial.current) {
      cityMaterial.current.color.copy(colors.night).lerp(colors.day, state.daylight).lerp(colors.sunset, state.warmth * .4);
      cityMaterial.current.emissive.copy(cityMaterial.current.color); cityMaterial.current.emissiveIntensity = .34;
    }
    if (windowMaterial.current) windowMaterial.current.color.setScalar(.24 + (1 - state.daylight) * .76);
    if (qa) {
      gl.domElement.dataset.atmosphereReady = "true"; gl.domElement.dataset.windowDaylight = state.daylight.toFixed(3);
      gl.domElement.dataset.atmosphereTime = elapsed.current.toFixed(3); gl.domElement.dataset.cityGeometry = "instanced-3d";
    }
  });
  return <group name="lightweight-lofi-city">
    <mesh name="cartoon-city-day-night" position={[18, 4.2, 1.2]} rotation={[0, -Math.PI / 2, 0]} raycast={() => null}>
      <planeGeometry args={[42, 25]} />
      <shaderMaterial uniforms={uniforms} toneMapped={false}
        vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`}
        fragmentShader={`precision highp float; varying vec2 vUv; uniform float uDaylight; uniform float uWarmth; uniform float uTime;
          float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float disc(vec2 p,vec2 c,float r){return 1.-smoothstep(r-.001,r+.001,length((p-c)*vec2(1.68,1.)));}
          void main(){
            vec3 night=mix(vec3(.14,.21,.30),vec3(.035,.07,.15),smoothstep(.2,.9,vUv.y));
            vec3 day=mix(vec3(.79,.82,.77),vec3(.33,.58,.72),smoothstep(.15,.85,vUv.y));
            vec3 color=mix(night,day,uDaylight);
            color=mix(color,vec3(.69,.40,.34),uWarmth*(1.-smoothstep(.3,.8,vUv.y))*.65);
            vec2 p=vUv; p.x+=sin(uTime*.018)*.008;
            float cloud=disc(p,vec2(.43,.54),.047)+disc(p,vec2(.47,.55),.04)+disc(p,vec2(.50,.54),.04);
            cloud+=disc(p,vec2(.68,.64),.031)+disc(p,vec2(.70,.65),.035)+disc(p,vec2(.73,.64),.027);
            color=mix(color,mix(vec3(.21,.28,.37),vec3(.92,.89,.79),uDaylight),clamp(cloud,0.,1.)*.55);
            color=mix(color,vec3(1.,.84,.57),disc(vUv,vec2(.58,.62),.014)*uDaylight);
            float moon=max(0.,disc(vUv,vec2(.43,.63),.012)-disc(vUv,vec2(.435,.634),.011));
            color=mix(color,vec3(.91,.91,.81),moon*(1.-uDaylight));
            vec2 cell=floor(vUv*vec2(130.,80.)); float star=(1.-smoothstep(.02,.09,length(fract(vUv*vec2(130.,80.))-.5)))*step(.965,hash(cell));
            color+=star*(1.-uDaylight)*smoothstep(.48,.7,vUv.y)*.35;
            gl_FragColor=vec4(color,1.);
            #include <colorspace_fragment>
          }`} />
    </mesh>
    <instancedMesh ref={buildings} name="city-depth-buildings" args={[undefined, undefined, city.blocks.length]} raycast={() => null}>
      <boxGeometry /><meshStandardMaterial ref={cityMaterial} roughness={1} fog={false} />
    </instancedMesh>
    <instancedMesh ref={windows} name="city-warm-windows" args={[undefined, undefined, city.lights.length]} raycast={() => null}>
      <planeGeometry /><meshBasicMaterial ref={windowMaterial} toneMapped={false} fog={false} />
    </instancedMesh>
    <group position={[10.4, -.9, -1.9]} name="city-landmark">
      <mesh position={[0, .16, 0]}><boxGeometry args={[.7, .32, .7]} /><meshStandardMaterial color="#b8ae96" roughness={1} /></mesh>
      <mesh position={[0, 1.25, 0]}><cylinderGeometry args={[.07, .15, 2.2, 4]} /><meshStandardMaterial color="#c0b59d" emissive="#8d6b42" emissiveIntensity={.18} /></mesh>
      <mesh position={[0, 2.42, 0]}><boxGeometry args={[.38, .14, .38]} /><meshStandardMaterial color="#c0b59d" /></mesh>
      <mesh position={[0, 2.63, 0]}><coneGeometry args={[.105, .30, 6]} /><meshBasicMaterial color="#edbb69" /></mesh>
    </group>
  </group>;
}
