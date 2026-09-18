import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MindARThree } from "mindar-image-three";

const container = document.querySelector("#ar-container");
const startButton = document.querySelector("#startButton");
const learnMore = document.querySelector("#learnMore");
const brandLogo = document.querySelector("#brandLogo");
const statusText = document.querySelector("#statusText");

const mindarThree = new MindARThree({
  container: container,
  imageTargetSrc: "./targets.mind",
  uiLoading: "yes",
  uiScanning: "no",
  uiError: "yes"
});

const { renderer, scene, camera } = mindarThree;

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(1, 2, 3);
scene.add(directionalLight);

const anchor = mindarThree.addAnchor(0);

const loader = new GLTFLoader();
let mixer = null;
let hasDetectedOnce = false;

loader.load(
  "./model.glb",
  (gltf) => {
    const model = gltf.scene;

    const originalBox = new THREE.Box3().setFromObject(model);
    const size = originalBox.getSize(new THREE.Vector3());
    const largestDimension = Math.max(size.x, size.y, size.z);

    const scale = 0.65 / largestDimension;
    model.scale.setScalar(scale);

    model.rotation.x = Math.PI / 2;
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());

    model.position.x -= center.x;
    model.position.y -= center.y;
    model.position.z -= box.min.z;

    anchor.group.add(model);

    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model);

      gltf.animations.forEach((clip) => {
        mixer.clipAction(clip).play();
      });
    }
  },
  undefined,
  (error) => {
    console.error("Failed loading model:", error);
  }
);

anchor.onTargetFound = () => {
  console.log("Business card found");

  hasDetectedOnce = true;

  brandLogo.classList.add("hidden");
  statusText.classList.add("hidden");
  learnMore.classList.add("visible");
};

anchor.onTargetLost = () => {
  console.log("Business card lost");

  // Keep Learn More visible after first successful detection
  // to avoid flickering and keep UX smooth.
  if (!hasDetectedOnce) {
    brandLogo.classList.remove("hidden");
    statusText.classList.remove("hidden");
  }
};

startButton.addEventListener("click", async () => {
  startButton.style.display = "none";
  statusText.textContent = "Allow camera access, then point at the business card.";

  try {
    await mindarThree.start();

    statusText.textContent = "Point your camera at the business card.";

    const clock = new THREE.Clock();

    renderer.setAnimationLoop(() => {
      const delta = clock.getDelta();

      if (mixer) {
        mixer.update(delta);
      }

      renderer.render(scene, camera);
    });
  } catch (error) {
    console.error(error);
    statusText.textContent = "Unable to start camera.";
    startButton.style.display = "block";
  }
});
