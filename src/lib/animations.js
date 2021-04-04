import * as THREE from 'three';
import gsap from 'gsap';
import Scroll from "./scroll.js";


// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// import Shrine from "/static/images/hello-world.jpg";

const fragment = `
    uniform float time;
    varying float vNoise;
    varying vec2 vUv;
    uniform float hoverState;
    uniform sampler2D uImage;

    void main()	{
        vec2 newUV = vUv;
        vec2 p = newUV;
        float x = hoverState;

        x = smoothstep(.0,1.0,(x*2.0+p.y-1.0));
        vec4 f = mix(
            texture2D(uImage, (p-.5)*(1.-x)+.5),
            texture2D(uImage, (p-.5)*x+.5),
            x);


        vec4 imageView = texture2D(uImage, newUV);

        gl_FragColor = f;
        gl_FragColor.rgb += 0.03*vec3(vNoise);
    }
`;

const vertex = `
    uniform float time;
    uniform vec2 hover;
    uniform float hoverState;
    varying float vNoise;
    varying vec2 vUv;

    void main() {
        vec3 newposition = position;

        // float noise = cnoise(3.*vec3(position.x,position.y,position.z + time/30.));

        float dist = distance(uv,hover);
        newposition.z += hoverState*10.*sin(dist*10. + time);

        vNoise = hoverState*sin(dist*10. - time);
        vUv = uv;

        gl_Position = projectionMatrix * modelViewMatrix * vec4( newposition, 1.0 );
    }
`

const cameraPos = 600;
export default class Sketch {

    constructor(options) {
        this.time = 0;
        this.container = options.dom;

        // Sizing

        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;

        // Scene

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera( 70, this.width / this.height, 100, 2000 );
        this.camera.position.z = cameraPos;

        // Half of Window height divided by the distance between camera and canvas then convert to degrees
        this.camera.fov = 2*Math.atan((this.height/2) / cameraPos ) * (180/Math.PI);

        // Renderer

        this.renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
        this.renderer.setSize( this.width, this.height );
        // this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)); //perforamnce optimisations
        this.container.appendChild( this.renderer.domElement );

        // Controls
        // this.controls = new OrbitControls( this.camera, this.renderer.domElement );

        // images
        this.images = [...document.querySelectorAll('a.post img')];
        this.currentScroll = 0; //Potential bug, some browsers reload the page and maintains the same scroll pos..
        this.previousScroll = 1;
        // Effects
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.scroll = new Scroll();
        this.addImages();
        this.setPosition();
        this.resize();
        this.setupResize();
        this.mouseMovement();
        // this.addObjects();
        this.render();


        // window.addEventListener('scroll', () => {
        //     this.currentScroll = window.scrollY;
        //     this.setPosition();
        // })

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

        this.updateImages();
    }

    addImages() {

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                time: {value: 0},
                uImage: {value: 0},
                hover: {value: new THREE.Vector2(0.5,0.5)},
                hoverState: {value: 0}
                // shrineTexture: {value: new THREE.TextureLoader().load(Shrine)}
            },
            side: THREE.DoubleSide,
            fragmentShader: fragment,
            vertexShader: vertex,
            // wireframe: true
        })

        this.materials = [];
        let id = -1;
        this.imageStore = this.images.map(img => {
            id++;
            let bounds = img.getBoundingClientRect();



            let geometry = new THREE.PlaneBufferGeometry(1, 1, 10, 10);
            let texture = new THREE.Texture(img);
            texture.needsUpdate = true;

            let material = this.material.clone();

            img.addEventListener('mouseenter', () => {
                gsap.to(material.uniforms.hoverState, {
                    duration: 1,
                    value: 1
                })
            })

            img.addEventListener('mouseout', () => {
                gsap.to(material.uniforms.hoverState, {
                    duration: 1,
                    value: 0
                })
            })

            this.materials.push(material);

            material.uniforms.uImage.value = texture;
            let mesh = new THREE.Mesh(geometry, material);

            mesh.scale.set(bounds.width, bounds.height);

            this.scene.add(mesh);

            return {
                id: id,
                img: img,
                mesh: mesh,
                top: bounds.top,
                left: bounds.left,
                width: bounds.width,
                height: bounds.height
            }
        })
    }

    updateImages() {
        // this.images = [...document.querySelectorAll('a.post img')];
        for (let i = 0; i < this.scene.children.length; i++) {
            const plane = this.scene.children[i];
            const bounds = this.images[i].getBoundingClientRect();
            plane.scale.set(bounds.width, bounds.height,1);

            plane.position.y = (window.innerHeight / 2) - (bounds.top /2);
            plane.position.x = (window.innerWidth / 2) - (bounds.left /2);
        }
        // this.imageStore.forEach(img => {


        //     this.scene.add(img.mesh);
        // })
    }

    setPosition() {

        this.imageStore.forEach(o => {
            o.mesh.position.y = this.currentScroll - o.top + this.height / 2 - o.height / 2;
            o.mesh.position.x = o.left - this.width / 2 + o.width / 2;
            // }
        })
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

    addObjects() {
        this.geometry = new THREE.PlaneBufferGeometry( 100, 100, 10, 10 );
        this.material = new THREE.MeshNormalMaterial();

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                time: {value: 0},
                // shrineTexture: {value: new THREE.TextureLoader().load(Shrine)}
            },
            side: THREE.DoubleSide,
            fragmentShader: fragment,
            vertexShader: vertex,
            // wireframe: true
        })

        this.mesh = new THREE.Mesh( this.geometry, this.material );
        this.scene.add( this.mesh );

    }

    render() {
        this.time += 0.05;

        this.scroll.render();
        this.currentScroll = this.scroll.scrollToRender;

        // if(Math.round(this.currentScroll) !== Math.round(this.previousScroll)) {
        // }

        this.setPosition();

        this.materials.forEach( m => {
            m.uniforms.time.value = this.time;
        })

        this.renderer.render( this.scene, this.camera );

        this.previousScroll = this.currentScroll

        window.requestAnimationFrame(this.render.bind(this));
    }
}

