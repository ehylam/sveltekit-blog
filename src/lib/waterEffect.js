import * as THREE from "three";
import { Effect } from "postprocessing";

export class WaterEffect extends Effect {
  constructor(options = {}) {
    super("WaterEffect", fragment, {
      uniforms: new Map([["uTexture", new THREE.Uniform(options.texture)]])
    });
  }
}
export default WaterEffect;

const fragment = `

uniform sampler2D uTexture;


void mainUv(inout vec2 uv) {
        vec4 tex = texture2D(uTexture, uv);
        float angle = -((tex.r) * (3.14159265359 * 2.) - 3.14159265359) ;
        float vx = -(tex.r *2. - 1.);
        float vy = -(tex.g *2. - 1.);
        float intensity = tex.b;
        uv.x += vx * 0.2 * intensity ;
        uv.y += vy * 0.2  *intensity;
        // uv.xy *= 1. - 0.5 * smoothstep( 0., 1., intensity) ;
        // uv.x +=  0.2 * intensity;
        // uv.y +=  0.2  *intensity;
    }


`;
