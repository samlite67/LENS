import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, controls;
let model, gridHelper, skeletonHelper;
let raycaster, mouse;
let selectedObject = null;
let originalMaterials = new Map();
let bones = [];

function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510); // Darker background
    scene.fog = new THREE.Fog(0x050510, 20, 100);

    // Add raycaster and mouse
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

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

    // Improve reflections with a procedural environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    // Create a temporary scene for environment generation
    const envScene = new THREE.Scene();
    const envLight = new THREE.PointLight(0xffffff, 50, 100);
    envLight.position.set(5, 5, 5);
    envScene.add(envLight);
    const envLight2 = new THREE.PointLight(0x667eea, 50, 100);
    envLight2.position.set(-5, -5, -5);
    envScene.add(envLight2);
    
    scene.environment = pmremGenerator.fromScene(envScene).texture;

    // Add lights - Professional Studio Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x050510, 1.0);
    scene.add(hemiLight);

    // Key Light
    const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
    mainLight.position.set(15, 25, 15);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 4096; // Sharper shadows
    mainLight.shadow.mapSize.height = 4096;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 100;
    mainLight.shadow.bias = -0.0001;
    scene.add(mainLight);

    // Rim Light (Blue)
    const rimLight = new THREE.SpotLight(0x667eea, 40);
    rimLight.position.set(-20, 20, -20);
    rimLight.angle = Math.PI / 4;
    rimLight.penumbra = 0.5;
    scene.add(rimLight);

    // Fill Light (Purple)
    const fillLight = new THREE.DirectionalLight(0x764ba2, 0.8);
    fillLight.position.set(-15, 5, 10);
    scene.add(fillLight);

    // Subtle blue "tech" glow from below
    const bottomLight = new THREE.PointLight(0x667eea, 30, 60);
    bottomLight.position.set(0, -10, 0);
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

    // Handle identification
    renderer.domElement.addEventListener('dblclick', onMouseDoubleClick);

    // Start animation loop
    animate();
}

function onMouseDoubleClick(event) {
    // Calculate normalized mouse coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Perform raycasting
    raycaster.setFromCamera(mouse, camera);
    if (!model) return;

    const intersects = raycaster.intersectObject(model, true);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        identifyPart(object);
    } else {
        clearIdentification();
    }
}

function identifyPart(object) {
    // Clear previous selection
    clearIdentification();
    
    selectedObject = object;
    
    // Store original materials if not already stored
    if (!originalMaterials.has(object)) {
        originalMaterials.set(object, object.material);
    }
    
    // Highlight the object
    const highlightMaterial = new THREE.MeshStandardMaterial({
        color: 0x667eea,
        emissive: 0x667eea,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8,
        wireframe: false,
        side: THREE.DoubleSide
    });
    
    object.material = highlightMaterial;
    
    // Update UI
    const partInfo = document.getElementById('part-info');
    const partName = document.getElementById('part-name');
    const partDetails = document.getElementById('part-details');
    
    partInfo.style.display = 'block';
    partName.textContent = object.name || 'Unnamed Mesh';
    
    const vertexCount = object.geometry.attributes.position.count;
    partDetails.textContent = `Type: ${object.type} | Vertices: ${vertexCount.toLocaleString()}`;
    
    console.log('Identified Part:', object.name, object);
}

function clearIdentification() {
    if (selectedObject && originalMaterials.has(selectedObject)) {
        selectedObject.material = originalMaterials.get(selectedObject);
    }
    
    selectedObject = null;
    document.getElementById('part-info').style.display = 'none';
}

