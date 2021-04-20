import * as THREE from 'three';
import gsap from 'gsap';


const vertexShader = `
    uniform float time;
    uniform vec2 uFrequency;

    attribute float aRandom;

    varying float vRandom;

    void main() {
        vec4 modelPosition = modelMatrix * vec4(position, 1.0);
        modelPosition.z += sin(modelPosition.x * uFrequency.x + time) * 0.1;
        modelPosition.z += sin(modelPosition.y * uFrequency.y + time) * 0.1;

        // modelPosition.z += aRandom * sin(time) * 0.1;
        vec4 viewPosition = viewMatrix * modelPosition;
        vec4 projectedMatrix = projectionMatrix * viewPosition;

        gl_Position = projectedMatrix;

        vRandom = aRandom;
    }
`;


const fragmentShader = `
    uniform float time;
    precision mediump float;

    varying float vRandom;

    void main() {
        // gl_FragColor = vec4(vRandom * sin(time), vRandom * 0.5 * sin(time), 0.1, 1.0);
        gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
    }
`;


export default class Playground {
    constructor(options) {
        this.time = 0;
        this.container = options.dom;

        // Sizing
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;

        // Scene
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera( 70, this.width / this.height, 1, 2000 );
        this.camera.position.z = 2;

        // Renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setSize( this.width, this.height );
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)); //perforamnce optimisations
        this.container.appendChild( this.renderer.domElement );

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.addObject();
        this.resize();
        this.setupResize();
        this.mouseMovement();
        this.render();


    }

    setupResize() {
        window.addEventListener('resize',this.resize.bind(this));
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.renderer.setSize( this.width, this.height );
        this.camera.aspect = this.width/this.height;
        this.camera.updateProjectionMatrix();
    }



    addObject() {

        this.geometry = new THREE.PlaneBufferGeometry(1,1,32,32);
        const count = this.geometry.attributes.position.count;

        const randoms = new Float32Array(count);

        for(let i = 0; i < count; i++) {
            randoms[i] = Math.random();
        }

        this.geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));


        console.log(this.geometry);
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                time: {value: 0},
                uImage: {value: 0},
                hover: {value: new THREE.Vector2(0.5,0.5)},
                hoverState: {value: 0},
                uFrequency: { value: new THREE.Vector2(10, 2)}
            },
            side: THREE.DoubleSide,
            fragmentShader: fragmentShader,
            vertexShader: vertexShader,
            // wireframe: true
        })

        this.mesh = new THREE.Mesh(this.geometry,this.material);
        this.scene.add(this.mesh);
    }



    mouseMovement() {
        window.addEventListener( 'mousemove', (event) => {
            this.mouse.x = ( event.clientX / this.width ) * 2 - 1;
            this.mouse.y = - ( event.clientY / this.height ) * 2 + 1;

            this.raycaster.setFromCamera( this.mouse, this.camera );

	        const intersects = this.raycaster.intersectObjects( this.scene.children );

            if(intersects.length > 0) {

                let obj = intersects[0].object;

                obj.material.uniforms.hover.value = intersects[0].uv;
            }

        }, false );
    }


    render() {
        this.time += 0.05;

        this.material.uniforms.time.value = this.time;

        this.renderer.render( this.scene, this.camera );

        window.requestAnimationFrame(this.render.bind(this));
    }
}