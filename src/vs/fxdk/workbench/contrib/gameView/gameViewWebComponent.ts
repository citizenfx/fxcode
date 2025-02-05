const vertexShaderSrc = `
  attribute vec2 a_position;
  attribute vec2 a_texcoord;
  uniform mat3 u_matrix;
  varying vec2 textureCoordinate;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    textureCoordinate = a_texcoord;
  }
`;

const fragmentShaderSrc = `
varying highp vec2 textureCoordinate;
uniform sampler2D external_texture;
void main()
{
  gl_FragColor = texture2D(external_texture, textureCoordinate);
}
`;

function attachShader(gl: WebGLRenderingContext, program: WebGLProgram, type: number, src: string) {
  const shader = gl.createShader(type);
	if (!shader) {
		throw new Error('Failed to create game-view shader');
	}

  gl.shaderSource(shader, src);
  gl.attachShader(program, shader);

  return shader;
}

function compileAndLinkShaders(gl: WebGLRenderingContext, program: WebGLProgram, vs: WebGLShader, fs: WebGLShader) {
  gl.compileShader(vs);
  gl.compileShader(fs);

  gl.linkProgram(program);

  if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return;
  }

  console.error('Link failed:', gl.getProgramInfoLog(program));
  console.error('vs log:', gl.getShaderInfoLog(vs));
  console.error('fs log:', gl.getShaderInfoLog(fs));

  throw new Error('Failed to compile shaders');
}

function createTexture(gl: WebGLRenderingContext) {
  const tex = gl.createTexture();

  const texPixels = new Uint8Array([0, 0, 255, 255]);

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, texPixels);

  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

  // Magic hook sequence
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  // Reset
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return tex;
}

function createBuffers(gl: WebGLRenderingContext) {
  const vertexBuff = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuff);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    1, 1,
  ]), gl.STATIC_DRAW);

  const texBuff = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuff);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 1,
    1, 1,
    0, 0,
    1, 0,
  ]), gl.STATIC_DRAW);

  return { vertexBuff, texBuff };
}

function createProgram(gl: WebGLRenderingContext) {
  const program = gl.createProgram();
	if (!program) {
		throw new Error('Failed to create game-view shader program');
	}

  const vertexShader = attachShader(gl, program, gl.VERTEX_SHADER, vertexShaderSrc);
  const fragmentShader = attachShader(gl, program, gl.FRAGMENT_SHADER, fragmentShaderSrc);

  compileAndLinkShaders(gl, program, vertexShader, fragmentShader);

  gl.useProgram(program);

  const vloc = gl.getAttribLocation(program, "a_position");
  const tloc = gl.getAttribLocation(program, "a_texcoord");

  return { program, vloc, tloc };
}

interface GameViewRunlet {
	canvas: HTMLCanvasElement,
	gl: WebGLRenderingContext,
	resize(w: number, h: number): void,
	draw(): void,
}

function createGameView() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', {
    antialias: false,
    depth: false,
    alpha: false,
    stencil: false,
    desynchronized: true,
    powerPreference: 'high-performance',
  });
	if (!gl) {
		throw new Error('Failed to acquire webgl context for game-view');
	}

  const gameView: GameViewRunlet = {
    canvas,
    gl,
    resize: (width: number, height: number) => {
      resizeGame(width, height);
      gl.viewport(0, 0, width, height);
      gl.canvas.width = width;
      gl.canvas.height = height;
    },
    draw() {
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    	gl.finish();
		}
  };

  const tex = createTexture(gl);
  const { program, vloc, tloc } = createProgram(gl);
  const { vertexBuff, texBuff } = createBuffers(gl);

  gl.useProgram(program);

  gl.bindTexture(gl.TEXTURE_2D, tex);

  gl.uniform1i(gl.getUniformLocation(program, "external_texture"), 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuff);
  gl.vertexAttribPointer(vloc, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vloc);

  gl.bindBuffer(gl.ARRAY_BUFFER, texBuff);
  gl.vertexAttribPointer(tloc, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(tloc);

  return gameView;
}

function mapMouseButton(button: number) {
  if (button === 2) {
    return 1;
  }

  if (button == 1) {
    return 2;
  }

  return button;
}

function mapKey(which: number, location: number) {
  // Alt
  if (which === 18) {
    return location === 1
      ? 0xA4
      : 0xA5;
  }

  // Ctrl
  if (which === 17) {
    return location === 1
      ? 0xA2
      : 0xA3;
  }

  // Shift
  if (which === 16) {
    return location === 1
      ? 0xA0
      : 0xA1;
  }

  return which;
}

function isLMB(e: MouseEvent) {
  return e.button === 0;
}


export class GameView extends HTMLElement {
	/**
	 * DEFAULT MODE
	 *
	 * GameView fully captures all input, locks pointer to itself
	 */
	public static readonly ModeControling = 0;

	/**
	 * GameView only captures all keyboard input and mouse movements while user holding LeftMouseButton over it
	 *
	 * No mouse buttons state will be passed to game
	 */
	public static readonly ModeObserving = 1;

