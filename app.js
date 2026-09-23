// ================================================================
// HTML ELEMENTS
// ================================================================

const container =
    document.querySelector(
        "#ar-container"
    );

const startButton =
    document.querySelector(
        "#startButton"
    );

const learnMore =
    document.querySelector(
        "#learnMore"
    );

const brandLogo =
    document.querySelector(
        "#brandLogo"
    );

const scanMessage =
    document.querySelector(
        "#scanMessage"
    );



// ================================================================
// IMPORTS
// ================================================================

import {
    GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";

import * as THREE from "three";

import {
    MindARThree
} from "mindar-image-three";



// ================================================================
// STATE
// ================================================================

// 5 second help-message timer
let scanMessageTimer =
    null;


// Has the target ever been detected?
let hasTrackedTarget =
    false;


// Is MindAR currently seeing the target?
let targetVisible =
    false;


// Used to make the first pose snap immediately
// instead of interpolating from world origin
let hasInitialPose =
    false;



// ================================================================
// SMOOTHING SETTINGS
// ================================================================

// MASTER SWITCH:
//
// true  = use custom interpolation
// false = use raw MindAR tracking directly
const ENABLE_SMOOTH_INTERPOLATION =
    false;


// These values are only used when
// ENABLE_SMOOTH_INTERPOLATION = true.
//
// Lower value = smoother / more delay
// Higher value = faster / more responsive
const POSITION_SMOOTH_SPEED =
    48;

const ROTATION_SMOOTH_SPEED =
    32;

const SCALE_SMOOTH_SPEED =
    32;



// ================================================================
// CREATE MINDAR
// ================================================================

const mindarThree =
    new MindARThree({

        container:
            container,

        imageTargetSrc:
            "./targets.mind",

        uiLoading:
            "no",

        uiScanning:
            "no",

        uiError:
            "yes",

        warmupTolerance:
            5,

        missTolerance:
            10

    });



// ================================================================
// GET THREE.JS OBJECTS CREATED BY MINDAR
// ================================================================

const {
    renderer,
    scene,
    camera
} = mindarThree;



// ================================================================
// LIGHTING
// ================================================================

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



// ================================================================
// CREATE MINDAR TARGET ANCHOR
// ================================================================

const anchor =
    mindarThree.addAnchor(
        0
    );



// ================================================================
// CREATE SMOOTHED ROOT
// ================================================================

// The model is attached to this group instead
// of directly to the MindAR anchor.
//
// That allows us to choose between:
// - interpolated tracking
// - raw tracking
const smoothedRoot =
    new THREE.Group();


smoothedRoot.visible =
    false;


scene.add(
    smoothedRoot
);



// ================================================================
// RAW MINDAR TRANSFORM VARIABLES
// ================================================================

const targetPosition =
    new THREE.Vector3();


const targetQuaternion =
    new THREE.Quaternion();


const targetScale =
    new THREE.Vector3();



// ================================================================
// LOAD GLB
// ================================================================

const loader =
    new GLTFLoader();


// Animation mixer
let mixer =
    null;


loader.load(

    "./model.glb",


    (gltf) => {

        const model =
            gltf.scene;



        // --------------------------------------------------------
        // ORIGINAL MODEL SIZE
        // --------------------------------------------------------

        const originalBox =
            new THREE.Box3()
                .setFromObject(
                    model
                );


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



        // --------------------------------------------------------
        // MODEL SCALE
        // --------------------------------------------------------

        const modelScale =
            0.65 /
            largestDimension;


        model.scale.setScalar(
            modelScale
        );



        // --------------------------------------------------------
        // MODEL ROTATION
        // --------------------------------------------------------

        model.rotation.x =
            Math.PI / 2;


        model.updateMatrixWorld(
            true
        );



        // --------------------------------------------------------
        // RECALCULATE MODEL BOUNDS
        // --------------------------------------------------------

        const transformedBox =
            new THREE.Box3()
                .setFromObject(
                    model
                );


        const modelCenter =
            transformedBox.getCenter(
                new THREE.Vector3()
            );



        // --------------------------------------------------------
        // CENTER MODEL ON TARGET
        // --------------------------------------------------------

        model.position.x -=
            modelCenter.x;


        model.position.y -=
            modelCenter.y;


        model.position.z -=
            transformedBox.min.z;



        // --------------------------------------------------------
        // ADD MODEL TO OUR ROOT
        // --------------------------------------------------------

        smoothedRoot.add(
            model
        );



        // --------------------------------------------------------
        // GLB ANIMATIONS
        // --------------------------------------------------------

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
                        .clipAction(
                            clip
                        )
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



// ================================================================
// TARGET FOUND
// ================================================================

anchor.onTargetFound =
    () => {

        console.log(
            "Business card found"
        );


        hasTrackedTarget =
            true;


        targetVisible =
            true;



        // --------------------------------------------------------
        // READ CURRENT RAW MINDAR POSE
        // --------------------------------------------------------

        scene.updateMatrixWorld(
            true
        );


        anchor.group.getWorldPosition(
            targetPosition
        );


        anchor.group.getWorldQuaternion(
            targetQuaternion
        );


        anchor.group.getWorldScale(
            targetScale
        );



        // --------------------------------------------------------
        // FIRST POSE
        // --------------------------------------------------------

        if (
            !hasInitialPose
        ) {

            smoothedRoot.position.copy(
                targetPosition
            );


            smoothedRoot.quaternion.copy(
                targetQuaternion
            );


            smoothedRoot.scale.copy(
                targetScale
            );


            hasInitialPose =
                true;

        }


        smoothedRoot.visible =
            true;



        // --------------------------------------------------------
        // STOP 5 SECOND MESSAGE TIMER
        // --------------------------------------------------------

        if (
            scanMessageTimer !== null
        ) {

            clearTimeout(
                scanMessageTimer
            );


            scanMessageTimer =
                null;

        }



        // Hide scan help message
        scanMessage.classList.remove(
            "visible"
        );


        // Show Learn More
        learnMore.classList.add(
            "visible"
        );

    };



// ================================================================
// TARGET LOST
// ================================================================

anchor.onTargetLost =
    () => {

        console.log(
            "Business card lost"
        );


        targetVisible =
            false;


        // Reset first-pose logic so that when
        // tracking returns, the model immediately
        // jumps to the new current pose
        hasInitialPose =
            false;


        smoothedRoot.visible =
            false;

    };



// ================================================================
// START AR BUTTON
// ================================================================

startButton.addEventListener(

    "click",

    async () => {

        try {

            // ----------------------------------------------------
            // START MINDAR
            // ----------------------------------------------------

            const startPromise =
                mindarThree.start();



            // ----------------------------------------------------
            // HIDE START BUTTON
            // ----------------------------------------------------

            startButton.classList.add(
                "hidden"
            );



            // ----------------------------------------------------
            // SHOW LOGO
            // ----------------------------------------------------

            brandLogo.classList.add(
                "visible"
            );



            // Wait until camera / MindAR is ready
            await startPromise;



            // ----------------------------------------------------
            // FULLY REMOVE START BUTTON AFTER FADE
            // ----------------------------------------------------

            setTimeout(

                () => {

                    startButton.style.display =
                        "none";

                },

                400

            );



            // ----------------------------------------------------
            // 5 SECOND HELP MESSAGE
            // ----------------------------------------------------

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



            // ----------------------------------------------------
            // THREE.JS CLOCK
            // ----------------------------------------------------

            const clock =
                new THREE.Clock();



            // ----------------------------------------------------
            // RENDER LOOP
            // ----------------------------------------------------

            renderer.setAnimationLoop(

                () => {

                    const delta =
                        clock.getDelta();



                    // ------------------------------------------------
                    // UPDATE GLB ANIMATION
                    // ------------------------------------------------

                    if (
                        mixer
                    ) {

                        mixer.update(
                            delta
                        );

                    }



                    // ------------------------------------------------
                    // UPDATE TRACKING
                    // ------------------------------------------------

                    if (
                        targetVisible
                    ) {

                        scene.updateMatrixWorld(
                            true
                        );


                        anchor.group.getWorldPosition(
                            targetPosition
                        );


                        anchor.group.getWorldQuaternion(
                            targetQuaternion
                        );


                        anchor.group.getWorldScale(
                            targetScale
                        );



                        // =============================================
                        // SMOOTHING ENABLED
                        // =============================================

                        if (
                            ENABLE_SMOOTH_INTERPOLATION
                        ) {

                            const positionAlpha =
                                1 -
                                Math.exp(
                                    -POSITION_SMOOTH_SPEED *
                                    delta
                                );


                            const rotationAlpha =
                                1 -
                                Math.exp(
                                    -ROTATION_SMOOTH_SPEED *
                                    delta
                                );


                            const scaleAlpha =
                                1 -
                                Math.exp(
                                    -SCALE_SMOOTH_SPEED *
                                    delta
                                );



                            // Smooth position
                            smoothedRoot.position.lerp(
                                targetPosition,
                                positionAlpha
                            );


                            // Smooth rotation
                            smoothedRoot.quaternion.slerp(
                                targetQuaternion,
                                rotationAlpha
                            );


                            // Smooth scale
                            smoothedRoot.scale.lerp(
                                targetScale,
                                scaleAlpha
                            );

                        }



                        // =============================================
                        // SMOOTHING DISABLED
                        // =============================================

                        else {

                            // Directly copy MindAR's raw transform
                            smoothedRoot.position.copy(
                                targetPosition
                            );


                            smoothedRoot.quaternion.copy(
                                targetQuaternion
                            );


                            smoothedRoot.scale.copy(
                                targetScale
                            );

                        }

                    }



                    // ------------------------------------------------
                    // RENDER FRAME
                    // ------------------------------------------------

                    renderer.render(
                        scene,
                        camera
                    );

                }

            );

        }



        // ========================================================
        // CAMERA / STARTUP ERROR
        // ========================================================

        catch (
            error
        ) {

            console.error(
                "AR startup failed:",
                error
            );


            startButton.style.display =
                "block";


            startButton.classList.remove(
                "hidden"
            );


            brandLogo.classList.remove(
                "visible"
            );


            scanMessage.textContent =
                "Unable to access the camera. Please check your camera permissions.";


            scanMessage.classList.add(
                "visible"
            );

        }

    }

);
