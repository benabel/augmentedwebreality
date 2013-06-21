window.onload = function() {

  // Normalize the various vendor prefixed versions of getUserMedia.
  navigator.getUserMedia = (navigator.getUserMedia ||
                            navigator.webkitGetUserMedia ||
                            navigator.mozGetUserMedia || 
                            navigator.msGetUserMedia);

// Check that the browser supports getUserMedia.
// If it doesn't show an alert, otherwise continue.
if (navigator.getUserMedia) {
  // Request the camera.
  navigator.getUserMedia(
    // Constraints
    {
      video: true
    },

    // Success Callback
    function(localMediaStream) {
    	// Get a reference to the video element on the page.
var vid = document.getElementById('camera-stream');

// Create an object URL for the video stream and use this 
// to set the video source.
vid.src = window.URL.createObjectURL(localMediaStream);

    },

    // Error Callback
    function(err) {
      // Log the error to the console.
      console.log('The following error occurred when trying to use getUserMedia: ' + err);
    }
  );

} else {
  alert('Sorry, your browser does not support getUserMedia');
}
}

////////////////Utilisation de JSARToolkit

//Setting up JSARToolKit

// Create a RGB raster object for the 2D canvas.
// JSARToolKit uses raster objects to read image data.
// Note that you need to set canvas.changed = true on every frame.
var raster = new NyARRgbRaster_Canvas2D(canvas);

// FLARParam is the thing used by FLARToolKit to set camera parameters.
// Here we create a FLARParam for images with 320x240 pixel dimensions.
var param = new FLARParam(320, 240);

// The FLARMultiIdMarkerDetector is the actual detection engine for marker detection.
// It detects multiple ID markers. ID markers are special markers that encode a number.
var detector = new FLARMultiIdMarkerDetector(param, 120);

// For tracking video set continue mode to true. In continue mode, the detector
// tracks markers across multiple frames.
detector.setContinueMode(true);

// Copy the camera perspective matrix from the FLARParam to the WebGL library camera matrix.
// The second and third parameters determine the zNear and zFar planes for the perspective matrix.
param.copyCameraMatrix(display.camera.perspectiveMatrix, 10, 10000);


//Detecting markers

// Draw the video frame to the raster canvas, scaled to 320x240.
canvas.getContext('2d').drawImage(video, 0, 0, 320, 240);

// Tell the raster object that the underlying canvas has changed.
canvas.changed = true;

// Do marker detection by using the detector object on the raster object.
// The threshold parameter determines the threshold value
// for turning the video frame into a 1-bit black-and-white image.
//
var markerCount = detector.detectMarkerLite(raster, threshold);

// Create a NyARTransMatResult object for getting the marker translation matrices.
var resultMat = new NyARTransMatResult();

var markers = {};

// Go through the detected markers and get their IDs and transformation matrices.
for (var idx = 0; idx < markerCount; idx++) {
  // Get the ID marker data for the current marker.
  // ID markers are special kind of markers that encode a number.
  // The bytes for the number are in the ID marker data.
  var id = detector.getIdMarkerData(idx);

  // Read bytes from the id packet.
  var currId = -1;
  // This code handles only 32-bit numbers or shorter.
  if (id.packetLength <= 4) {
    currId = 0;
    for (var i = 0; i < id.packetLength; i++) {
      currId = (currId << 8) | id.getPacketData(i);
    }
  }

  // If this is a new id, let's start tracking it.
  if (markers[currId] == null) {
    markers[currId] = {};
  }
  // Get the transformation matrix for the detected marker.
  detector.getTransformMatrix(idx, resultMat);

  // Copy the result matrix into our marker tracker object.
  markers[currId].transform = Object.asCopy(resultMat);
}


//Matrix mapping

function copyMarkerMatrix(arMat, glMat) {
  glMat[0] = arMat.m00;
  glMat[1] = -arMat.m10;
  glMat[2] = arMat.m20;
  glMat[3] = 0;
  glMat[4] = arMat.m01;
  glMat[5] = -arMat.m11;
  glMat[6] = arMat.m21;
  glMat[7] = 0;
  glMat[8] = -arMat.m02;
  glMat[9] = arMat.m12;
  glMat[10] = -arMat.m22;
  glMat[11] = 0;
  glMat[12] = arMat.m03;
  glMat[13] = -arMat.m13;
  glMat[14] = arMat.m23;
  glMat[15] = 1;
}

//Three.js integration

// I'm going to use a glMatrix-style matrix as an intermediary.
// So the first step is to create a function to convert a glMatrix matrix into a Three.js Matrix4.
THREE.Matrix4.prototype.setFromArray = function(m) {
  return this.set(
    m[0], m[4], m[8], m[12],
    m[1], m[5], m[9], m[13],
    m[2], m[6], m[10], m[14],
    m[3], m[7], m[11], m[15]
  );
};

// glMatrix matrices are flat arrays.
var tmp = new Float32Array(16);

// Create a camera and a marker root object for your Three.js scene.
var camera = new THREE.Camera();
scene.add(camera);

var markerRoot = new THREE.Object3D();
markerRoot.matrixAutoUpdate = false;

// Add the marker models and suchlike into your marker root object.
var cube = new THREE.Mesh(
  new THREE.CubeGeometry(100,100,100),
  new THREE.MeshBasicMaterial({color: 0xff00ff})
);
cube.position.z = -50;
markerRoot.add(cube);

// Add the marker root to your scene.
scene.add(markerRoot);

// Next we need to make the Three.js camera use the FLARParam matrix.
param.copyCameraMatrix(tmp, 10, 10000);
camera.projectionMatrix.setFromArray(tmp);


// To display the video, first create a texture from it.
var videoTex = new THREE.Texture(videoCanvas);

// Then create a plane textured with the video.
var plane = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2, 0),
  new THREE.MeshBasicMaterial({map: videoTex})
);

// The video plane shouldn't care about the z-buffer.
plane.material.depthTest = false;
plane.material.depthWrite = false;

// Create a camera and a scene for the video plane and
// add the camera and the video plane to the scene.
var videoCam = new THREE.Camera();
var videoScene = new THREE.Scene();
videoScene.add(plane);
videoScene.add(videoCam);

    markerRoot.matrix.setFromArray(tmp);
  

  // Render the scene.
  renderer.autoClear = false;
  renderer.clear();
  renderer.render(videoScene, videoCam);
  renderer.render(scene, camera);

