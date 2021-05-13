import * as THREE from 'three';
import gsap from 'gsap';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing//UnrealBloomPass.js';

// import image from '/images/texture.png';

const vertexShader = `
uniform float time;
uniform float hoverState;
varying vec2 vUv;
varying vec3 vPosition;


float PI = 3.141592653589793238;

vec4 permute(vec4 x){return mod(x*x*34.+x,289.);}
float snoise(vec3 v){
  const vec2 C = 1./vec2(6,3);
  const vec4 D = vec4(0,.5,1,2);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1. - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.x;
  vec3 x2 = x0 - i2 + C.y;
  vec3 x3 = x0 - D.yyy;
  i = mod(i,289.);
  vec4 p = permute( permute( permute(
	  i.z + vec4(0., i1.z, i2.z, 1.))
	+ i.y + vec4(0., i1.y, i2.y, 1.))
	+ i.x + vec4(0., i1.x, i2.x, 1.));
  vec3 ns = .142857142857 * D.wyz - D.xzx;
  vec4 j = p - 49. * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = floor(j - 7. * x_ ) *ns.x + ns.yyyy;
  vec4 h = 1. - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 sh = -step(h, vec4(0));
  vec4 a0 = b0.xzyw + (floor(b0)*2.+ 1.).xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + (floor(b1)*2.+ 1.).xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = inversesqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.);
  return .5 + 12. * dot( m * m * m, vec4( dot(p0,x0), dot(p1,x1),dot(p2,x2), dot(p3,x3) ) );
}

vec3 snoiseVec3( vec3 x ){
  return vec3(  snoise(vec3( x )*2.-1.),
								snoise(vec3( x.y - 19.1 , x.z + 33.4 , x.x + 47.2 ))*2.-1.,
								snoise(vec3( x.z + 74.2 , x.x - 124.5 , x.y + 99.4 )*2.-1.)
	);
}

vec3 curlNoise( vec3 p ){
  const float e = .1;
  vec3 dx = vec3( e   , 0.0 , 0.0 );
  vec3 dy = vec3( 0.0 , e   , 0.0 );
  vec3 dz = vec3( 0.0 , 0.0 , e   );

  vec3 p_x0 = snoiseVec3( p - dx );
  vec3 p_x1 = snoiseVec3( p + dx );
  vec3 p_y0 = snoiseVec3( p - dy );
  vec3 p_y1 = snoiseVec3( p + dy );
  vec3 p_z0 = snoiseVec3( p - dz );
  vec3 p_z1 = snoiseVec3( p + dz );

  float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
  float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
  float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;

  const float divisor = 1.0 / ( 2.0 * e );
  return normalize( vec3( x , y , z ) * divisor );
}

void main() {
  vUv = uv;

  vec3 distortion = hoverState * vec3(position.x * 2., position.y, 1.)*curlNoise(vec3(position.x * 0.004 + time * 0.005,position.y * 0.004,time*0.02));
  vec3 finalPosition = position + distortion;

  vec4 mvPosition = modelViewMatrix * vec4( finalPosition, 1 );
  gl_PointSize = 2.;
  gl_Position = projectionMatrix * mvPosition;
}
`;


const fragmentShader = `
varying vec2 vUv;
// uniform sampler2D t;
varying vec3 vPosition;

void main()	{
    // texture2D({texel}, {coord})
    // vec4 tt = texture2D(t, vUv); // returns a texel (colour) of the texture for the given coordinates.
	gl_FragColor = vec4(vUv,0.,1.);
}
`;


export default class Video {
    constructor(options) {
        this.scene = new THREE.Scene();
        this.image = document.querySelector('.jp');
        this.container = options.dom;
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.setSize(this.width, this.height);
        this.renderer.setClearColor(0xffffff, 0);
        this.container.appendChild(this.renderer.domElement);
        this.el = document.querySelector('.nav__holo');
        this.timeline = gsap.timeline();


        this.camera = new THREE.PerspectiveCamera(
          70,
          window.innerWidth / window.innerHeight,
          0.001,
          1500
        );

        // var frustumSize = 10;
        // var aspect = window.innerWidth / window.innerHeight;
        // this.camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / - 2, -1000, 1000 );
        this.camera.position.set(0, 0, 1500);
        this.time = 0;

        this.isPlaying = true;

        this.addPost();
        this.addObjects();
        this.resize();
        this.render();
        this.setupResize();
        // this.settings();
      }

      settings() {
      }

      setupResize() {
        window.addEventListener("resize", this.resize.bind(this));
      }

      resize() {
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;
        this.renderer.setSize(this.width, this.height);
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.composer.setSize(this.width, this.height);
      }

      addObjects() {
        let that = this;
        this.material = new THREE.ShaderMaterial({
          extensions: {
            derivatives: "#extension GL_OES_standard_derivatives : enable"
          },
          side: THREE.DoubleSide,
          uniforms: {
            time: { value: 0 },
            // texture: { value: new THREE.TextureLoader().load(image) },
            resolution: { value: new THREE.Vector4() },
            hoverState: { value: 0 }
          },
          // wireframe: true,
          // transparent: true,
          vertexShader: vertexShader,
          fragmentShader: fragmentShader
        });

        this.geometry = new THREE.PlaneGeometry(300* 2.77, 150 * 2.75, 300, 150);

        this.plane = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.plane);

        // To future Eric.... use gallery like function passing different image during peak of animation so
        // on 'mouseleave' it will show a different image.

        // Bug: TODO - Prevent stacked mouse enters
        this.el.addEventListener('mouseenter', () => {
          this.timeline.to(this.material.uniforms.hoverState, {
              duration: 1,
              value: 1
          })
          .to(this.bloomPass, {
            duration: 1,
            strength: 1
          },0.2)
          .to(this.bloomPass, {
            duration: 0.6,
            strength: 0,
            delay: 2
          })
          .to(this.material.uniforms.hoverState, {
            duration: 0.6,
            value: 0
          })
        })


      }

      addPost() {
        this.renderScene = new RenderPass(this.scene, this.camera);
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2( window.innerWidth, window.innerHeight),1.5, 0.4, 0.84);

        this.bloomPass.threshold = 0;
        this.bloomPass.strength = 0;
        this.bloomPass.radius = 0;
        this.bloomPass.exposure = 1;

        this.composer = new EffectComposer( this.renderer );
        this.composer.addPass(this.renderScene);
        this.composer.addPass(this.bloomPass);
      }

      stop() {
        this.isPlaying = false;
      }

      play() {
        if(!this.isPlaying){
          this.render()
          this.isPlaying = true;
        }
      }

      render() {
        if (!this.isPlaying) return;
        this.time += 0.05;
        this.material.uniforms.time.value = this.time;
        requestAnimationFrame(this.render.bind(this));
        // this.renderer.render(this.scene, this.camera);
        this.composer.render();
      }
}