	public mouseMoveMultiplier = 1.0;

	public animationFrame: ReturnType<typeof requestAnimationFrame> | undefined;

  get mode() {
    return this._mode;
  }

  set mode(newMode) {
    this._mode = newMode;

    this.dispatchEvent(new CustomEvent('modechange', {
      bubbles: true,
      cancelable: false,
      composed: true,
      detail: {
        mode: this.mode,
      },
    }));
  }

  get isObservingMode() {
    return this.mode === GameView.ModeObserving;
  }

  get isControlingMode() {
    return this.mode === GameView.ModeControling;
  }

	private _mode: number = GameView.ModeControling;

	private _keysState: boolean[] = [];
	private _buttonsState: boolean[] = [];

	private _acceptInput = false;
	// private _acceptMouseButtons = false;

	private _pointerLocked = false;
	private _fullscreenActive = false;

	// private _observingModeActiveKeys: Set<number> = new Set();
	// private _observingModeActiveMouseButtons: Set<number> = new Set();

	private gameView: GameViewRunlet;
	private _canvas: HTMLCanvasElement;

	private _hint: HTMLElement;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
			:host {
				display: block;

				position: relative;

				width: 60vw;
				height: 60vh;
      }

      hint {
        display: block;

        position: absolute;
        top: 10vw;
        left: 50%;
        transform: translateX(-50%);

        padding: 5px 15px;

        backdrop-filter: blur(20px);
        background-color: hsla(226, 23%, 11%, .45);

        border: solid 1px hsla(226, 23%, 11%, .1);
        border-radius: 4px;

        color: white;
        font-size: 14px;
        font-family: 'Segoe UI';
        font-weight: 300;
        letter-spacing: 1px;

        pointer-events: none;

        opacity: 0;

        z-index: 2;
      }

      @keyframes hint-animation {
        0% {
          opacity: 0;
        }
        25% {
          opacity: 1;
        }
        75% {
          opacity: 1;
        }
        100% {
          opacity: 0;
        }
      }

      hint.active {
        animation-name: hint-animation;
        animation-duration: 2s;
      }

