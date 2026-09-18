// ================================================================
// IMPORT THREE.JS
// ================================================================


// Import the complete Three.js library.
//
// THREE gives us:
// - Scene
// - Lights
// - Groups
// - Vector3
// - Quaternion
// - AnimationMixer
// - Box3
// etc.
import * as THREE from "three";



// ================================================================
// IMPORT GLTF LOADER
// ================================================================


// Import GLTFLoader.
//
// This is the Three.js loader responsible for reading:
//
// .gltf
// .glb
//
// files.
import {
    GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";



// ================================================================
// IMPORT MINDAR
// ================================================================


// Import the Three.js version of MindAR.
//
// MindARThree gives us:
//
// - camera access
// - image recognition
// - image pose tracking
// - anchors
// - integration with Three.js
import {
    MindARThree
} from "mindar-image-three";



// ================================================================
// FIND HTML ELEMENTS
// ================================================================


// Find the DIV with:
//
// id="ar-container"
//
// This is where MindAR will create the camera/WebGL view.
const container =
    document.querySelector(
        "#ar-container"
    );



// Find the Start AR button.
const startButton =
    document.querySelector(
        "#startButton"
    );



// Find the Learn More link.
const learnMore =
    document.querySelector(
        "#learnMore"
    );



// Find the logo.
const brandLogo =
    document.querySelector(
        "#brandLogo"
    );



// Find the delayed tracking message.
const scanMessage =
    document.querySelector(
        "#scanMessage"
    );



// ================================================================
// APPLICATION STATE
// ================================================================


// This will store the JavaScript timer responsible
// for showing the scan message after five seconds.
//
// null means that no timer currently exists.
let scanMessageTimer = null;



// This stores whether the target has EVER been detected.
//
// false = not detected yet.
//
// true = business card has been successfully detected.
let hasTrackedTarget = false;



// This represents whether MindAR CURRENTLY sees the target.
//
// false = target currently not visible.
//
// true = target currently visible.
let targetVisible = false;



// This tells the smoothing system whether it has already
// received its first valid pose.
//
// We use this because on the FIRST detection we want the
// model to instantly jump to the correct location.
//
// After that we start interpolation.
let hasInitialPose = false;



// ================================================================
// SMOOTHING SETTINGS
// ================================================================


// Position smoothing speed.
//
// LOWER:
//
//     4
//     5
//     6
//
// means:
// smoother,
// but more visible delay.
//
// HIGHER:
//
//     15
//     20
//
// means:
// faster response,
// but potentially more shaking.
//
// 10 is a good starting point.
const POSITION_SMOOTH_SPEED = 5;



// Rotation smoothing speed.
//
// Rotation usually creates more noticeable visual shaking,
// so I've made this slightly slower than position.
//
// Try:
//
// 5 = very smooth
// 8 = balanced
// 15 = responsive
const ROTATION_SMOOTH_SPEED = 4;



// Scale smoothing speed.
//
// Normally the anchor's scale should be relatively stable.
//
// We still interpolate it to avoid tiny size fluctuations.
const SCALE_SMOOTH_SPEED = 10;



// ================================================================
// CREATE MINDAR
// ================================================================


// Create our MindAR controller.
//
// This is the main object that manages:
//
// - camera
// - tracking
// - Three.js renderer
// - Three.js scene
// - AR camera
const mindarThree =
    new MindARThree({

        // Tell MindAR where its camera/WebGL view should live.
        container: container,


        // Tell MindAR where the compiled image target exists.
        //
        // This is your business card target.
        imageTargetSrc:
            "./targets.mind",


        // Disable MindAR's built-in white loading overlay.
        //
        // We are creating our own interface.
        uiLoading:
            "no",


        // Disable MindAR's built-in scanning UI.
        uiScanning:
            "no",


        // Keep MindAR's built-in error system enabled.
        uiError:
            "yes",


        // Require several successful frames before
        // officially reporting the target as found.
        //
        // This helps prevent false detections.
        warmupTolerance:
            5,


        // Allow several failed frames before MindAR says
        // the target has been lost.
        //
        // Increasing this helps prevent quick flickering.
        missTolerance:
            10

    });



// ================================================================
// GET THREE.JS OBJECTS CREATED BY MINDAR
// ================================================================


// MindAR automatically creates:
//
// renderer = Three.js WebGL renderer
//
// scene = Three.js scene
//
// camera = AR camera
//
// Destructuring lets us pull all three variables from
// mindarThree in one statement.
const {
    renderer,
    scene,
    camera
} = mindarThree;



// ================================================================
// LIGHTING
// ================================================================


// Create ambient light.
//
// Ambient light illuminates every surface equally.
//
// First argument:
//
//     0xffffff
//
// means white.
//
// Second argument:
//
//     1.5
//
// means light intensity.
const ambientLight =
    new THREE.AmbientLight(
        0xffffff,
        1.5
    );



// Add the ambient light to the Three.js scene.
scene.add(
    ambientLight
);



// Create a directional light.
//
// This behaves more like sunlight / studio light.
//
// It gives the model more shape and contrast.
const directionalLight =
    new THREE.DirectionalLight(
        0xffffff,
        2
    );



// Position the directional light.
//
// x = 1
//
// y = 2
//
// z = 3
directionalLight.position.set(
    1,
    2,
    3
);



// Add directional light to the scene.
scene.add(
    directionalLight
);



// ================================================================
// CREATE MINDAR TARGET ANCHOR
// ================================================================


// Ask MindAR for target number 0.
//
// Because our targets.mind currently contains one target:
//
// index 0 = business card.
const anchor =
    mindarThree.addAnchor(
        0
    );



// ================================================================
// CREATE OUR SMOOTHED TRANSFORM
// ================================================================


// Create a normal Three.js Group.
//
// This is extremely important.
//
// The model will NOT be attached directly to MindAR anymore.
//
// Instead:
//
// MindAR creates raw position
//
//            ↓
//
// We read raw position
//
//            ↓
//
// smoothedRoot slowly moves toward it
//
//            ↓
//
// model follows smoothedRoot
const smoothedRoot =
    new THREE.Group();



// Start invisible.
//
// We don't want the model appearing at 0,0,0
// before the card has been found.
smoothedRoot.visible =
    false;



// Add the smoothed group directly to the Three.js scene.
//
// Notice:
//
// NOT:
//
//     anchor.group.add(smoothedRoot)
//
// because then it would still inherit every raw movement
// from MindAR.
//
// It MUST be independent from anchor.group.
scene.add(
    smoothedRoot
);



// ================================================================
// TEMPORARY TRANSFORM VARIABLES
// ================================================================


// This Vector3 will hold the RAW tracked position
// coming from MindAR.
//
// Creating it once avoids generating new objects
// every single frame.
const targetPosition =
    new THREE.Vector3();



// This Quaternion will hold the RAW tracked rotation
// coming from MindAR.
//
// Quaternion is Three.js's preferred system for smooth
// 3D rotation interpolation.
const targetQuaternion =
    new THREE.Quaternion();



// This Vector3 holds the raw tracked scale.
const targetScale =
    new THREE.Vector3();



// ================================================================
// LOAD 3D MODEL
// ================================================================


// Create the GLTF/GLB loader.
const loader =
    new GLTFLoader();



// AnimationMixer will control GLB animations.
//
// null means there isn't an active animation yet.
let mixer =
    null;



// Tell GLTFLoader to load model.glb.
loader.load(

    // ------------------------------------------------------------
    // FILE
    // ------------------------------------------------------------

    "./model.glb",



    // ------------------------------------------------------------
    // SUCCESS CALLBACK
    // ------------------------------------------------------------

    // This function runs once model.glb has loaded successfully.
    (gltf) => {


        // Get the actual Three.js model hierarchy
        // from the loaded GLB file.
        const model =
            gltf.scene;



        // --------------------------------------------------------
        // CALCULATE ORIGINAL SIZE
        // --------------------------------------------------------


        // Create a bounding box around the entire model.
        //
        // Bounding box means:
        //
        // "What is the smallest 3D box capable of containing
        //  this complete model?"
        const originalBox =
            new THREE.Box3()
                .setFromObject(
                    model
                );



        // Create a new Vector3 and calculate the dimensions
        // of the bounding box.
        //
        // size.x = width
        //
        // size.y = height
        //
        // size.z = depth
        const size =
            originalBox.getSize(
                new THREE.Vector3()
            );



        // Find whichever dimension is largest.
        //
        // Example:
        //
        // x = 10
        // y = 4
        // z = 3
        //
        // largestDimension = 10
        const largestDimension =
            Math.max(
                size.x,
                size.y,
                size.z
            );



        // --------------------------------------------------------
        // NORMALIZE MODEL SCALE
        // --------------------------------------------------------


        // MindAR's image target has a width of approximately 1
        // in its coordinate system.
        //
        // We want our model's largest dimension to be about
        // 65% of that.
        const modelScale =
            0.65 /
            largestDimension;



        // Apply the same scale to:
        //
        // X
        // Y
        // Z
        //
        // so the model keeps its correct proportions.
        model.scale.setScalar(
            modelScale
        );



        // --------------------------------------------------------
        // ROTATE MODEL
        // --------------------------------------------------------


        // Rotate the model 90 degrees around X.
        //
        // Three.js uses radians.
        //
        // Math.PI = 180 degrees.
        //
        // Math.PI / 2 = 90 degrees.
        model.rotation.x =
            Math.PI / 2;



        // Force Three.js to immediately calculate the new
        // transformation matrix after scaling and rotation.
        model.updateMatrixWorld(
            true
        );



        // --------------------------------------------------------
        // RECALCULATE BOUNDING BOX
        // --------------------------------------------------------


        // Calculate another bounding box now that scaling
        // and rotation have changed.
        const transformedBox =
            new THREE.Box3()
                .setFromObject(
                    model
                );



        // Find the geometric center of the transformed model.
        const modelCenter =
            transformedBox.getCenter(
                new THREE.Vector3()
            );



        // --------------------------------------------------------
        // CENTER MODEL ON TARGET
        // --------------------------------------------------------


        // Move the model horizontally so its center sits
        // on the image target's X center.
        model.position.x -=
            modelCenter.x;



        // Move vertically so the center sits on the
        // target's Y center.
        model.position.y -=
            modelCenter.y;



        // Move the model so the bottom of its bounding box
        // sits approximately on the target surface.
        model.position.z -=
            transformedBox.min.z;



        // --------------------------------------------------------
        // ADD MODEL TO SMOOTHED ROOT
        // --------------------------------------------------------


        // This is the important difference from our old code.
        //
        // OLD:
        //
        // anchor.group.add(model)
        //
        // NEW:
        //
        // smoothedRoot.add(model)
        //
        // So our smoothing system controls the model.
        smoothedRoot.add(
            model
        );



        // --------------------------------------------------------
        // GLB ANIMATIONS
        // --------------------------------------------------------


        // Check whether this GLB contains animation clips.
        if (
            gltf.animations &&
            gltf.animations.length > 0
        ) {


            // Create an AnimationMixer connected to our model.
            mixer =
                new THREE.AnimationMixer(
                    model
                );



            // Loop through every animation clip stored
            // inside the GLB.
            gltf.animations.forEach(

                // clip represents one animation.
                (clip) => {


                    // Convert the animation clip into an
                    // AnimationAction and begin playing it.
                    mixer
                        .clipAction(
                            clip
                        )
                        .play();


                }

            );


        }


    },



    // ------------------------------------------------------------
    // PROGRESS CALLBACK
    // ------------------------------------------------------------

    // undefined means:
    //
    // we are not currently doing anything while the model
    // downloads.
    undefined,



    // ------------------------------------------------------------
    // ERROR CALLBACK
    // ------------------------------------------------------------

    // This function runs if the GLB cannot be loaded.
    (error) => {


        // Print the error inside the browser console.
        console.error(
            "Failed loading model:",
            error
        );


    }

);



// ================================================================
// TARGET FOUND
// ================================================================


// MindAR automatically calls this function when the business
// card has been successfully recognized.
anchor.onTargetFound =
    () => {


        // Print diagnostic information.
        console.log(
            "Business card found"
        );



        // Remember that we have detected the card at least once.
        hasTrackedTarget =
            true;



        // Tell our interpolation loop that the target
        // is currently visible.
        targetVisible =
            true;



        // --------------------------------------------------------
        // COPY FIRST POSE IMMEDIATELY
        // --------------------------------------------------------


        // Update Three.js world matrices so the latest
        // MindAR pose can be read.
        scene.updateMatrixWorld(
            true
        );



        // Read MindAR's current world position.
        anchor.group.getWorldPosition(
            targetPosition
        );



        // Read MindAR's current world rotation.
        anchor.group.getWorldQuaternion(
            targetQuaternion
        );



        // Read MindAR's current world scale.
        anchor.group.getWorldScale(
            targetScale
        );



        // If this is the first pose after detecting the card...
        if (
            !hasInitialPose
        ) {


            // Immediately move our smoothed object to the
            // correct position.
            //
            // Without this it would slowly fly in from
            // world position 0,0,0.
            smoothedRoot.position.copy(
                targetPosition
            );



            // Immediately copy the target rotation.
            smoothedRoot.quaternion.copy(
                targetQuaternion
            );



            // Immediately copy target scale.
            smoothedRoot.scale.copy(
                targetScale
            );



            // Remember that initialization is complete.
            hasInitialPose =
                true;


        }



        // Show our smoothed model.
        smoothedRoot.visible =
            true;



        // --------------------------------------------------------
        // STOP 5 SECOND HELP MESSAGE TIMER
        // --------------------------------------------------------


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
