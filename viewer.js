import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, controls;
let model, gridHelper;

function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510); // Darker background
    scene.fog = new THREE.Fog(0x050510, 20, 100);

    // Create camera
    camera = new THREE.PerspectiveCamera(
        45, // Narrower FOV for less distortion
        window.innerWidth / window.innerHeight,
        0.1,
        2000
    );
    camera.position.set(15, 15, 15);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('container').appendChild(renderer.domElement);

    // Add lights - Professional Studio Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Brighter ambient
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x050510, 0.6);
    scene.add(hemiLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 3);
    mainLight.position.set(20, 40, 20);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.left = -50;
    mainLight.shadow.camera.right = 50;
    mainLight.shadow.camera.top = 50;
    mainLight.shadow.camera.bottom = -50;
    scene.add(mainLight);

    // High intensity Point lights for r160+ physically correct units
    const blueLight = new THREE.PointLight(0x667eea, 1000);
    blueLight.position.set(-20, 10, -20);
    scene.add(blueLight);

    const purpleLight = new THREE.PointLight(0x764ba2, 1000);
    purpleLight.position.set(20, 10, 20);
    scene.add(purpleLight);

    const topLight = new THREE.SpotLight(0xffffff, 2000);
    topLight.position.set(0, 30, 0);
    topLight.angle = Math.PI / 4;
    topLight.penumbra = 0.3;
    scene.add(topLight);

    // Add controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 2;
    controls.maxDistance = 100;

    // Initial grid (will be resized)
    gridHelper = new THREE.GridHelper(20, 20, 0x667eea, 0x222222);
    scene.add(gridHelper);

    // Add axes helper
    const axesHelper = new THREE.AxesHelper(5);
    axesHelper.visible = false; // Keep it clean
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
    if (model) {
        scene.remove(model);
    }
    
    model = object;
    scene.add(model); // Add to scene first for matrix updates
    
    console.log('Model loaded:', filename);
    
    // Reset model transformations to get raw bounds
    model.position.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.rotation.set(0, 0, 0);
    model.updateMatrixWorld(true);
    
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    console.log('Original Bounds:', size, 'Center:', center);
    
    // Auto-scale to a comfortable size (target max dimension of 20 units)
    const targetDim = 20;
    const scale = targetDim / (maxDim || 1);
    model.scale.set(scale, scale, scale);

    // Apply centered position compensating for the new scale
    // WorldCenter = ModelPos + (Scale * OriginalCenter)
    // We want WorldCenter to be 0
    // ModelPos = -(Scale * OriginalCenter)
    model.position.x = -center.x * scale;
    model.position.y = -center.y * scale;
    model.position.z = -center.z * scale;
    
    // Position the whole model so its bottom is on the grid (y=0)
    // After centering, the bottom is at (-size.y/2 * scale)
    // We move it up by (size.y * scale) / 2
    model.position.y += (size.y * scale) / 2;

    // Update Grid size based on model size
    if (gridHelper) {
        scene.remove(gridHelper);
    }
    const gridDim = Math.ceil(targetDim * 2);
    gridHelper = new THREE.GridHelper(gridDim, 20, 0x667eea, 0x222222);
    scene.add(gridHelper);

    // Material & Shadow Upgrade
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false; // Prevents parts from disappearing at certain angles
            
            if (child.material) {
                const upgradeMaterial = (mat) => {
                    // Force a visible color if the current one is too dark
                    let color = mat.color ? mat.color.clone() : new THREE.Color(0xcccccc);
                    if (color.r < 0.1 && color.g < 0.1 && color.b < 0.1) {
                        color = new THREE.Color(0x888888);
                    }

                    return new THREE.MeshStandardMaterial({
                        color: color,
                        map: mat.map,
                        normalMap: mat.normalMap,
                        roughness: 0.4,
                        metalness: 0.6,
                        side: THREE.DoubleSide,
                        transparent: mat.transparent || (mat.opacity < 1),
                        opacity: mat.opacity
                    });
                };

                if (Array.isArray(child.material)) {
                    child.material = child.material.map(upgradeMaterial);
                } else {
                    child.material = upgradeMaterial(child.material);
                }
            }

            // Ensure smooth shading
            if (child.geometry) {
                child.geometry.computeVertexNormals();
            }
        }
    });

    // Adjust camera & controls
    const camDist = targetDim * 1.5;
    camera.position.set(camDist, camDist, camDist);
    camera.lookAt(0, targetDim / 2, 0); // Look at center of model
    controls.target.set(0, targetDim / 2, 0);
    controls.update();
    
    // UI Updates
    const loadingElement = document.getElementById('loading');
    loadingElement.classList.add('hidden');
    
    const infoText = document.querySelector('#info p');
    infoText.textContent = `Model: ${filename} (${countVertices(model)} vertices)`;
    
    console.log('Processing complete. Scale:', scale);
    
    // Debug: Add a bounding box helper to see where it is
    // const helper = new THREE.BoxHelper(model, 0xffff00);
    // scene.add(helper);
}

function loadModel() {
    const loader = new FBXLoader();
    const loadingElement = document.getElementById('loading');
    const infoText = document.querySelector('#info p');

    loader.load(
        'source/Dyan_v06_t05.fbx',
        (object) => {
            processLoadedModel(object, 'Dyan_v06_t05.fbx');
        },
        (xhr) => {
            const percentComplete = (xhr.loaded / (xhr.total || 1)) * 100;
            infoText.textContent = `Loading: ${percentComplete.toFixed(0)}%`;
        },
        (error) => {
            console.error('Error loading model:', error);
            loadingElement.querySelector('p').textContent = 'Error loading default model.';
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
