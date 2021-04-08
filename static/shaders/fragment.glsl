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
            texture2D(uImage, (p-0.5)*(1.0-x)+0.5),
            texture2D(uImage, (p-0.5)*x+0.5),
            x);


        vec4 imageView = texture2D(uImage, newUV);

        gl_FragColor = f;
        gl_FragColor.rgb += 0.01*vec3(vNoise);
    }