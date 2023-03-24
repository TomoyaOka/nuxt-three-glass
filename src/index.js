import * as THREE from "three";
import { gsap, Power4 } from "gsap";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

/*-- 通常のBlender用 --*/
import fragment from "./shaders/objBlenderFrag.glsl?raw";
import vertex from "./shaders/objBlenderVertex.glsl?raw";

/*-- BG用 --*/
import fragment02 from "./shaders/bgFragment.glsl?raw";
import vertex02 from "./shaders/bgVertex.glsl?raw";

/*--  --*/
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DotScreenShader } from "./CustomShader";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

// reference :
// https://blog.maximeheckel.com/posts/refraction-dispersion-and-other-shader-light-effects/

class App {
  /**
   * レンダー
   */
  static get RENDERER_SETTING() {
    return {
      clearColor: 0x111111,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  /**
   * マテリアル
   */
  static get MATERIAL_SETTING() {
    return {
      color: 0xffffff,
    };
  }
  /**
   * カメラ
   */
  static get CAMERA_PARAM() {
    return {
      fovy: 60,
      aspect: window.innerWidth / window.innerHeight,
      near: 0.01,
      far: 200000.0,
      x: 0.0,
      y: 0.0,
      z: 30,
      lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
    };
  }

  /**
   * @constructor
   */
  constructor() {
    this.renderer;
    this.scene;
    this.camera;
    this.geometory;
    this.material;
    this.mesh;
    this.array = [];
    this.group;
    this.controls;
    this.composer;
    this.model;
    this.ambientLight;
    this.directionalLight;
    this.gltf;
    this.loader;
    this.texture;
    this.Geometry = [];
    this.raycaster;
    this.sampler;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.backgroundGroup = new THREE.Group();
    this.renderTarget;

    this.render = this.render.bind(this);
  }

  _setRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setClearColor(0xcccccc, 1.0);
    this.renderer.setSize(App.RENDERER_SETTING.width, App.RENDERER_SETTING.height);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.physicallyCorrectLights = true;
    this.renderer.toneMappingExposure = 1.75;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // this.renderer.autoClear = false;
    const canvas = document.querySelector("#render");
    canvas.appendChild(this.renderer.domElement);
    //////////////////
    this.mainRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
  }

  _setScene() {
    this.scene = new THREE.Scene();
  }

  _setCamera() {
    this.camera = new THREE.PerspectiveCamera(App.CAMERA_PARAM.fovy, App.CAMERA_PARAM.aspect, App.CAMERA_PARAM.near, App.CAMERA_PARAM.far);
    this.camera.position.set(App.CAMERA_PARAM.x, App.CAMERA_PARAM.y, App.CAMERA_PARAM.z);
    this.camera.lookAt(App.CAMERA_PARAM.lookAt);
    this.camera.updateProjectionMatrix();
    this.controls = new OrbitControls(this.camera, document.body);
  }

  _setLight() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.12);
    this.directionalLight.position.set(-1.0, 110.0, 0.0);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 4096;
    this.directionalLight.shadow.mapSize.height = 4096;
    this.directionalLight.shadow.camera.near = 2;
    this.directionalLight.shadow.camera.far = 15;

    this.scene.add(this.ambientLight);
    this.scene.add(this.directionalLight);
  }

  getGeometryData() {
    return new Promise((resolve) => {
      const gltfPath = "./myBlend.glb";
      const loader = new GLTFLoader();

      loader.load(gltfPath, (gltf) => {
        this.gltf = gltf;
        //モデルの情報を格納
        this.sampler = new MeshSurfaceSampler(this.gltf.scene.children[0]).build();
        resolve();
      });
    });
  }

  _setBlenderModel() {
    //通常のモデル読み込み
    //モデルのジオメトリ情報を格納
    this.blenderGeometry = this.gltf.scene.children[0].geometry;
    const uniforms = {
      uColor: { value: new THREE.Color(0x000000) },
      uGlossiness: { value: 4 },
      uTime: { value: 0.0 },
      uTexture: { value: null },
      winResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight).multiplyScalar(Math.min(window.devicePixelRatio, 2)), // if DPR is 3 the shader glitches 🤷‍♂️
      },
    };
    this.blenderMaterial = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      lights: true,
      uniforms: { ...THREE.UniformsLib.lights, ...uniforms },
      side: THREE.DoubleSide,
    });

    this.blenderMesh = new THREE.Mesh(this.blenderGeometry, this.blenderMaterial);
    // this.scene.add(this.blenderMesh);
    this.blenderMesh.scale.set(0.3, 0.3, 0.3);
    this.blenderMesh.rotation.set(1.7, 0.0, 1.3);
    this.blenderMesh.position.set(0.2, -6, 0.1);
  }

  _setMainBall() {
    const uniforms = {
      uTexture: { value: null },
      winResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight).multiplyScalar(Math.min(window.devicePixelRatio, 2)),
      },
    };
    this.mainGeometory = new THREE.IcosahedronGeometry(10, 10);
    this.mainMaterial = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: uniforms,
    });
    this.mainBall = new THREE.Mesh(this.mainGeometory, this.mainMaterial);
    this.scene.add(this.mainBall);
  }

  _setPlane() {
    this.loader = new THREE.TextureLoader();
    this.texture = this.loader.load("https://images.unsplash.com/photo-1531972111231-7482a960e109?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1742&q=80");
    this.planeGeo = new THREE.PlaneGeometry(20, 10, 100, 100);
    this.planeMaterial = new THREE.MeshBasicMaterial({ map: this.texture });
    this.planeMesh = new THREE.Mesh(this.planeGeo, this.planeMaterial);
    this.scene.add(this.planeMesh);
    this.planeMesh.position.z = -20;
    this.planeMesh.scale.set(10, 10, 10);
  }

  // initPost() {
  //   this.composer = new EffectComposer(this.renderer);
  //   this.composer.addPass(new RenderPass(this.scene, this.camera));
  //   const effect1 = new ShaderPass(DotScreenShader);
  //   effect1.uniforms["scale"].value = 4;
  //   this.composer.addPass(effect1);
  // }

  init() {
    this._setRenderer();
    this._setScene();
    this._setCamera();
    this._setLight();
    this._setBlenderModel();
    this._setPlane();
    this._setMainBall();
    // this.initPost();
  }

  render() {
    requestAnimationFrame(this.render);
    this.controls.update();
    this.blenderMesh.material.uniforms.uTime.value += 0.005;

    this.mainBall.visible = false;
    this.blenderMesh.visible = false;

    this.renderer.setRenderTarget(this.mainRenderTarget);
    this.renderer.render(this.scene, this.camera);

    this.mainBall.material.uniforms.uTexture.value = this.mainRenderTarget.texture;
    this.blenderMesh.material.uniforms.uTexture.value = this.mainRenderTarget.texture;

    this.renderer.setRenderTarget(null);
    this.mainBall.visible = true;
    this.blenderMesh.visible = true;

    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.getGeometryData().then(() => {
    app.init();
    app.render();
    window.addEventListener("resize", () => {
      app.onResize();
    });
  });
});

export {};
