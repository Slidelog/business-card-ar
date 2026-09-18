import * as THREE from "three";

import {
    GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";

import {
    MindARThree
} from "mindar-image-three";



const container =
    document.querySelector("#ar-container");


const startButton =
    document.querySelector("#startButton");


const learnMore =
    document.querySelector("#learnMore");


const brandLogo =
    document.querySelector("#brandLogo");


const scanMessage =
    document.querySelector("#scanMessage");



let scanMessageTimer = null;

let hasTrackedTarget = false;



// ---------------------------------------------
// MINDAR
// ---------------------------------------------

const mindarThree =
    new MindARThree({

        container: container,

        imageTargetSrc:
            "./targets.mind",

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


scene.add(
    ambientLight
);



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


scene.add(
    directionalLight
);



// ---------------------------------------------
// IMAGE TARGET
// ---------------------------------------------

const anchor =
    mindarThree.addAnchor(0);



// ---------------------------------------------
// MODEL
// ---------------------------------------------

const loader =
    new GLTFLoader();


let mixer = null;



loader.load(

    "./model.glb",


    (gltf) => {

        const model =
            gltf.scene;



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



        const scale =
            0.65 /
            largestDimension;



        model.scale.setScalar(
            scale
        );



        model.rotation.x =
            Math.PI / 2;



        model.updateMatrixWorld(
            true
        );



        const box =
            new THREE.Box3()
                .setFromObject(model);



        const center =
            box.getCenter(
                new THREE.Vector3()
            );



        model.position.x -=
            center.x;


        model.position.y -=
            center.y;


        model.position.z -=
            box.min.z;



        anchor.group.add(
            model
        );



        if (
            gltf.animations &&
            gltf.animations.length > 0
        ) {

            mixer =
                new THREE.AnimationMixer(
                    model
                );


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

anchor.onTargetFound =
    () => {

        console.log(
            "Business card found"
        );


        hasTrackedTarget =
            true;


        // Cancel delayed instruction

        if (
            scanMessageTimer
        ) {

            clearTimeout(
                scanMessageTimer
            );

        }


        // Hide scanning instruction

        scanMessage.classList.remove(
            "visible"
        );


        // Fade logo out

        brandLogo.classList.remove(
            "visible"
        );


        // Show Learn More

        learnMore.classList.add(
            "visible"
        );

    };



// ---------------------------------------------
// TARGET LOST
// ---------------------------------------------

anchor.onTargetLost =
    () => {

        console.log(
            "Business card lost"
        );


        /*
        We deliberately keep Learn More visible
        once the user has successfully found the card.
        */

    };



// ---------------------------------------------
// START AR
// ---------------------------------------------

startButton.addEventListener(

    "click",


    async () => {


        // Hide Start button

        startButton.style.display =
            "none";



        // Fade logo IN

        brandLogo.classList.add(
            "visible"
        );



        try {

            await mindarThree.start();



            /*
            If the user has still not found
            the card after 5 seconds,
            show the instruction.
            */

            scanMessageTimer =
                setTimeout(
                    () => {

                        if (
                            !hasTrackedTarget
                        ) {

                            scanMessage
                                .classList
                                .add(
                                    "visible"
                                );

                        }

                    },
                    5000
                );



            const clock =
                new THREE.Clock();



            renderer.setAnimationLoop(
                () => {


                    const delta =
                        clock.getDelta();



                    if (
                        mixer
                    ) {

                        mixer.update(
                            delta
                        );

                    }



                    renderer.render(
                        scene,
                        camera
                    );

                }
            );


        }

        catch (
            error
        ) {


            console.error(
                error
            );


            // Show start again

            startButton.style.display =
                "block";


            // Hide logo again

            brandLogo.classList.remove(
                "visible"
            );


        }

    }

);
