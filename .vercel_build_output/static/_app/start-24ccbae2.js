var e=Object.defineProperty,t=Object.prototype.hasOwnProperty,s=Object.getOwnPropertySymbols,r=Object.prototype.propertyIsEnumerable,n=(t,s,r)=>s in t?e(t,s,{enumerable:!0,configurable:!0,writable:!0,value:r}):t[s]=r,o=(e,o)=>{for(var i in o||(o={}))t.call(o,i)&&n(e,i,o[i]);if(s)for(var i of s(o))r.call(o,i)&&n(e,i,o[i]);return e};import{S as i,i as a,s as c,e as l,t as h,c as u,a as d,b as p,d as g,f,g as m,h as v,j as y,k as w,l as x,n as $,m as b,o as z,p as _,q as P,r as E,u as S,v as R,w as q,x as O,y as T,z as L,A as k,B as M,C as j,D,E as U,P as C,W as I,F as N,T as V,M as A,G as F,H,I as W,J as B,K,L as G,N as Y}from"./chunks/vendor-d7b15c1b.js";function J(e){let t,s,r=e[1].stack+"";return{c(){t=l("pre"),s=h(r)},l(e){t=u(e,"PRE",{});var n=d(t);s=p(n,r),n.forEach(g)},m(e,r){f(e,t,r),m(t,s)},p(e,t){2&t&&r!==(r=e[1].stack+"")&&v(s,r)},d(e){e&&g(t)}}}function X(e){let t,s,r,n,o,i,a,c=e[1].message+"",b=e[1].stack&&J(e);return{c(){t=l("h1"),s=h(e[0]),r=y(),n=l("p"),o=h(c),i=y(),b&&b.c(),a=w()},l(l){t=u(l,"H1",{});var h=d(t);s=p(h,e[0]),h.forEach(g),r=x(l),n=u(l,"P",{});var f=d(n);o=p(f,c),f.forEach(g),i=x(l),b&&b.l(l),a=w()},m(e,c){f(e,t,c),m(t,s),f(e,r,c),f(e,n,c),m(n,o),f(e,i,c),b&&b.m(e,c),f(e,a,c)},p(e,[t]){1&t&&v(s,e[0]),2&t&&c!==(c=e[1].message+"")&&v(o,c),e[1].stack?b?b.p(e,t):(b=J(e),b.c(),b.m(a.parentNode,a)):b&&(b.d(1),b=null)},i:$,o:$,d(e){e&&g(t),e&&g(r),e&&g(n),e&&g(i),b&&b.d(e),e&&g(a)}}}function Q(e,t,s){let{status:r}=t,{error:n}=t;return e.$$set=e=>{"status"in e&&s(0,r=e.status),"error"in e&&s(1,n=e.error)},[r,n]}class Z extends i{constructor(e){super(),a(this,e,Q,X,c,{status:0,error:1})}}function ee(e){let t,s,r;const n=[e[4]||{}];var o=e[2][1];function i(e){let t={};for(let s=0;s<n.length;s+=1)t=b(t,n[s]);return{props:t}}return o&&(t=new o(i())),{c(){t&&_(t.$$.fragment),s=w()},l(e){t&&P(t.$$.fragment,e),s=w()},m(e,n){t&&E(t,e,n),f(e,s,n),r=!0},p(e,r){const a=16&r?S(n,[R(e[4]||{})]):{};if(o!==(o=e[2][1])){if(t){j();const e=t;O(e.$$.fragment,1,0,(()=>{T(e,1)})),D()}o?(t=new o(i()),_(t.$$.fragment),q(t.$$.fragment,1),E(t,s.parentNode,s)):t=null}else o&&t.$set(a)},i(e){r||(t&&q(t.$$.fragment,e),r=!0)},o(e){t&&O(t.$$.fragment,e),r=!1},d(e){e&&g(s),t&&T(t,e)}}}function te(e){let t,s;return t=new Z({props:{status:e[0],error:e[1]}}),{c(){_(t.$$.fragment)},l(e){P(t.$$.fragment,e)},m(e,r){E(t,e,r),s=!0},p(e,s){const r={};1&s&&(r.status=e[0]),2&s&&(r.error=e[1]),t.$set(r)},i(e){s||(q(t.$$.fragment,e),s=!0)},o(e){O(t.$$.fragment,e),s=!1},d(e){T(t,e)}}}function se(e){let t,s,r,n;const o=[te,ee],i=[];function a(e,t){return e[1]?0:1}return t=a(e),s=i[t]=o[t](e),{c(){s.c(),r=w()},l(e){s.l(e),r=w()},m(e,s){i[t].m(e,s),f(e,r,s),n=!0},p(e,n){let c=t;t=a(e),t===c?i[t].p(e,n):(j(),O(i[c],1,1,(()=>{i[c]=null})),D(),s=i[t],s?s.p(e,n):(s=i[t]=o[t](e),s.c()),q(s,1),s.m(r.parentNode,r))},i(e){n||(q(s),n=!0)},o(e){O(s),n=!1},d(e){i[t].d(e),e&&g(r)}}}function re(e){let t,s=e[6]&&ne(e);return{c(){t=l("div"),s&&s.c(),this.h()},l(e){t=u(e,"DIV",{id:!0,"aria-live":!0,"aria-atomic":!0,class:!0});var r=d(t);s&&s.l(r),r.forEach(g),this.h()},h(){z(t,"id","svelte-announcer"),z(t,"aria-live","assertive"),z(t,"aria-atomic","true"),z(t,"class","svelte-1j55zn5")},m(e,r){f(e,t,r),s&&s.m(t,null)},p(e,r){e[6]?s?s.p(e,r):(s=ne(e),s.c(),s.m(t,null)):s&&(s.d(1),s=null)},d(e){e&&g(t),s&&s.d()}}}function ne(e){let t,s;return{c(){t=h("Navigated to "),s=h(e[7])},l(r){t=p(r,"Navigated to "),s=p(r,e[7])},m(e,r){f(e,t,r),f(e,s,r)},p(e,t){128&t&&v(s,e[7])},d(e){e&&g(t),e&&g(s)}}}function oe(e){let t,s,r,n;const o=[e[3]||{}];let i={$$slots:{default:[se]},$$scope:{ctx:e}};for(let c=0;c<o.length;c+=1)i=b(i,o[c]);t=new e[8]({props:i});let a=e[5]&&re(e);return{c(){_(t.$$.fragment),s=y(),a&&a.c(),r=w()},l(e){P(t.$$.fragment,e),s=x(e),a&&a.l(e),r=w()},m(e,o){E(t,e,o),f(e,s,o),a&&a.m(e,o),f(e,r,o),n=!0},p(e,[s]){const n=8&s?S(o,[R(e[3]||{})]):{};2071&s&&(n.$$scope={dirty:s,ctx:e}),t.$set(n),e[5]?a?a.p(e,s):(a=re(e),a.c(),a.m(r.parentNode,r)):a&&(a.d(1),a=null)},i(e){n||(q(t.$$.fragment,e),n=!0)},o(e){O(t.$$.fragment,e),n=!1},d(e){T(t,e),e&&g(s),a&&a.d(e),e&&g(r)}}}function ie(e,t,s){let{status:r}=t,{error:n}=t,{stores:o}=t,{page:i}=t,{components:a}=t,{props_0:c=null}=t,{props_1:l=null}=t;const h=a[0];L("__svelte__",o),k(o.page.notify);let u=!1,d=!1,p=null;return M((()=>{const e=o.page.subscribe((()=>{u&&(s(6,d=!0),s(7,p=document.title))}));return s(5,u=!0),e})),e.$$set=e=>{"status"in e&&s(0,r=e.status),"error"in e&&s(1,n=e.error),"stores"in e&&s(9,o=e.stores),"page"in e&&s(10,i=e.page),"components"in e&&s(2,a=e.components),"props_0"in e&&s(3,c=e.props_0),"props_1"in e&&s(4,l=e.props_1)},e.$$.update=()=>{1536&e.$$.dirty&&o.page.set(i)},[r,n,a,c,l,u,d,p,h,o,i]}class ae extends i{constructor(e){super(),a(this,e,ie,oe,c,{status:0,error:1,stores:9,page:10,components:2,props_0:3,props_1:4})}}let ce;const le={},he=function(e,t){if(!t)return e();if(void 0===ce){const e=document.createElement("link").relList;ce=e&&e.supports&&e.supports("modulepreload")?"modulepreload":"preload"}return Promise.all(t.map((e=>{if(e in le)return;le[e]=!0;const t=e.endsWith(".css"),s=t?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${e}"]${s}`))return;const r=document.createElement("link");return r.rel=t?"stylesheet":ce,t||(r.as="script",r.crossOrigin=""),r.href=e,document.head.appendChild(r),t?new Promise(((e,t)=>{r.addEventListener("load",e),r.addEventListener("error",t)})):void 0}))).then((()=>e()))};function ue(e){let t,s,r,n,o,i;return{c(){t=l("nav"),s=l("a"),r=h("Home"),n=y(),o=l("a"),i=h("blog"),this.h()},l(e){t=u(e,"NAV",{class:!0});var a=d(t);s=u(a,"A",{href:!0,class:!0});var c=d(s);r=p(c,"Home"),c.forEach(g),n=x(a),o=u(a,"A",{href:!0,class:!0});var l=d(o);i=p(l,"blog"),l.forEach(g),a.forEach(g),this.h()},h(){z(s,"href","/"),z(s,"class","svelte-ukjl08"),z(o,"href","/blog"),z(o,"class","svelte-ukjl08"),z(t,"class","svelte-ukjl08")},m(e,a){f(e,t,a),m(t,s),m(s,r),m(t,n),m(t,o),m(o,i)},p:$,i:$,o:$,d(e){e&&g(t)}}}class de extends i{constructor(e){super(),a(this,e,null,ue,c,{})}}function pe(e){let t,s;return{c(){t=l("footer"),s=h("Copyright 2021 - Eric Lam")},l(e){t=u(e,"FOOTER",{});var r=d(t);s=p(r,"Copyright 2021 - Eric Lam"),r.forEach(g)},m(e,r){f(e,t,r),m(t,s)},p:$,i:$,o:$,d(e){e&&g(t)}}}class ge extends i{constructor(e){super(),a(this,e,null,pe,c,{})}}class fe{constructor(){this.DOM={main:document.querySelector("main")},this.DOM.scrollable=this.DOM.main.querySelector("div[data-scroll]"),this.docScroll=0,this.scrollToRender=0,this.current=0,this.ease=.1,this.speed=0,this.speedTarget=0,this.setSize(),this.getScroll(),this.init(),this.style(),this.initEvents(),requestAnimationFrame((()=>this.render()))}init(){for(const e in this.renderedStyles)this.current=this.scrollToRender=this.getScroll();this.setPosition(),this.shouldRender=!0}style(){this.DOM.main.style.position="fixed",this.DOM.main.style.width=this.DOM.main.style.height="100%",this.DOM.main.style.top=this.DOM.main.style.left=0,this.DOM.main.style.overflow="hidden"}getScroll(){return this.docScroll=window.pageYOffset||document.documentElement.scrollTop,this.docScroll}initEvents(){window.onbeforeunload=function(){window.scrollTo(0,0)},window.addEventListener("resize",(()=>this.setSize())),window.addEventListener("scroll",this.getScroll.bind(this))}setSize(){document.body.style.height=`${this.DOM.scrollable.scrollHeight}px`}setPosition(){(Math.round(this.scrollToRender)!==Math.round(this.current)||this.scrollToRender<10)&&(this.DOM.scrollable.style.transform=`translate3d(0,${-1*this.scrollToRender}px,0)`)}render(){var e,t,s;this.speed=Math.min(Math.abs(this.current-this.scrollToRender),200)/200,this.speedTarget+=.2*(this.speed-this.speedTarget),this.current=this.getScroll(),this.scrollToRender=(e=this.scrollToRender,t=this.current,(1-(s=this.ease))*e+s*t),this.setPosition()}}class me{constructor(e){this.container=e.dom,this.width=this.container.offsetWidth,this.height=this.container.offsetHeight,this.scene=new U,this.camera=new C(70,this.width/this.height,100,2e3),this.camera.position.z=600,this.camera.fov=2*Math.atan(this.height/2/600)*(180/Math.PI),this.renderer=new I({antialias:!0,alpha:!0}),this.renderer.setSize(this.width,this.height),this.container.appendChild(this.renderer.domElement),this.images=[...document.querySelectorAll("a.post img")],this.currentScroll=0,this.scroll=new fe,this.addImages(),this.setPosition(),this.resize(),this.setupResize(),this.render()}setupResize(){window.addEventListener("resize",this.resize.bind(this))}resize(){this.width=this.container.offsetWidth,this.height=this.container.offsetHeight,this.renderer.setSize(this.width,this.height),this.camera.aspect=this.width/this.height,this.camera.updateProjectionMatrix()}addImages(){this.imageStore=this.images.map((e=>{let t=e.getBoundingClientRect(),s=new N(t.width,t.height,1,1),r=new V(e);r.needsUpdate=!0;let n=new A({map:r}),o=new F(s,n);return this.scene.add(o),{img:e,mesh:o,top:t.top,left:t.left,width:t.width,height:t.height}}))}setPosition(){this.imageStore.forEach((e=>{e.mesh.position.y=this.currentScroll-e.top+this.height/2-e.height/2,e.mesh.position.x=e.left-this.width/2+e.width/2}))}addObjects(){this.geometry=new N(100,100,10,10),this.material=new H,this.material=new W({uniforms:{time:{value:0}},side:B,fragmentShader:"\n    uniform float time;\n    varying float vNoise;\n    varying vec2 vUv;\n    uniform sampler2D shrineTexture;\n\n    void main()\t{\n        vec3 colour1 = vec3(1.,0.,0.);\n        vec3 colour2 = vec3(1.,1.,1.);\n        vec3 finalColour = mix(colour1,colour2,0.5*(vNoise + 1.));\n\n        vec2 newUV = vUv;\n\n        newUV = vec2(newUV.x, newUV.y + 0.01*sin(newUV.x*10. + time));\n\n        vec4 shrineView = texture2D(shrineTexture, newUV);\n\n        // gl_FragColor = vec4(finalColour,1.);\n        gl_FragColor = vec4(vUv,0.,1.);\n        // gl_FragColor = vec4(vNoise);\n        // gl_FragColor = shrineView + 0.5*vec4(vNoise);\n    }\n",vertexShader:"\n    //\tClassic Perlin 3D Noise\n    //\tby Stefan Gustavson\n    //\n    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}\n    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}\n    vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}\n\n    float cnoise(vec3 P){\n    vec3 Pi0 = floor(P); // Integer part for indexing\n    vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1\n    Pi0 = mod(Pi0, 289.0);\n    Pi1 = mod(Pi1, 289.0);\n    vec3 Pf0 = fract(P); // Fractional part for interpolation\n    vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0\n    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);\n    vec4 iy = vec4(Pi0.yy, Pi1.yy);\n    vec4 iz0 = Pi0.zzzz;\n    vec4 iz1 = Pi1.zzzz;\n\n    vec4 ixy = permute(permute(ix) + iy);\n    vec4 ixy0 = permute(ixy + iz0);\n    vec4 ixy1 = permute(ixy + iz1);\n\n    vec4 gx0 = ixy0 / 7.0;\n    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;\n    gx0 = fract(gx0);\n    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);\n    vec4 sz0 = step(gz0, vec4(0.0));\n    gx0 -= sz0 * (step(0.0, gx0) - 0.5);\n    gy0 -= sz0 * (step(0.0, gy0) - 0.5);\n\n    vec4 gx1 = ixy1 / 7.0;\n    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;\n    gx1 = fract(gx1);\n    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);\n    vec4 sz1 = step(gz1, vec4(0.0));\n    gx1 -= sz1 * (step(0.0, gx1) - 0.5);\n    gy1 -= sz1 * (step(0.0, gy1) - 0.5);\n\n    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);\n    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);\n    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);\n    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);\n    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);\n    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);\n    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);\n    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);\n\n    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));\n    g000 *= norm0.x;\n    g010 *= norm0.y;\n    g100 *= norm0.z;\n    g110 *= norm0.w;\n    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));\n    g001 *= norm1.x;\n    g011 *= norm1.y;\n    g101 *= norm1.z;\n    g111 *= norm1.w;\n\n    float n000 = dot(g000, Pf0);\n    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));\n    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));\n    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));\n    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));\n    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));\n    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));\n    float n111 = dot(g111, Pf1);\n\n    vec3 fade_xyz = fade(Pf0);\n    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);\n    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);\n    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);\n    return 2.2 * n_xyz;\n    }\n\n    uniform float time;\n    varying float vNoise;\n    varying vec2 vUv;\n\n    void main() {\n        float PI = 3.1415925;\n        vec3 newposition = position;\n\n        // newposition.z += 0.1*sin((newposition.x + 0.25)*2.*PI);\n\n        float noise = cnoise(10.*vec3(position.x,position.y,position.z + time/10.));\n\n        // Center\n        // float dist = distance(uv,vec2(0.5));\n\n        // To center\n        // newposition.z += 0.1*sin(dist * 40.);\n\n        // From center\n        // newposition.z += 0.1*sin(dist * 20. + time);\n\n        newposition += 0.08*normal*noise;\n\n        vNoise = noise;\n        vUv = uv;\n\n        gl_Position = projectionMatrix * modelViewMatrix * vec4( newposition, 1.0 );\n    }\n",wireframe:!0}),this.mesh=new F(this.geometry,this.material),this.scene.add(this.mesh)}render(){this.scroll.render(),this.currentScroll=this.scroll.scrollToRender,this.setPosition(),this.renderer.render(this.scene,this.camera),window.requestAnimationFrame(this.render.bind(this))}}function ve(e){let t,s,r,n,o,i,a,c,h;r=new de({});const p=e[1].default,v=K(p,e,e[0],null);return i=new ge({}),{c(){t=l("main"),s=l("div"),_(r.$$.fragment),n=y(),v&&v.c(),o=y(),_(i.$$.fragment),a=y(),c=l("div"),this.h()},l(e){t=u(e,"MAIN",{class:!0});var l=d(t);s=u(l,"DIV",{"data-scroll":!0,class:!0});var h=d(s);P(r.$$.fragment,h),n=x(h),v&&v.l(h),o=x(h),P(i.$$.fragment,h),h.forEach(g),l.forEach(g),a=x(e),c=u(e,"DIV",{class:!0}),d(c).forEach(g),this.h()},h(){z(s,"data-scroll",""),z(s,"class","svelte-1yd48fc"),z(t,"class","svelte-1yd48fc"),z(c,"class","container svelte-1yd48fc")},m(e,l){f(e,t,l),m(t,s),E(r,s,null),m(s,n),v&&v.m(s,null),m(s,o),E(i,s,null),f(e,a,l),f(e,c,l),h=!0},p(e,[t]){v&&v.p&&1&t&&G(v,p,e,e[0],t,null,null)},i(e){h||(q(r.$$.fragment,e),q(v,e),q(i.$$.fragment,e),h=!0)},o(e){O(r.$$.fragment,e),O(v,e),O(i.$$.fragment,e),h=!1},d(e){e&&g(t),T(r),v&&v.d(e),T(i),e&&g(a),e&&g(c)}}}function ye(e,t,s){let{$$slots:r={},$$scope:n}=t;return M((()=>{new me({dom:document.querySelector(".container")})})),e.$$set=e=>{"$$scope"in e&&s(0,n=e.$$scope)},[n,r]}var we=Object.freeze({__proto__:null,[Symbol.toStringTag]:"Module",default:class extends i{constructor(e){super(),a(this,e,ye,ve,c,{})}}});const xe=[()=>he((()=>import("./pages/index.svelte-ab984603.js")),["/_app/pages/index.svelte-ab984603.js","/_app/chunks/vendor-d7b15c1b.js"]),()=>he((()=>import("./pages/blog/index.svelte-90bdc3c2.js")),["/_app/pages/blog/index.svelte-90bdc3c2.js","/_app/assets/pages/blog/index.svelte-3e33c33a.css","/_app/chunks/vendor-d7b15c1b.js"]),()=>he((()=>import("./pages/blog/[slug].svelte-02dc370f.js")),["/_app/pages/blog/[slug].svelte-02dc370f.js","/_app/chunks/vendor-d7b15c1b.js"])],$e=decodeURIComponent,be=[[/^\/$/,[xe[0]]],[/^\/blog\.json$/],[/^\/blog\/?$/,[xe[1]]],[/^\/blog\/([^/]+?)\.json$/],[/^\/blog\/([^/]+?)\/?$/,[xe[2]],e=>({slug:$e(e[1])})]];function ze(e){for(;e&&"A"!==e.nodeName.toUpperCase();)e=e.parentNode;return e}function _e(){return{x:pageXOffset,y:pageYOffset}}class Pe{constructor({base:e,routes:t}){this.base=e,this.routes=t}init(e){let t;this.renderer=e,e.router=this,"scrollRestoration"in history&&(history.scrollRestoration="manual"),addEventListener("beforeunload",(()=>{history.scrollRestoration="auto"})),addEventListener("load",(()=>{history.scrollRestoration="manual"})),addEventListener("scroll",(()=>{clearTimeout(t),t=setTimeout((()=>{const e=o(o({},history.state||{}),{"sveltekit:scroll":_e()});history.replaceState(e,document.title,window.location.href)}),50)})),addEventListener("click",(e=>{if(e.button||1!==e.which)return;if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;if(e.defaultPrevented)return;const t=ze(e.target);if(!t)return;if(!t.href)return;const s="object"==typeof t.href&&"SVGAnimatedString"===t.href.constructor.name,r=String(s?t.href.baseVal:t.href);if(r===location.href)return void(location.hash||e.preventDefault());if(t.hasAttribute("download")||"external"===t.getAttribute("rel"))return;if(s?t.target.baseVal:t.target)return;const n=new URL(r);if(n.pathname===location.pathname&&n.search===location.search)return;const o=this.parse(n);if(o){const s=t.hasAttribute("sveltekit:noscroll");history.pushState({},"",n.href),this._navigate(o,s?_e():null,[],n.hash),e.preventDefault()}})),addEventListener("popstate",(e=>{if(e.state){const t=new URL(location.href),s=this.parse(t);s?this._navigate(s,e.state["sveltekit:scroll"],[]):location.href=location.href}})),document.body.setAttribute("tabindex","-1"),history.replaceState(history.state||{},"",location.href)}parse(e){if(e.origin!==location.origin)return null;if(!e.pathname.startsWith(this.base))return null;const t=e.pathname.slice(this.base.length)||"/",s=this.routes.filter((([e])=>e.test(t)));if(s.length>0){const r=new URLSearchParams(e.search);return{id:`${t}?${r}`,routes:s,path:t,query:r}}}async goto(e,{noscroll:t=!1,replaceState:s=!1}={},r){const n=new URL(e,function(e){let t=e.baseURI;if(!t){const s=e.getElementsByTagName("base");t=s.length?s[0].href:e.URL}return t}(document)),o=this.parse(n);return o?(history[s?"replaceState":"pushState"]({},"",e),this._navigate(o,t?_e():null,r,n.hash)):(location.href=e,new Promise((()=>{})))}async _navigate(e,t,s,r){this.renderer.notify({path:e.path,query:e.query}),location.pathname.endsWith("/")&&"/"!==location.pathname&&history.replaceState({},"",`${location.pathname.slice(0,-1)}${location.search}`),await this.renderer.update(e,s),document.body.focus();const n=r&&document.getElementById(r.slice(1));t?scrollTo(t.x,t.y):n?scrollTo(0,n.getBoundingClientRect().top+scrollY):scrollTo(0,0)}}function Ee(e){if(e.error){const t="string"==typeof e.error?new Error(e.error):e.error,s=e.status;return t instanceof Error?!s||s<400||s>599?(console.warn('"error" returned from load() without a valid status code — defaulting to 500'),{status:500,error:t}):{status:s,error:t}:{status:500,error:new Error(`"error" property returned from load() must be a string or instance of Error, received type "${typeof t}"`)}}if(e.redirect){if(!e.status||3!==Math.floor(e.status/100))return{status:500,error:new Error('"redirect" property returned from load() must be accompanied by a 3xx status code')};if("string"!=typeof e.redirect)return{status:500,error:new Error('"redirect" property returned from load() must be a string')}}return e}function Se(e){const t=Y(e);let s=!0;return{notify:function(){s=!0,t.update((e=>e))},set:function(e){s=!1,t.set(e)},subscribe:function(e){let r;return t.subscribe((t=>{(void 0===r||s&&t!==r)&&e(r=t)}))}}}class Re{constructor({Root:e,layout:t,target:s,session:r,host:n}){this.Root=e,this.layout=t,this.host=n,this.router=null,this.target=s,this.started=!1,this.current={page:null,query:null,session_changed:!1,nodes:[],contexts:[]},this.caches=new Map,this.prefetching={id:null,promise:null},this.stores={page:Se({}),navigating:Y(null),session:Y(r)},this.$session=null,this.root=null;const o=e=>{const t=ze(e.target);t&&t.hasAttribute("sveltekit:prefetch")&&this.prefetch(new URL(t.href))};let i;addEventListener("touchstart",o),addEventListener("mousemove",(e=>{clearTimeout(i),i=setTimeout((()=>{o(e)}),20)}));let a=!1;this.stores.session.subscribe((async e=>{if(this.$session=e,!a)return;this.current.session_changed=!0;const t=this.router.parse(new URL(location.href));this.update(t,[])})),a=!0}async start(e,t,s){const r={stores:this.stores,error:s,status:t,page:e.page};if(s)r.components=[this.layout.default];else{const t=await this._hydrate(e);if(t.redirect)return void(location.href=new URL(t.redirect,location.href).href);Object.assign(r,t.props),this.current=t.state}this.root=new this.Root({target:this.target,props:r,hydrate:!0}),this.started=!0}notify({path:e,query:t}){dispatchEvent(new CustomEvent("sveltekit:navigation-start")),this.stores.navigating.set({from:{path:this.current.page.path,query:this.current.page.query},to:{path:e,query:t}})}async update(e,t){const s=this.token={},r=await this._get_navigation_result(e);if(s===this.token){if(r.reload)location.reload();else if(r.redirect){if(!(t.length>10||t.includes(this.current.page.path)))return void this.router.goto(r.redirect,{replaceState:!0},[...t,this.current.page.path]);this.root.$set({status:500,error:new Error("Redirect loop")})}else this.current=r.state,this.root.$set(r.props),this.stores.navigating.set(null),await 0;dispatchEvent(new CustomEvent("sveltekit:navigation-end")),this.prefetching.promise=null,this.prefetching.id=null}}async prefetch(e){const t=this.router.parse(e);if(t)return this.prefetching.promise=this._get_navigation_result(t),this.prefetching.id=t.id,await this.prefetching.promise;throw new Error(`Could not prefetch ${e.href}`)}async _get_navigation_result(e){if(this.prefetching.id===e.id)return this.prefetching.promise;for(let t=0;t<e.routes.length;t+=1){const s=e.routes[t],[r,n,o]=s;if(1===s.length)return{reload:!0};let i=t+1;for(;i<e.routes.length;){const t=e.routes[i];if(t[0].toString()!==r.toString())break;1!==t.length&&t[1].forEach((e=>e())),i+=1}const a=n.map((e=>e())),c={host:this.host,path:e.path,params:o?o(s[0].exec(e.path)):{},query:e.query},l=await this._hydrate({nodes:a,page:c});if(l)return l}return{state:{page:null,query:null,session_changed:!1,contexts:[],nodes:[]},props:{status:404,error:new Error(`Not found: ${e.path}`)}}}async _hydrate({nodes:e,page:n}){const i={status:200,error:null,components:[]},a=(e,n)=>{if(!this.started){const n="string"==typeof e?e:e.url,o=document.querySelector(`script[type="svelte-data"][url="${n}"]`);if(o){const e=JSON.parse(o.textContent),{body:n}=e,i=((e,n)=>{var o={};for(var i in e)t.call(e,i)&&n.indexOf(i)<0&&(o[i]=e[i]);if(null!=e&&s)for(var i of s(e))n.indexOf(i)<0&&r.call(e,i)&&(o[i]=e[i]);return o})(e,["body"]);return Promise.resolve(new Response(n,i))}}return fetch(e,n)},c=n.query.toString(),l={page:n,query:c,session_changed:!1,nodes:[],contexts:[]},h=[this.layout,...e],u=[];let d,p;const g={params:Object.keys(n.params).filter((e=>!this.current.page||this.current.page.params[e]!==n.params[e])),query:c!==this.current.query,session:this.current.session_changed,context:!1};try{for(let e=0;e<h.length;e+=1){const t=this.current.nodes[e],s=this.current.contexts[e],{default:r,preload:f,load:m}=await h[e];if(i.components[e]=r,f)throw new Error("preload has been deprecated in favour of load. Please consult the documentation: https://kit.svelte.dev/docs#load");if(!t||r!==t.component||g.params.some((e=>t.uses.params.has(e)))||g.query&&t.uses.query||g.session&&t.uses.session||g.context&&t.uses.context){const t=n.path+c,s=this.caches.get(r),h=s&&s.get(t);let f,v;if(!h||g.context&&h.node.uses.context){f={component:r,uses:{params:new Set,query:!1,session:!1,context:!1}};const e={};for(const s in n.params)Object.defineProperty(e,s,{get:()=>(f.uses.params.add(s),n.params[s]),enumerable:!0});const t=this.$session;if(m&&(v=await m.call(null,{page:{host:n.host,path:n.path,params:e,get query(){return f.uses.query=!0,n.query}},get session(){return f.uses.session=!0,t},get context(){return f.uses.context=!0,o({},d)},fetch:a}),!v))return}else({node:f,loaded:v}=h);if(v){if(v=Ee(v),v.error)return i.error=v.error,i.status=v.status||500,l.nodes=[],{redirect:p,props:i,state:l};if(v.redirect){p=v.redirect;break}if(v.context&&(g.context=!0,d=o(o({},d),v.context)),v.maxage){this.caches.has(r)||this.caches.set(r,new Map);const e=this.caches.get(r),s={node:f,loaded:v};e.set(t,s);let n=!1;const o=setTimeout((()=>{i()}),1e3*v.maxage),i=()=>{e.get(t)===s&&e.delete(t),a(),clearTimeout(o)},a=this.stores.session.subscribe((()=>{n&&i()}));n=!0}u[e]=v.props}l.nodes[e]=f,l.contexts[e]=d}else l.nodes[e]=t,l.contexts[e]=d=s}(await Promise.all(u)).forEach(((e,t)=>{e&&(i[`props_${t}`]=e)})),this.current.page&&n.path===this.current.page.path&&!g.query||(i.page=n)}catch(f){i.error=f,i.status=500,l.nodes=[]}return{redirect:p,props:i,state:l}}}async function qe({paths:e,target:t,session:s,error:r,status:n,nodes:o,page:i}){const a=new Pe({base:e.base,routes:be}),c=new Re({Root:ae,layout:we,target:t,session:s,host:i.host});await c.start({nodes:o,page:i},n,r),a.init(c),dispatchEvent(new CustomEvent("sveltekit:start"))}export{qe as start};