/** Decides whether a device should start on the light version instead of the 3D room.
 * The visitor's own choice (`?view=` or the remembered toggle) is applied before this is consulted. */

export interface GpuProbe { webgl: boolean; renderer: string }
export interface DeviceHints { saveData?: boolean; deviceMemory?: number; gpu: GpuProbe }
export type LightReason = "data-saver" | "low-memory" | "no-webgl" | "software-renderer";

/** Renderers that draw in software are an order of magnitude too slow for a shader-heavy room. */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;
export const isSoftwareRenderer = (renderer: string) => SOFTWARE.test(renderer);

export function lightReason({ saveData, deviceMemory, gpu }: DeviceHints): LightReason | null {
  if (saveData) return "data-saver";
  if (deviceMemory !== undefined && deviceMemory <= 2) return "low-memory";
  if (!gpu.webgl) return "no-webgl";
  if (isSoftwareRenderer(gpu.renderer)) return "software-renderer";
  return null;
}

/** One throwaway context, released immediately, so the room's own canvas is not starved of contexts. */
export function probeGpu(doc: Document = document): GpuProbe {
  try {
    const canvas = doc.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { webgl: false, renderer: "" };
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { webgl: true, renderer };
  } catch {
    return { webgl: false, renderer: "" };
  }
}
