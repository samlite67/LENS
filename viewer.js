import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, controls;
let model;

function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 10, 50);

    // Create camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(5, 5, 5);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('container').appendChild(renderer.domElement);

    // Add lights - increased intensity for better visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);

    // Add additional lights for better visualization
    const light1 = new THREE.PointLight(0x667eea, 1);
    light1.position.set(-10, 10, -10);
    scene.add(light1);

    const light2 = new THREE.PointLight(0x764ba2, 1);
    light2.position.set(10, -10, 10);
    scene.add(light2);
    
    const light3 = new THREE.PointLight(0xffffff, 0.8);
    light3.position.set(0, 10, 0);
    scene.add(light3);

    // Add controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI;

    // Add grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x667eea, 0x444444);
    scene.add(gridHelper);

    // Add axes helper
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // Load default FBX model
    loadModel();

    // Handle file upload
    setupFileUpload();

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Start animation loop
    animate();
}

function setupFileUpload() {
    const fileInput = document.getElementById('fileInput');
    
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        console.log('File selected:', file.name, file.type);
        
        // Remove existing model
        if (model) {
            scene.remove(model);
            model = null;
        }

        // Show loading
        const loadingElement = document.getElementById('loading');
        loadingElement.classList.remove('hidden');
        
        const infoText = document.querySelector('#info p');
        infoText.textContent = `Loading ${file.name}...`;

        // Create object URL for the file
        const url = URL.createObjectURL(file);
        const extension = file.name.split('.').pop().toLowerCase();

        // Load based on file type
        if (extension === 'fbx') {
            loadFBXFromFile(url, file.name);
        } else if (extension === 'obj') {
            loadOBJFromFile(url, file.name);
        } else if (extension === 'glb' || extension === 'gltf') {
            loadGLTFFromFile(url, file.name);
        } else {
            alert('Unsupported file format. Please use FBX, OBJ, GLB, or GLTF files.');
            loadingElement.classList.add('hidden');
            infoText.textContent = 'Unsupported file format';
        }
    });
}

function loadFBXFromFile(url, filename) {
    const loader = new FBXLoader();
    const loadingElement = document.getElementById('loading');
    const infoText = document.querySelector('#info p');

    loader.load(
        url,
        (object) => {
            processLoadedModel(object, filename);
            URL.revokeObjectURL(url);
        },
        (xhr) => {
            const percentComplete = (xhr.loaded / xhr.total) * 100;
            console.log(`Loading: ${percentComplete.toFixed(2)}%`);
            infoText.textContent = `Loading: ${percentComplete.toFixed(0)}%`;
        },
        (error) => {
            console.error('Error loading FBX:', error);
            loadingElement.querySelector('p').textContent = 'Error loading file';
            URL.revokeObjectURL(url);
        }
    );
}

function loadOBJFromFile(url, filename) {
    const loader = new OBJLoader();
    const loadingElement = document.getElementById('loading');

    loader.load(
        url,
        (object) => {
            processLoadedModel(object, filename);
            URL.revokeObjectURL(url);
        },
        (xhr) => {
            const percentComplete = (xhr.loaded / xhr.total) * 100;
            console.log(`Loading: ${percentComplete.toFixed(2)}%`);
        },
        (error) => {
            console.error('Error loading OBJ:', error);
            loadingElement.querySelector('p').textContent = 'Error loading file';
            URL.revokeObjectURL(url);
        }
    );
}

function loadGLTFFromFile(url, filename) {
    const loader = new GLTFLoader();
    const loadingElement = document.getElementById('loading');

    loader.load(
        url,
        (gltf) => {
            processLoadedModel(gltf.scene, filename);
            URL.revokeObjectURL(url);
        },
        (xhr) => {
            const percentComplete = (xhr.loaded / xhr.total) * 100;
            console.log(`Loading: ${percentComplete.toFixed(2)}%`);
        },
        (error) => {
            console.error('Error loading GLTF:', error);
            loadingElement.querySelector('p').textContent = 'Error loading file';
            URL.revokeObjectURL(url);
        }
    );
}

