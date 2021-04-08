    uniform float time;
    uniform vec2 hover;
    uniform float hoverState;
    varying float vNoise;
    varying vec2 vUv;

    void main() {
        vec3 newposition = position;

        float dist = distance(uv,hover);
        newposition.z += hoverState*10.0*sin(dist*10. + time);

        vNoise = hoverState*sin(dist*10.0 - time);
        vUv = uv;

        // projectMatrix and modelViewMatrix are predefined thanks to ShaderMaterial()
        gl_Position = projectionMatrix * modelViewMatrix * vec4( newposition, 1.0 );
    }