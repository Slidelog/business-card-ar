import * as THREE from "three";

import {
    GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";

import {
    MindARThree
} from "mindar-image-three";



// -------------------------------------------------
// UI
// -------------------------------------------------

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



// -------------------------------------------------
// MINDAR
// -------------------------------------------------

const mindarThree =
    new MindARThree({

        container: container,

        imageTargetSrc:
            "./targets.mind",


        /*
        We disable MindAR's built-in white loading
        and scanning overlays because we're making
        our own UI.
        */

        uiLoading: "no",

        uiScanning: "no",

        uiError: "yes"

    });



const {
    renderer,
    scene,
    camera
} = mindarThree;



// -------------------------------------------------
// LIGHTING
// -------------------------------------------------

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



// -------------------------------------------------
// IMAGE TARGET
// -------------------------------------------------

const anchor =
    mindarThree.addAnchor(0);



// -------------------------------------------------
// LOAD MODEL
// -------------------------------------------------

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



        // Play animations if GLB has any

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



// -------------------------------------------------
// TARGET FOUND
// -------------------------------------------------

anchor.onTargetFound =
    () => {


        console.log(
            "Business card found"
        );


        hasTrackedTarget =
            true;



        // Stop delayed message

        if (
            scanMessageTimer !== null
        ) {


            clearTimeout(
                scanMessageTimer
            );


            scanMessageTimer =
                null;

        }



        // Fade instruction out

        scanMessage.classList.remove(
            "visible"
        );



        /*
        Keep logo visible.

        You asked for it to fade IN
        after Start AR is pressed.
        */


        // Show Learn More

        learnMore.classList.add(
            "visible"
        );

    };



// -------------------------------------------------
// TARGET LOST
// -------------------------------------------------

anchor.onTargetLost =
    () => {


        console.log(
            "Business card lost"
        );


        /*
        For now we leave the Learn More
        button visible after the first
        successful detection.
        */


    };



// -------------------------------------------------
// START AR
// -------------------------------------------------

startButton.addEventListener(

    "click",


    async () => {


        /*
        IMPORTANT:

        Start MindAR immediately from
        the user's click.

        This keeps camera startup directly
        associated with the user interaction.
        */


        try {


            const startPromise =
                mindarThree.start();



            // Fade Start AR out

            startButton.classList.add(
                "hidden"
            );



            // Fade logo IN

            brandLogo.classList.add(
                "visible"
            );



            // Wait for MindAR/camera

            await startPromise;



            /*
            Remove Start button entirely
            after transition.
            */

            setTimeout(
                () => {

                    startButton.style.display =
                        "none";

                },
                400
            );



            /*
            After camera successfully starts,
            wait 5 seconds.

            If no card has been found,
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



            // Rendering loop

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
                "AR startup failed:",
                error
            );



            // Restore Start button

            startButton.style.display =
                "block";


            startButton.classList.remove(
                "hidden"
            );



            // Hide logo

            brandLogo.classList.remove(
                "visible"
            );



            // Show useful error instead of blank screen

            scanMessage.textContent =
                "Unable to access the camera. Please check your camera permissions.";


            scanMessage.classList.add(
                "visible"
            );


        }


    }

);
