import * as THREE from 'three';
import gsap from 'gsap';


const vertexShader = `
uniform float time;
varying vec2 vUv;
varying vec3 vPosition;

float PI = 3.141592653589793238;

void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4( position, 1 );
  gl_PointSize = 10. * ( 1. / - mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;


const fragmentShader = `
varying vec2 vUv;

void main()	{
	// vec2 newUV = (vUv - vec2(0.5))*resolution.zw + vec2(0.5);
	// gl_FragColor = vec4(vUv,0.0,1.);
}
`;


export default class Video {
    constructor(options) {
        this.scene = new THREE.Scene();

        this.container = options.dom;
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.setSize(this.width, this.height);
        this.renderer.setClearColor(0xeeeeee, 1);

        this.container.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(
          70,
          window.innerWidth / window.innerHeight,
          0.001,
          1000
        );

        // var frustumSize = 10;
        // var aspect = window.innerWidth / window.innerHeight;
        // this.camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / - 2, -1000, 1000 );
        this.camera.position.set(0, 0, 2);
        this.time = 0;

        this.isPlaying = true;

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
            resolution: { value: new THREE.Vector4() },
          },
          // wireframe: true,
          // transparent: true,
          vertexShader: vertexShader,
          fragmentShader: fragmentShader
        });

        this.geometry = new THREE.PlaneGeometry(1, 1, 10, 10);

        this.plane = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.plane);
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
        this.renderer.render(this.scene, this.camera);
      }
}