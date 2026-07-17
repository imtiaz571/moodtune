const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl');

const vsSource = `
    attribute vec4 aVertexPosition;
    void main() {
        gl_Position = aVertexPosition;
    }
`;

const fsSource = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;

    vec3 getBackground(vec2 uv) {
        vec2 p = uv * 2.0 - 1.0;
        float t = u_time * 0.4;
        
        float v = sin(p.x * 4.0 + t) + cos(p.y * 3.0 + t) + sin(p.x * p.y * 6.0 - t);
        v *= 0.5;

        // Darkened color palette
        vec3 col1 = vec3(0.01, 0.0, 0.02);
        vec3 col2 = vec3(0.3, 0.15, 0.2);
        vec3 col3 = vec3(0.05, 0.1, 0.3);
        vec3 col4 = vec3(0.2, 0.05, 0.15);

        vec3 color = mix(col1, col2, smoothstep(-1.0, 1.0, v));
        color = mix(color, col3, smoothstep(-0.5, 0.5, sin(p.y * 6.0 - t)));
        color = mix(color, col4, smoothstep(0.0, 1.0, cos(p.x * 5.0 + t)));

        float bright = smoothstep(0.7, 1.0, sin(v * 15.0));
        color += vec3(0.5, 0.4, 0.45) * bright * 0.2; // Further reduced brightness

        return color * 0.5; // Overall darkening factor
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        
        float numBands = 45.0;
        float bandId = floor(uv.y * numBands);
        float bandFract = fract(uv.y * numBands);

        float wave = sin(uv.x * 6.0 + u_time * 1.5 + bandId * 0.2) * 0.04;
        float warp = cos(uv.x * 3.0 - u_time + bandId * 0.1) * 0.03;

        vec2 sampleUV = uv;
        sampleUV.y = (bandId + 0.5) / numBands + wave;
        sampleUV.x += warp;

        float shift = 0.009;
        float r = getBackground(sampleUV + vec2(shift, 0.0)).r;
        float g = getBackground(sampleUV).g;
        float b = getBackground(sampleUV - vec2(shift, 0.0)).b;

        vec3 finalColor = vec3(r, g, b);

        float edgeShadow = smoothstep(0.0, 0.15, bandFract) * smoothstep(1.0, 0.85, bandFract);
        finalColor *= edgeShadow * 0.9 + 0.1; // Deeper shadows between bands
        
        float highlight = pow(1.0 - edgeShadow, 2.5);
        finalColor += vec3(0.8) * highlight * 0.1; // Reduced highlight intensity

        // Output color with lowered opacity
        gl_FragColor = vec4(finalColor, 0.7); 
    }
`;

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}

const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
const shaderProgram = gl.createProgram();

gl.attachShader(shaderProgram, vertexShader);
gl.attachShader(shaderProgram, fragmentShader);
gl.linkProgram(shaderProgram);
gl.useProgram(shaderProgram);

const positions = new Float32Array([-1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0]);
const positionBuffer = gl.createBuffer();

gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

const vertexPosition = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
gl.enableVertexAttribArray(vertexPosition);
gl.vertexAttribPointer(vertexPosition, 2, gl.FLOAT, false, 0, 0);

const resolutionUniformLocation = gl.getUniformLocation(shaderProgram, "u_resolution");
const timeUniformLocation = gl.getUniformLocation(shaderProgram, "u_time");

function resizeCanvasToDisplaySize(canvas) {
    const displayWidth  = window.innerWidth;
    const displayHeight = window.innerHeight;
    const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;
    
    if (needResize) {
        canvas.width  = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    
    return needResize;
}

function render(time) {
    resizeCanvasToDisplaySize(gl.canvas);
    gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(timeUniformLocation, time * 0.001);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
}

requestAnimationFrame(render);
