// import posts from './_posts';


// export function get({ params }) {
// // params is the value in [slug]
// 	if (params.slug in posts) {
// 		return {
// 			// Find posts object by slug
// 			body: posts[params.slug]
// 		};
// 	}

// 	return {
// 		// else return 404
// 		status: 404
// 	};
// }
// import path from "path";
// import fs from "fs";
// import grayMatter from "gray-matter";
// import marked from "marked";

// // NodeJS -> fs.readFileSync returns contents of the selected path.
// const getPost = fileName => fs.readFileSync(path.resolve("static/posts", `${fileName}.md`), "utf-8");

// export function get(req, res, next) {
// 	const { slug } = req.params;

// 	// get the markdown text
// 	const post = getPost(slug);

// 	// function that expose helpful callbacks
// 	// to manipulate the data before convert it into html
// 	const renderer = new marked.Renderer();


// 	// parse the md to get front matter
// 	// and the content without escaping characters
// 	const { data, content } = grayMatter(post);

// 	const html = marked(content, { renderer });

// 	if (html) {
// 		// NodeJS 'res.writeHead' sends a response to the header
// 		res.writeHead(200, {
// 			"Content-Type": "application/json"
// 		});
// 		// returns the content of the file
// 		res.end(JSON.stringify({ html, ...data }));

// 	} else {
// 		// Return 404 not found
// 		res.writeHead(404, {
// 			"Content-Type": "application/json"
// 		});

// 		res.end(
// 			JSON.stringify({
// 			message: `Not found`
// 			})
// 		);
// 	}
// }

// Three.js - Align HTML Elements to 3D
// from https://threejsfundamentals.org/threejs/threejs-align-html-to-3d.html


import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r115/build/three.module.js';
import {OrbitControls} from 'https://threejsfundamentals.org/threejs/resources/threejs/r115/examples/jsm/controls/OrbitControls.js';

function main() {
  const canvas = document.querySelector('#c');
  const renderer = new THREE.WebGLRenderer({canvas});

  const fov = 75;
  const aspect = 2;  // the canvas default
  const near = 1.1;
  const far = 50;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.z = 4;

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.update();

  const scene = new THREE.Scene();

  {
    const color = 0xFFFFFF;
    const intensity = 1;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(-1, 2, 4);
    scene.add(light);
  }

  const boxWidth = 1;
  const boxHeight = 1;
  const boxDepth = 1;
  const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

  const labelContainerElem = document.querySelector('#labels');

  function makeInstance(geometry, color, x, name) {
    const material = new THREE.MeshPhongMaterial({color});

    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    cube.position.x = x;

    const elem = document.createElement('div');
    elem.textContent = name;
    labelContainerElem.appendChild(elem);

    return {cube, elem};
  }

  const cubes = [
    makeInstance(geometry, 0x44aa88,  0, 'Aqua'),
    makeInstance(geometry, 0x8844aa, -2, 'Purple'),
    makeInstance(geometry, 0xaa8844,  2, 'Gold'),
  ];

  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  const tempV = new THREE.Vector3();

  function render(time) {
    time *= 0.001;

    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    cubes.forEach((cubeInfo, ndx) => {
      const {cube, elem} = cubeInfo;
      const speed = 1 + ndx * .1;
      const rot = time * speed;
      cube.rotation.x = rot;
      cube.rotation.y = rot;

      // get the position of the center of the cube
      cube.updateWorldMatrix(true, false);
      cube.getWorldPosition(tempV);

      // get the normalized screen coordinate of that position
      // x and y will be in the -1 to +1 range with x = -1 being
      // on the left and y = -1 being on the bottom
      tempV.project(camera);

      // convert the normalized position to CSS coordinates
      const x = (tempV.x *  .5 + .5) * canvas.clientWidth;
      const y = (tempV.y * -.5 + .5) * canvas.clientHeight;

      // move the elem to that position
      elem.style.transform = `translate(-50%, -50%) translate(${x}px,${y}px)`;
    });

    renderer.render(scene, camera);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main();