function processLoadedModel(object, filename) {
    model = object;
    
    console.log('Raw model loaded:', model);
    
    // Center the model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    console.log('Model bounds:', { center, size });
    
    model.position.x = -center.x;
    model.position.y = -center.y;
    model.position.z = -center.z;
    
    // Scale the model to fit in view
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 10 / maxDim;
    model.scale.set(scale, scale, scale);

    // Enable shadows and improve materials
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            console.log('Mesh found:', child.name, 'Material:', child.material);
            
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        mat.side = THREE.DoubleSide;
                        mat.needsUpdate = true;
                    });
                } else {
                    child.material.side = THREE.DoubleSide;
                    child.material.needsUpdate = true;
                    
                    if (child.material.color) {
                        child.material.color.setHex(0xcccccc);
                    }
                }
            }
        }
    });

    scene.add(model);
    
    // Adjust camera
    camera.position.set(maxDim * 2, maxDim * 2, maxDim * 2);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
    
    // Hide loading screen
    const loadingElement = document.getElementById('loading');
    loadingElement.classList.add('hidden');
    
    const infoText = document.querySelector('#info p');
    infoText.textContent = `Model: ${filename} (${countVertices(model)} vertices)`;
    
    console.log('Model loaded successfully!'
    // Start animation loop
    animate();
}

function loadModel() {
    const loader = new FBXLoader();
    const loadingElement = document.getElementById('loading');
    const infoText = document.querySelector('#info p');

    loader.load(
        'source/Dyan_v06_t05.fbx',
        (object) => {
            model = object;
            
            console.log('Raw model loaded:', model);
            
            // Center the model
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            console.log('Model bounds:', { center, size });
            
            model.position.x = -center.x;
            model.position.y = -center.y;
            model.position.z = -center.z;
            
            // Scale the model to fit in view
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 10 / maxDim; // Increased scale for better visibility
            model.scale.set(scale, scale, scale);

            // Enable shadows and improve materials
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    console.log('Mesh found:', child.name, 'Material:', child.material);
                    
                    // Improve material appearance
                    if (child.material) {
                        // If it's an array of materials
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => {
                                mat.side = THREE.DoubleSide;
                                mat.needsUpdate = true;
                            });
                        } else {
                            child.material.side = THREE.DoubleSide;
                            child.material.needsUpdate = true;
                            
                            // Add basic color if material is too dark
                            if (child.material.color) {
                                child.material.color.setHex(0xcccccc);
                            }
                        }
                    }
                }
            });

            scene.add(model);
            
            // Adjust camera to look at the model
            camera.position.set(maxDim * 2, maxDim * 2, maxDim * 2);
            camera.lookAt(0, 0, 0);
            controls.target.set(0, 0, 0);
            controls.update();
            
            // Hide loading screen
            loadingElement.classList.add('hidden');
            infoText.textContent = `Model: Dyan_v06_t05.fbx (${countVertices(model)} vertices)`;
            
            console.log('Model loaded successfully!');
            console.log('Model size:', size);
            console.log('Model position:', model.position);
            console.log('Model scale:', model.scale);
            console.log('Camera position:', camera.position);
        },
        (xhr) => {
            const percentComplete = (xhr.loaded / xhr.total) * 100;
            console.log(`Loading: ${percentComplete.toFixed(2)}%`);
            const infoText = document.querySelector('#info p');
            infoText.textContent = `Loading: ${percentComplete.toFixed(0)}%`;
        },
        (error) => {
            console.error('Error loading model:', error);
            const loadingElement = document.getElementById('loading');
            loadingElement.querySelector('p').textContent = 'Error loading model. Check console.';
        }
    );
}

function countVertices(object) {
    let count = 0;
    object.traverse((child) => {
        if (child.isMesh && child.geometry) {
            count += child.geometry.attributes.position.count;
        }
    });
    return count.toLocaleString();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Start the application
init();
