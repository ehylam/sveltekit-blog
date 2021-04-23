import * as THREE from 'three';
import gsap from 'gsap';


const vertexShader = `
    uniform float time;
    uniform vec2 uFrequency;
    uniform float hoverState;
    attribute float aRandom;

    varying float vRandom;
    varying vec2 vUv;




    void main() {
        float x = hoverState;
        vec4 modelPosition = modelMatrix * vec4(position, 1.0);

        modelPosition.z += x * tan(modelPosition.x * uFrequency.x + time) * 0.02;
        modelPosition.z += x * tan(modelPosition.y * uFrequency.y + time) * 0.02;

        // modelPosition.z += aRandom * sin(time) * 0.1;
        vec4 viewPosition = viewMatrix * modelPosition;
        vec4 projectedMatrix = projectionMatrix * viewPosition;

        gl_Position = projectedMatrix;

        vRandom = aRandom;

        vUv = uv;
    }
`;


const fragmentShader = `
    uniform float time;
    uniform float hoverState;
    // uniform sampler2D uTexture;

    precision mediump float;

    varying vec2 vUv;
    // varying float vRandom;

    void main() {
        float x = hoverState;
        // vec4 textureColor = texture2D(uTexture, vUv);
        gl_FragColor = vec4(x * 0.83921568627,x *  0.63921568627,x *  0.27450980392, 1.0);
        // gl_FragColor = textureColor;
    }
`;


export default class Playground {
    constructor(options) {
        this.time = 0;
        this.container = options.dom;
        this.el = document.querySelector('.nav__holo');
        // Sizing
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;
        this.cameraPos = 600;

        // Scene
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera( 70, this.width / this.height, 1, 2000 );
        this.camera.position.z = this.cameraPos;
        this.camera.fov = 2*Math.atan((this.height/2) / this.cameraPos ) * (180/Math.PI);
        // Renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setSize( this.width, this.height );
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)); //perforamnce optimisations
        this.container.appendChild( this.renderer.domElement );

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.addObject();
        this.resize();
        this.setPosition();
        this.scaleObject();
        this.setupResize();
        // this.mouseMovement();
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
        this.camera.fov = 2*Math.atan((window.innerHeight/2) / this.cameraPos ) * (180/Math.PI);
        this.camera.updateProjectionMatrix();
        this.scaleObject();
        this.setPosition();
    }



    addObject() {
        // this.texture = new THREE.TextureLoader();
        // const image = this.texture.load('/static/uploads/32.jpg');
        this.geometry = new THREE.CircleGeometry(1,28);
        const count = this.geometry.attributes.position.count;

        const randoms = new Float32Array(count);

        for(let i = 0; i < count; i++) {
            randoms[i] = Math.random();
        }

        // this.texture.needsUpdate = true;

        this.geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                time: {value: 0},
                uImage: {value: 0},
                uhover: {value: new THREE.Vector2(0.5,0.5)},
                hoverState: {value: 0},
                uFrequency: { value: new THREE.Vector2(10, 2)}
                // uTexture: { value: image }
            },
            side: THREE.DoubleSide,
            fragmentShader: fragmentShader,
            vertexShader: vertexShader,
            // wireframe: true
        })


        this.el.addEventListener('mouseenter', () => {
            gsap.to(this.material.uniforms.hoverState, {
                duration: 1,
                value: 1
            })
        })


        this.el.addEventListener('mouseleave', () => {
            gsap.to(this.material.uniforms.hoverState, {
                duration: 1,
                value: 0
            })
        })


        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.scene.add(this.mesh);
    }

    scaleObject() {
        for (let i = 0; i < this.scene.children.length; i++) {
            const plane = this.scene.children[i];
            const bounds = this.el.getBoundingClientRect();

            console.log(bounds);
            plane.scale.set(bounds.width, bounds.height,1);
        }
    }


    setPosition() {
        const bounds = this.el.getBoundingClientRect();

        this.mesh.position.x = bounds.left - window.innerWidth / 2 + bounds.width / 2;
        // get the scroll position, subtract the image top, add the height of window and half it and subtract the image height and half.
        this.mesh.position.y = - bounds.top  + window.innerHeight / 2 - bounds.height / 2;
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