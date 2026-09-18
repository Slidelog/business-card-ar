// HTML ELEMENTS
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

import {
    GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";

// THREE.JS LIB
import * as THREE from "three";
// MINDARTHREE LIB
import {
    MindARThree
} from "mindar-image-three";


// 5s warning ini
let scanMessageTimer = null;

// Do I see the 
let hasTrackedTarget = false;

// Does MindARThree sees the target?
let targetVisible = false;

// Interpolation fix
let hasInitialPose = false;

// SMOOTHING SETTINGS

// THE LOWER THE SMOOTHER BUT ALSO THE LONGER DELAY
const POSITION_SMOOTH_SPEED = 6;
const ROTATION_SMOOTH_SPEED = 4;
const SCALE_SMOOTH_SPEED = 10;

// CREATE MINDAR
const mindarThree =
    new MindARThree({
        container: container,
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

// GET THREE.JS OBJECTS CREATED BY MINDAR
const {
    renderer,
    scene,
    camera
} = mindarThree;


// LIGHTING
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


// CREATE MINDAR TARGET ANCHOR
const anchor =
    mindarThree.addAnchor(
        0
    );


// CREATE OUR SMOOTHED TRANSFORM
const smoothedRoot =
    new THREE.Group();

smoothedRoot.visible =
    false;

scene.add(
    smoothedRoot
);


// This V3 will hold the RAW tracked position from MindAR
//
// Creating it once avoids generating new objects every single frame
const targetPosition =
    new THREE.Vector3();

// Raw Rotation
const targetQuaternion =
    new THREE.Quaternion();

// Raw scale
const targetScale =
    new THREE.Vector3();



// LOAD 3D GLB MODEL
// Create the GLTF/GLB loader.
const loader =
    new GLTFLoader();


//!!3D ANIMATION SET NUL FOR NOW!!
let mixer =
    null;

loader.load(
    "./model.glb",
    
    (gltf) => {
        const model =
            gltf.scene;
        
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

        const modelScale =
            0.65 /
            largestDimension;
        
        model.scale.setScalar(
            modelScale
        );
        
        model.rotation.x =
            Math.PI / 2;
        
        model.updateMatrixWorld(
            true
        );

        const transformedBox =
            new THREE.Box3()
                .setFromObject(
                    model
                );
        
        const modelCenter =
            transformedBox.getCenter(
                new THREE.Vector3()
            );

        
        // CENTER MODEL ON TARGET
        model.position.x -=
            modelCenter.x;
        
        model.position.y -=
            modelCenter.y;
        
        model.position.z -=
            transformedBox.min.z;

        // ADD MODEL TO INTERPOLATE
       
        smoothedRoot.add(
            model
        );

        
        // GLB ANIMATIONS
        // Check whether this GLB contains animation clips
        if (
            gltf.animations &&
            gltf.animations.length > 0
        ) {

            // Create an AnimationMixer connected to our model
            mixer =
                new THREE.AnimationMixer(
                    model
                );

            // Loop through every animation clip stored inside the GLB
            gltf.animations.forEach(
                
                (clip) => {
                    // Convert and play                    
                    mixer
                        .clipAction(
                            clip
                        )
                        .play();


                }

            );


        }


    },

    // PROGRESS CALLBACK - DO NOTHING WHILE LOADING
    undefined,
    
    // ERROR CALLBACK
    (error) => {
        
        // Print the error
        console.error(
            "Failed loading model:",
            error
        );


    }

);


// TARGET FOUND
anchor.onTargetFound =
    () => {

        // Print diagnostic
        console.log(
            "Business card found"
        );

        // We tracked at least once
        hasTrackedTarget =
            true;
        
        targetVisible =
            true;

        // COPY FIRST POSE IMMEDIATELY
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


        // If this is the first pose after detecting the card...
        if (
            !hasInitialPose
        ) {

            // Immediately move our smoothed object
            smoothedRoot.position.copy(
                targetPosition
            );

            // Immediately copy the target rotation
            smoothedRoot.quaternion.copy(
                targetQuaternion
            );

            // Immediately copy target scale
            smoothedRoot.scale.copy(
                targetScale
            );

            // Remember that initialization is complete
            hasInitialPose =
                true;


        }

        smoothedRoot.visible =
            true;


        // STOP 5 SECOND HELP MESSAGE TIMER
        // Check whether a timer currently exists.
        if (
            scanMessageTimer !== null
        ) {

            // Cancel the timer.
            clearTimeout(
                scanMessageTimer
            );


            // Return the variable to empty state.
            scanMessageTimer =
                null;


        }



        // Remove the "visible" CSS class from the help message.
        //
        // This makes it fade away.
        scanMessage.classList.remove(
            "visible"
        );



        // Show the Learn More button.
        learnMore.classList.add(
            "visible"
        );


    };



// ================================================================
// TARGET LOST
// ================================================================


// MindAR calls this when it decides the image target
// is no longer visible.
anchor.onTargetLost =
    () => {


        // Diagnostic console message.
        console.log(
            "Business card lost"
        );



        // Stop updating our smoothed object toward MindAR's pose.
        targetVisible =
            false;



        // Hide the 3D model.
        //
        // missTolerance above already provides some resistance
        // against very short tracking losses.
        smoothedRoot.visible =
            false;


    };



// ================================================================
// START AR BUTTON
// ================================================================


// Listen for a user's click/tap on Start AR.
startButton.addEventListener(

    // Browser event we want to listen for.
    "click",


    // Function that runs when the button is pressed.
    async () => {


        // Use try/catch because camera startup can fail.
        try {


            // ----------------------------------------------------
            // START CAMERA / MINDAR
            // ----------------------------------------------------


            // Start MindAR immediately from the user's click.
            //
            // We DON'T await yet.
            //
            // Keeping this directly inside the click action helps
            // browsers associate camera startup with user input.
            const startPromise =
                mindarThree.start();



            // ----------------------------------------------------
            // UI CHANGES
            // ----------------------------------------------------


            // Begin fading Start AR away.
            startButton.classList.add(
                "hidden"
            );



            // Fade the centered top logo in.
            brandLogo.classList.add(
                "visible"
            );



            // ----------------------------------------------------
            // WAIT FOR CAMERA
            // ----------------------------------------------------


            // Pause this function until MindAR reports
            // that startup has completed.
            await startPromise;



            // ----------------------------------------------------
            // COMPLETELY REMOVE START BUTTON
            // ----------------------------------------------------


            // Wait 400 milliseconds so the CSS fade finishes.
            setTimeout(

                // Function to execute later.
                () => {


                    // Remove Start button from page layout.
                    startButton.style.display =
                        "none";


                },


                // Delay in milliseconds.
                400

            );



            // ----------------------------------------------------
            // FIVE SECOND HELP TIMER
            // ----------------------------------------------------


            // Start a timer.
            scanMessageTimer =
                setTimeout(

                    // Function that runs after five seconds.
                    () => {


                        // Only show the message if we still
                        // haven't detected the business card.
                        if (
                            !hasTrackedTarget
                        ) {


                            // Fade tracking instructions in.
                            scanMessage
                                .classList
                                .add(
                                    "visible"
                                );


                        }


                    },


                    // 5000 milliseconds = 5 seconds.
                    5000

                );



            // ====================================================
            // THREE.JS RENDER LOOP
            // ====================================================


            // Create a clock.
            //
            // It measures the amount of time between frames.
            const clock =
                new THREE.Clock();



            // Tell Three.js to continuously render frames.
            renderer.setAnimationLoop(

                // This function executes approximately once
                // per display frame.
                () => {


                    // --------------------------------------------
                    // FRAME TIME
                    // --------------------------------------------


                    // Find how many seconds passed since
                    // the previous frame.
                    const delta =
                        clock.getDelta();



                    // --------------------------------------------
                    // UPDATE MODEL ANIMATION
                    // --------------------------------------------


                    // Check whether the GLB has an AnimationMixer.
                    if (
                        mixer
                    ) {


                        // Advance animations by the elapsed time.
                        mixer.update(
                            delta
                        );


                    }



                    // =================================================
                    // CUSTOM TRACKING INTERPOLATION
                    // =================================================


                    // Only perform smoothing while MindAR
                    // currently sees the target.
                    if (
                        targetVisible
                    ) {


                        // Make sure Three.js's current matrices
                        // are up-to-date.
                        scene.updateMatrixWorld(
                            true
                        );



                        // Read the newest raw MindAR position.
                        anchor.group.getWorldPosition(
                            targetPosition
                        );



                        // Read newest raw MindAR rotation.
                        anchor.group.getWorldQuaternion(
                            targetQuaternion
                        );



                        // Read newest raw MindAR scale.
                        anchor.group.getWorldScale(
                            targetScale
                        );



                        // -----------------------------------------
                        // FRAME-RATE-INDEPENDENT POSITION ALPHA
                        // -----------------------------------------


                        // Calculate interpolation strength.
                        //
                        // This formula makes smoothing behave
                        // approximately the same at:
                        //
                        // 30 FPS
                        // 60 FPS
                        // 120 FPS
                        //
                        // rather than using a fixed value per frame.
                        const positionAlpha =
                            1 -
                            Math.exp(
                                -POSITION_SMOOTH_SPEED *
                                delta
                            );



                        // -----------------------------------------
                        // ROTATION ALPHA
                        // -----------------------------------------


                        // Calculate interpolation amount specifically
                        // for rotation.
                        const rotationAlpha =
                            1 -
                            Math.exp(
                                -ROTATION_SMOOTH_SPEED *
                                delta
                            );



                        // -----------------------------------------
                        // SCALE ALPHA
                        // -----------------------------------------


                        // Calculate interpolation amount
                        // for scale changes.
                        const scaleAlpha =
                            1 -
                            Math.exp(
                                -SCALE_SMOOTH_SPEED *
                                delta
                            );



                        // -----------------------------------------
                        // INTERPOLATE POSITION
                        // -----------------------------------------


                        // Move smoothedRoot.position part of the
                        // way toward targetPosition.
                        //
                        // lerp means:
                        //
                        // Linear Interpolation.
                        smoothedRoot.position.lerp(
                            targetPosition,
                            positionAlpha
                        );



                        // -----------------------------------------
                        // INTERPOLATE ROTATION
                        // -----------------------------------------


                        // Smoothly rotate toward the raw MindAR
                        // orientation.
                        //
                        // slerp means:
                        //
                        // Spherical Linear Interpolation.
                        //
                        // This is appropriate for Quaternions.
                        smoothedRoot.quaternion.slerp(
                            targetQuaternion,
                            rotationAlpha
                        );



                        // -----------------------------------------
                        // INTERPOLATE SCALE
                        // -----------------------------------------


                        // Smoothly move scale toward the latest
                        // target scale.
                        smoothedRoot.scale.lerp(
                            targetScale,
                            scaleAlpha
                        );


                    }



                    // =================================================
                    // RENDER FRAME
                    // =================================================


                    // Render the current Three.js scene
                    // from the AR camera's perspective.
                    renderer.render(
                        scene,
                        camera
                    );


                }

            );


        }



        // ========================================================
        // CAMERA START FAILURE
        // ========================================================

        catch (
            error
        ) {


            // Print the real JavaScript error to console.
            console.error(
                "AR startup failed:",
                error
            );



            // Make Start AR available again.
            startButton.style.display =
                "block";



            // Remove the fade-out state.
            startButton.classList.remove(
                "hidden"
            );



            // Hide the logo again.
            brandLogo.classList.remove(
                "visible"
            );



            // Change the message text to explain the problem.
            scanMessage.textContent =
                "Unable to access the camera. Please check your camera permissions.";



            // Show the error message.
            scanMessage.classList.add(
                "visible"
            );


        }


    }

);
