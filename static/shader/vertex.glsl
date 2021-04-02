    uniform float time;
    varying float vNoise;
    varying vec2 vUv;
    uniform sampler2D uImage;

    void main()	{
        vec2 newUV = vUv;

        vec4 imageView = texture2D(uImage, newUV);

        gl_FragColor = vec4(vUv,0.,1.);
        // gl_FragColor = vec4(vNoise,0.,0.,1.);
        gl_FragColor = imageView;
        gl_FragColor.rgb += 0.03*vec3(vNoise);
    }