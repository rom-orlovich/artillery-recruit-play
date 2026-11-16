const REFRESH_INTERVAL_MS = 1000;
const MAX_ENTRIES = 10;
const LOG_CLIP_CHARS = 300;
const OVERLAY_Z_INDEX = '99999';
const COPY_LABEL = 'העתק';

function clipLog(text) {
  return String(text || '').slice(0, LOG_CLIP_CHARS);
}

export function initDiagOverlay(renderer, scene) {
  const entries = [];
  const pushEntry = (line) => {
    entries.push(line);
    if (entries.length > MAX_ENTRIES) {
      entries.splice(0, entries.length - MAX_ENTRIES);
    }
  };

  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = (glCtx, program, vertexShader, fragmentShader) => {
    const progLog = clipLog(program ? glCtx.getProgramInfoLog(program) : '');
    const vsLog = clipLog(vertexShader ? glCtx.getShaderInfoLog(vertexShader) : '');
    const fsLog = clipLog(fragmentShader ? glCtx.getShaderInfoLog(fragmentShader) : '');
    pushEntry(`SHADER ${progLog} | VS ${vsLog} | FS ${fsLog}`);
  };

  window.addEventListener('error', (event) => {
    pushEntry(`ERR ${clipLog(event.message || event.error || 'unknown')}`);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || event.reason || 'unknown';
    pushEntry(`REJ ${clipLog(reason)}`);
  });

  const origConsoleError = console.error.bind(console);
  console.error = (...args) => {
    const msg = args.map((item) => (item && item.message ? item.message : String(item))).join(' ');
    pushEntry(`CON ${clipLog(msg)}`);
    origConsoleError(...args);
  };

  const gl = renderer.getContext();
  const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
  const glRenderer = debugExt
    ? gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  const fragUniforms = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
  const vertUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
  const varyingVectors = gl.getParameter(gl.MAX_VARYING_VECTORS);
  const texUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
  const texSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const staticHeader =
    `GL: ${glRenderer}\n` +
    `LIMITS: fragU=${fragUniforms} vertU=${vertUniforms} var=${varyingVectors} texU=${texUnits} texSz=${texSize}`;

  const panel = document.createElement('div');
  panel.style.position = 'fixed';
  panel.style.top = '4px';
  panel.style.left = '4px';
  panel.style.zIndex = OVERLAY_Z_INDEX;
  panel.style.maxWidth = '92vw';
  panel.style.maxHeight = '45vh';
  panel.style.overflow = 'auto';
  panel.style.font = '11px monospace';
  panel.style.color = '#ffffff';
  panel.style.background = 'rgba(0,0,0,0.75)';
  panel.style.direction = 'ltr';
  panel.style.whiteSpace = 'pre-wrap';
  panel.style.pointerEvents = 'auto';
  panel.style.padding = '4px 6px';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = COPY_LABEL;
  copyBtn.style.display = 'block';
  copyBtn.style.marginBottom = '4px';
  copyBtn.style.font = '11px monospace';

  const output = document.createElement('div');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText?.(output.textContent);
  });

  panel.appendChild(copyBtn);
  panel.appendChild(output);
  document.body.appendChild(panel);

  const refresh = () => {
    let lightCount = 0;
    if (scene) {
      scene.traverse((object) => {
        if (object.isLight) lightCount += 1;
      });
    }
    const programCount = renderer.info?.programs?.length ?? 0;
    const renderCalls = renderer.info?.render?.calls ?? 0;
    const renderTriangles = renderer.info?.render?.triangles ?? 0;
    const contextLost = gl.isContextLost();
    const statsLine =
      `LIGHTS: ${lightCount} | PROGS: ${programCount} | CALLS: ${renderCalls} | TRIS: ${renderTriangles} | LOST: ${contextLost}`;
    const logLines = entries.length > 0 ? entries.join('\n') : 'ERRORS: none';
    output.textContent = `${staticHeader}\n${statsLine}\n${logLines}`;
  };

  refresh();
  return setInterval(refresh, REFRESH_INTERVAL_MS);
}
