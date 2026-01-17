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

    // Apply simple environment for reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    scene.environment = pmremGenerator.fromScene(new THREE.Scene()).texture;

    // Add lights - Balanced PBR Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x050510, 0.8);
    scene.add(hemiLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x764ba2, 0.5);
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);

    // Subtle blue "tech" glow from below
    const bottomLight = new THREE.PointLight(0x667eea, 20, 50);
    bottomLight.position.set(0, -5, 0);
    scene.add(bottomLight);

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
    scene.add(model);
    
    console.log('Processing model:', filename);
    
    // 1. Reset and Force Bounds Calc
    model.position.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.rotation.set(0, 0, 0);
    model.updateMatrixWorld(true);
    
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // 2. Center and Hero Scale (Target 15 units height)
    const targetDim = 15;
    const scale = targetDim / (maxDim || 1);
    model.scale.set(scale, scale, scale);
    model.position.x = -center.x * scale;
    model.position.y = -center.y * scale + (size.y * scale) / 2; // Feet on floor
    model.position.z = -center.z * scale;
    
    // 3. Grid Update
    if (gridHelper) scene.remove(gridHelper);
    gridHelper = new THREE.GridHelper(targetDim * 2, 20, 0x667eea, 0x222222);
    scene.add(gridHelper);

    // 4. Material Extraction & Upgrade
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
            
            if (child.material) {
                const upgrade = (m) => {
                    // Detect if this is a "glow" material
                    const isGlow = (m.emissive && (m.emissive.r > 0 || m.emissive.g > 0 || m.emissive.b > 0)) || 
                                   (m.name && m.name.toLowerCase().includes('glass'));

                    const newMat = new THREE.MeshStandardMaterial({
                        name: m.name,
                        color: m.color ? m.color.clone() : 0xcccccc,
                        map: m.map,
                        normalMap: m.normalMap,
                        roughness: isGlow ? 0.1 : 0.6,
                        metalness: isGlow ? 0.9 : 0.4,
                        emissive: m.emissive ? m.emissive.clone() : 0x000000,
                        emissiveIntensity: m.emissiveIntensity || 1.0,
                        transparent: m.transparent || m.opacity < 1,
                        opacity: m.opacity,
                        side: THREE.DoubleSide
                    });

                    // If it's a dark color and not a glow, bump it so it's not "black hole" dark
                    if (!isGlow && newMat.color.r < 0.05 && newMat.color.g < 0.05 && newMat.color.b < 0.05) {
                        newMat.color.setHex(0x333333);
                    }

                    return newMat;
                };

                if (Array.isArray(child.material)) {
                    child.material = child.material.map(upgrade);
                } else {
                    child.material = upgrade(child.material);
                }
            }

            if (child.geometry) {
                child.geometry.computeVertexNormals();
            }
        }
    });

    // 5. Camera & Control Focus
    camera.position.set(targetDim, targetDim * 0.7, targetDim);
    controls.target.set(0, targetDim / 2, 0);
    controls.update();

    // 6. UI Update
    document.getElementById('loading').classList.add('hidden');
    document.querySelector('#info p').textContent = `Model: ${filename} (${countVertices(model)} vertices)`;
    
    console.log('Processing Complete.');
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