			canvas {
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
        height: 100%;

        z-index: 1;
			}
		`;

    this.gameView = createGameView();

    this._canvas = this.gameView.canvas;

    this._hint = document.createElement('hint');
    this._hint.innerHTML = `<strong>Shift+Esc</strong> to release mouse`;

    this._createHandlers();

    shadow.appendChild(style);
    shadow.appendChild(this._canvas);
    shadow.appendChild(this._hint);
  }

	resize(width: number, height: number) {
		this.gameView.resize(width, height);
	}

  /**
   * @lifecycle
   */
  connectedCallback() {
    this._addEventListeners();

		this.unpauseRendering();
  }

  /**
   * @lifecycle
   */
  disconnectedCallback() {
    this._removeEventListeners();

		this.pauseRendering();
  }

	private drawRoutine = () => {
		this.gameView.draw();

		this.animationFrame = requestAnimationFrame(this.drawRoutine);
	};

	pauseRendering() {
		if (this.animationFrame !== undefined) {
			cancelAnimationFrame(this.animationFrame);
			this.animationFrame = undefined;
		}
	}

	unpauseRendering() {
		if (this.animationFrame === undefined) {
			this.drawRoutine();
		}
	}

  /**
   * @api
   */
  enterFullscreenControlingMode() {
    this.mode = GameView.ModeControling;

    setRawMouseCapture(true);
    this.requestPointerLock();
    this.requestFullscreen();
  }

  /**
   * @api
   */
  lockPointer() {
    if (!this.isControlingMode) {
      console.warn('game-view is not in controling mode thus it is impossible to lock pointer');
      return false;
    }

    this.requestPointerLock();
    return true;
  }

  /**
   * @api
   */
  enterFullscreen() {
    if (!this.isControlingMode) {
      console.warn('game-view is not in controling mode thus it is impossible to enter fullscreen');
      return false;
    }

    this.requestFullscreen();
    return true;
  }

	// HAXX
	[key: string]: any;

  _addEventListeners() {
    this.addEventListener('mousedown', this._handleMousedown);
    this.addEventListener('mouseup', this._handleMouseup);

    this.addEventListener('mousemove', this._handleMousemove);
    this.addEventListener('mousewheel', this._handleMousewheel);

    document.addEventListener('keydown', this._handleKeydown, true);
    document.addEventListener('keyup', this._handleKeyup, true);

    document.addEventListener('pointerlockchange', this._handlePointerLockChange);
    document.addEventListener('fullscreenchange', this._handleFullscreenChange);

    document.addEventListener('mousemove', this._handleDocumentMouseMove);

    window.addEventListener('blur', this._handleWindowBlur);
  }

  _removeEventListeners() {
    this.removeEventListener('mousedown', this._handleMousedown);
    this.removeEventListener('mouseup', this._handleMouseup);

    this.removeEventListener('mousemove', this._handleMousemove);
    this.removeEventListener('mousewheel', this._handleMousewheel);

    document.removeEventListener('keydown', this._handleKeydown, true);
    document.removeEventListener('keyup', this._handleKeyup, true);

    document.removeEventListener('pointerlockchange', this._handlePointerLockChange);
    document.removeEventListener('fullscreenchange', this._handleFullscreenChange);

    document.removeEventListener('mousemove', this._handleDocumentMouseMove);

    window.removeEventListener('blur', this._handleWindowBlur);
  }

  _resetStates() {
    setInputChar('\0');

    this._keysState.map((active, key) => {
      if (active) {
        this._keysState[key] = false;
        setKeyState(key, false);
      }
    });

    this._buttonsState.map((active, button) => {
      if (active) {
        this._buttonsState[button] = false;
        setMouseButtonState(button, false);
      }
    });
  }

  _createHandlers() {
    this._handleWindowBlur = () => {
      this._resetStates();
    };

    this._handlePointerLockChange = () => {
      const pointerLocked = document.pointerLockElement === this;
      const wasPointerLocked = this._pointerLocked;

      this._pointerLocked = pointerLocked;
      this._acceptInput = pointerLocked;

      if (pointerLocked !== wasPointerLocked) {
        setRawMouseCapture(pointerLocked);

        this.dispatchEvent(new CustomEvent('pointerlockchange', {
          bubbles: true,
          cancelable: false,
          composed: true,
          detail: {
            locked: pointerLocked,
          },
        }));

        if (pointerLocked) {
          this._hint.classList.add('active');
        } else {
          this._hint.classList.remove('active');
        }
      }

      if (!pointerLocked && wasPointerLocked) {
        this._resetStates();
      }
    };
    this._handleFullscreenChange = () => {
      const fullscreenActive = document.fullscreenElement === this;

      this._fullscreenActive = fullscreenActive;

			if (fullscreenActive) {
				const rect = this.getBoundingClientRect();

				this.resize(rect.width, rect.height);
			}
    };

    this._handleDocumentMouseMove = (e: MouseEvent) => {
      // Handling cases when pointer was unlocked externally
      // Like if you alt-tab from FxDK or something like that
      if (this._pointerLocked && e.target !== this) {
        document.exitPointerLock();
      }
    };

    this._handleMousedown = (e: MouseEvent) => {
      const leftMouseButton = isLMB(e);

      // Preventing default behaviour for other mouse buttons
      if (!leftMouseButton) {
        e.preventDefault();
      }

      if (this.isObservingMode && leftMouseButton) {
        this._acceptInput = true;
      }

      if (this.isControlingMode) {
        // Lock mouse pointer to GameView if it's LMB
        if (!this._pointerLocked && leftMouseButton) {
          return this.requestPointerLock();
        }

        // Pass mouse button state to game
        this._buttonsState[e.button] = true;
        setMouseButtonState(mapMouseButton(e.button), true);
      }
    };
    this._handleMouseup = (e: MouseEvent) => {
      e.preventDefault();

      const leftMouseButton = isLMB(e);

      if (this.isObservingMode && leftMouseButton) {
        this._acceptInput = false;

        this._resetStates();
      }

      if (this.isControlingMode) {
        // Pass mouse button state to game
        this._buttonsState[e.button] = false;
        setMouseButtonState(mapMouseButton(e.button), false);
      }
    };
    this._handleMousewheel = (e: WheelEvent) => {
      e.preventDefault();

      if (this._acceptInput) {
        sendMouseWheel(-e.deltaY);
      }
    };
    this._handleMousemove = (e: MouseEvent) => {
      e.preventDefault();

      if (this._acceptInput) {
        // sendMousePos(e.movementX, e.movementY);
      }
    };

    this._handleKeydown = (e: KeyboardEvent) => {
      if (!this._acceptInput) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // Handling pointer unlock
      if (e.key === 'Escape' && e.shiftKey) {
        if (this._fullscreenActive) {
          document.exitFullscreen();
        }

        if (this._pointerLocked) {
          document.exitPointerLock();
        }

        return;
      }

      const vk = mapKey(e.which, e.location);

      // Don't spam
      if (this._keysState[vk]) {
        return;
      }

      this._keysState[vk] = true;
      setKeyState(vk, true);

      if (e.key.length === 1) {
        setInputChar(e.key);
      } else if (e.key.length > 2) {
        // "BackSpace", "Shift", "Alt", ...
        // Use the charcode instead, but don't do F-Keys.
        setInputChar(e.which);
      }
    };
    this._handleKeyup = (e: KeyboardEvent) => {
      if (!this._acceptInput) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const vk = mapKey(e.which, e.location);

      this._keysState[vk] = false;
      setKeyState(vk, false);
      setInputChar('\0');
    };
  }
}

export function registerGameViewComponent() {
	try {
		window.customElements.define('game-view', GameView);
	} catch (e) {
		console.error('Failed to define game-view WebComponent', e);
	}
}