function setupFileUpload() {
    const fileInput = document.getElementById('fileInput');
    
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        console.log('File selected:', file.name, file.type);
        
        // Clear previous identification
        clearIdentification();

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
                                   (m.name && (m.name.toLowerCase().includes('glass') || m.name.toLowerCase().includes('glow') || m.name.toLowerCase().includes('light')));

                    const newMat = new THREE.MeshStandardMaterial({
                        name: m.name,
                        color: m.color ? m.color.clone() : 0xcccccc,
                        map: m.map,
                        normalMap: m.normalMap,
                        roughnessMap: m.roughnessMap || null,
                        metalnessMap: m.metalnessMap || null,
                        aoMap: m.aoMap || null,
                        roughness: isGlow ? 0.05 : (m.roughness !== undefined ? m.roughness : 0.4),
                        metalness: isGlow ? 1.0 : (m.metalness !== undefined ? m.metalness : 0.6),
                        emissive: m.emissive ? m.emissive.clone() : 0x000000,
                        emissiveIntensity: isGlow ? 2.5 : (m.emissiveIntensity || 1.0),
                        transparent: m.transparent || m.opacity < 1,
                        opacity: m.opacity,
                        side: THREE.DoubleSide,
                        envMapIntensity: 1.5 // Boost reflections
                    });

                    // If it's a dark color and not a glow, bump it so it's not "black hole" dark
                    if (!isGlow && newMat.color.r < 0.03 && newMat.color.g < 0.03 && newMat.color.b < 0.03) {
                        newMat.color.setHex(0x2a2a2a);
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

    // 7. Skeleton Analysis
    setupSkeleton(model);

    // 6. UI Update
    document.getElementById('loading').classList.add('hidden');
    document.querySelector('#info p').textContent = `Model: ${filename} (${countVertices(model)} vertices)`;
    
    console.log('Processing Complete.');
}

function setupSkeleton(object) {
    if (skeletonHelper) {
        scene.remove(skeletonHelper);
    }

    bones = [];
    object.traverse((child) => {
        if (child.isBone) {
            bones.push(child);
        }
    });

    if (bones.length > 0) {
        skeletonHelper = new THREE.SkeletonHelper(object);
        skeletonHelper.visible = false; // Hidden by default
        scene.add(skeletonHelper);
        console.log(`Skeleton found with ${bones.length} bones.`);
        
        // Analyze movement potential
        analyzeBoneMovements(bones);
        updateSkeletonUI(true);
    } else {
        console.log('No skeleton found in model. Analyzing hierarchy for mechanical joints...');
        analyzeMechanicalHierarchy(object);
        updateSkeletonUI(false);
    }
}

function analyzeBoneMovements(bones) {
    console.log('--- Bone Movement Analysis ---');
    const structure = {};
    bones.forEach(bone => {
        const name = bone.name.toLowerCase();
        let group = 'other';
        if (name.includes('leg') || name.includes('thigh') || name.includes('calf') || name.includes('foot')) group = 'legs';
        else if (name.includes('arm') || name.includes('shoulder') || name.includes('hand') || name.includes('elbow')) group = 'arms';
        else if (name.includes('spine') || name.includes('hips') || name.includes('root') || name.includes('pelvis')) group = 'core';
        else if (name.includes('head') || name.includes('neck')) group = 'head';

        if (!structure[group]) structure[group] = [];
        structure[group].push(bone.name);
    });

    for (const [group, names] of Object.entries(structure)) {
        console.log(`${group.toUpperCase()}: Found ${names.length} control points. Recommended for ${group === 'legs' ? 'Locomotion' : group === 'arms' ? 'Manipulation' : 'Stabilization'} animation.`);
    }
}

function analyzeMechanicalHierarchy(object) {
    // For models without weights but structured for animation
    let jointCount = 0;
    const mechanicalJoints = [];
    
    object.traverse((child) => {
        // If an object has children and is not the root, it's likely a pivot point
        if (child.children.length > 0 && child !== object) {
            jointCount++;
            mechanicalJoints.push(child.name);
        }
    });
    
    console.log(`Found ${jointCount} potential mechanical joints.`);
    if (jointCount > 0) {
        console.log('Recommended Animation Strategy: Hierarchical Rotation (Forward Kinematics)');
    }
}

function updateSkeletonUI(hasSkeleton) {
    const skeletonSection = document.getElementById('skeleton-section');
    if (skeletonSection) {
        skeletonSection.style.display = 'block';
        const status = document.getElementById('skeleton-status');
        if (status) {
            status.textContent = hasSkeleton ? `Rig Detected: ${bones.length} Bones` : 'No Rig detected (Mechanical Hierarchy Only)';
        }
    }
}

function toggleSkeleton() {
    if (skeletonHelper) {
        skeletonHelper.visible = !skeletonHelper.visible;
    }
}
window.toggleSkeleton = toggleSkeleton;

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
