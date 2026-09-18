import * as THREE from "three";

import { GLTFLoader }
from "three/addons/loaders/GLTFLoader.js";

import { MindARThree }
from "mindar-image-three";


const container =
    document.querySelector("#ar-container");

const startButton =
    document.querySelector("#startButton");

const learnMore =
    document.querySelector("#learnMore");

const hint =
    document.querySelector("#hint");



// ---------------------------------------------
// CREATE MINDAR
// ---------------------------------------------

const mindarThree = new MindARThree({

    container: container,

    imageTargetSrc: "./targets.mind",

    uiLoading: "yes",

    uiScanning: "no",

    uiError: "yes"

});


const {
    renderer,
    scene,
    camera
} = mindarThree;



// ---------------------------------------------
// LIGHTING
// ---------------------------------------------

const ambientLight =
    new THREE.AmbientLight(
        0xffffff,
        1.5
    );

scene.add(ambientLight);


const directionalLight =
    new THREE.DirectionalLight(
        0xffffff,
        2
    );

directionalLight.position.set(
    1,
    2,
    3
);

scene.add(directionalLight);



// ---------------------------------------------
// IMAGE TARGET
// ---------------------------------------------

const anchor =
    mindarThree.addAnchor(0);



// ---------------------------------------------
// LOAD 3D MODEL
// ---------------------------------------------

const loader =
    new GLTFLoader();


let mixer = null;


loader.load(

    "./model.glb",

    (gltf) => {

        const model = gltf.scene;


        // -------------------------------------
        // AUTO SCALE
        // -------------------------------------

        const originalBox =
            new THREE.Box3()
                .setFromObject(model);

        const size =
            originalBox.getSize(
                new THREE.Vector3()
            );


        const largestDimension =
            Math.max(
                size.x,
                size.y,
                size.z
            );


        // 0.65 = approximately 65%
        // of target image width

        const scale =
            0.65 / largestDimension;


        model.scale.setScalar(scale);



        // -------------------------------------
        // ROTATION
        //
        // Makes a normal Y-UP model stand
        // out from a flat business card.
        // -------------------------------------

        model.rotation.x =
            Math.PI / 2;


        model.updateMatrixWorld(true);



        // -------------------------------------
        // CENTER MODEL ON CARD
        // -------------------------------------

        const box =
            new THREE.Box3()
                .setFromObject(model);


        const center =
            box.getCenter(
                new THREE.Vector3()
            );


        model.position.x -= center.x;
        model.position.y -= center.y;


        // Put bottom of model on card

        model.position.z -= box.min.z;



        // -------------------------------------
        // ADD TO IMAGE TARGET
        // -------------------------------------

        anchor.group.add(model);



        // -------------------------------------
        // PLAY GLB ANIMATIONS
        // -------------------------------------

        if (
            gltf.animations &&
            gltf.animations.length > 0
        ) {

            mixer =
                new THREE.AnimationMixer(model);


            gltf.animations.forEach(
                (clip) => {

                    mixer
                        .clipAction(clip)
                        .play();

                }
            );

        }

    },

    undefined,

    (error) => {

        console.error(
            "Failed loading model:",
            error
        );

    }

);



// ---------------------------------------------
// TARGET FOUND
// ---------------------------------------------

anchor.onTargetFound = () => {

    console.log("Business card found");

    hint.textContent =
        "Business card detected";

    learnMore.classList.add(
        "visible"
    );

};



// ---------------------------------------------
// TARGET LOST
// ---------------------------------------------

anchor.onTargetLost = () => {

    console.log("Business card lost");

    hint.textContent =
        "Point camera at the business card";

    // Intentionally NOT hiding Learn More.
    // This makes it easier to tap even if
    // tracking is briefly lost.

};



// ---------------------------------------------
// START AR
// ---------------------------------------------

startButton.addEventListener(

    "click",

    async () => {

        startButton.style.display =
            "none";

        hint.textContent =
            "Allow camera access...";


        try {

            await mindarThree.start();


            hint.textContent =
                "Point camera at the business card";


            const clock =
                new THREE.Clock();


            renderer.setAnimationLoop(
                () => {

                    const delta =
                        clock.getDelta();


                    if (mixer) {

                        mixer.update(delta);

                    }


                    renderer.render(
                        scene,
                        camera
                    );

                }
            );


        }

        catch (error) {

            console.error(error);

            hint.textContent =
                "Unable to start camera";

            startButton.style.display =
                "block";

        }

    }

);
