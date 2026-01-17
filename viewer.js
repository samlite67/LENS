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
let currentViewMode = 'material';
let solidMaterial = new THREE.MeshStandardMaterial({
    color: 0xe0e0e0, // Slightly lighter for the lab theme
    roughness: 0.6,
    metalness: 0.2,
    side: THREE.DoubleSide
});

function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f7fa); // Elegant "Soft White" Lab background
    scene.fog = new THREE.Fog(0xf5f7fa, 50, 200);

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
    renderer.outputColorSpace = THREE.SRGBColorSpace; // Critical for correct color rendering
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('container').appendChild(renderer.domElement);

    // Environment with a neutral tech-theme
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    scene.environment = pmremGenerator.fromScene(new THREE.Scene()).texture;

    // Add lights - Elegant Lab Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Brighter ambient
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe0e0e0, 1.0);
    scene.add(hemiLight);

    // Key Light - Clean White
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(10, 25, 15);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    // Subtle Soft Fill
    const fillLight = new THREE.DirectionalLight(0x667eea, 0.2); // Very subtle blue tint
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);

    // Clean neutral glow from below
    const bottomLight = new THREE.PointLight(0xffffff, 10, 50);
    bottomLight.position.set(0, -5, 0);
    scene.add(bottomLight);

    // Dynamic High-Fidelity Shadow Light
    const shadowLight = new THREE.DirectionalLight(0xffffff, 0.3);
    shadowLight.position.set(0, 50, 0);
    shadowLight.castShadow = true;
    shadowLight.shadow.mapSize.width = 1024;
    shadowLight.shadow.mapSize.height = 1024;
    scene.add(shadowLight);

    // Add controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 2;
    controls.maxDistance = 100;

    // Initial grid (Transparent/Subtle)
    gridHelper = new THREE.GridHelper(20, 40, 0x667eea, 0xcccccc);
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Add Ground Plane (for shadows)
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

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
    
    // Smoothly focus camera on the identified part
    focusCameraOnObject(object);

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

function focusCameraOnObject(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Calculate new target and slightly move camera
    const targetPos = center.clone();
    
    // Animate controls target smoothly (basic version)
    controls.target.lerp(targetPos, 0.5);
    controls.update();
}

function clearIdentification() {
    if (selectedObject && originalMaterials.has(selectedObject)) {
        selectedObject.material = originalMaterials.get(selectedObject);
    }
    
    selectedObject = null;
    document.getElementById('part-info').style.display = 'none';
}
window.clearIdentification = clearIdentification;

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
    const loadingManager = new THREE.LoadingManager();
    const loader = new FBXLoader(loadingManager);
    const loadingElement = document.getElementById('loading');
    const infoText = document.querySelector('#info p');

    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
        infoText.textContent = `Loading Textures: ${Math.round((itemsLoaded / itemsTotal) * 100)}%`;
    };

    loader.load(
        url,
        (object) => {
            processLoadedModel(object, filename);
            URL.revokeObjectURL(url);
        },
        (xhr) => {
            if (xhr.lengthComputable) {
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                infoText.textContent = `Downloading: ${percentComplete.toFixed(0)}%`;
            }
        },
        (error) => {
            console.error('Error loading FBX:', error);
            loadingElement.querySelector('p').textContent = 'Error loading file';
            URL.revokeObjectURL(url);
        }
    );
}

function loadOBJFromFile(url, filename) {
    const loadingManager = new THREE.LoadingManager();
    const loader = new OBJLoader(loadingManager);
    const infoText = document.querySelector('#info p');

    loader.load(
        url,
        (object) => {
            processLoadedModel(object, filename);
            URL.revokeObjectURL(url);
        },
        (xhr) => {
            if (xhr.lengthComputable) {
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                infoText.textContent = `Downloading: ${percentComplete.toFixed(0)}%`;
            }
        },
        (error) => {
            console.error('Error loading OBJ:', error);
            URL.revokeObjectURL(url);
        }
    );
}

function loadGLTFFromFile(url, filename) {
    const loadingManager = new THREE.LoadingManager();
    const loader = new GLTFLoader(loadingManager);
    const infoText = document.querySelector('#info p');

    loader.load(
        url,
        (gltf) => {
            processLoadedModel(gltf.scene, filename);
            URL.revokeObjectURL(url);
        },
        (xhr) => {
            if (xhr.lengthComputable) {
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                infoText.textContent = `Downloading: ${percentComplete.toFixed(0)}%`;
            }
        },
        (error) => {
            console.error('Error loading GLTF:', error);
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

    // 4. Mesh & Material Integrity Engine
    model.traverse((child) => {
        if (child.isMesh) {
            // Shadow & Culling Optimization
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false; // Prevent high-poly meshes from popping out
            
            // Geometry refinement
            if (child.geometry) {
                // Ensure normals exist for shading. 
                // Don't recompute if they already exist to preserve custom smoothing/hard edges.
                if (!child.geometry.attributes.normal) {
                    child.geometry.computeVertexNormals();
                }
                
                // Generate tangents for better Normal Map quality if a normal map is present
                if (child.material && (child.material.normalMap || (Array.isArray(child.material) && child.material.some(m => m.normalMap)))) {
                    child.geometry.computeTangents();
                }
            }

            if (child.material) {
                const refineMaterial = (m) => {
                    // 1. Structural Integrity
                    m.side = THREE.DoubleSide; // Ensure no "holes" in mecha armor
                    
                    // 2. Vertex Color Support (Common in detailed mecha for secondary detail)
                    if (child.geometry && child.geometry.attributes.color) {
                        m.vertexColors = true;
                    }

                    // 3. Texture Dependency & Color Space Correction
                    const textureMaps = ['map', 'emissiveMap', 'specularMap', 'glossinessMap'];
                    textureMaps.forEach(mapName => {
                        if (m[mapName]) {
                            m[mapName].colorSpace = THREE.SRGBColorSpace;
                            m[mapName].needsUpdate = true;
                        }
                    });

                    // 4. PBR Refinement for high-fidelity meshes
                    if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
                        m.envMapIntensity = 1.0;
                        
                        // Preserve high-poly micro-detail:
                        // Ensure normal maps have full scale/strength
                        if (m.normalScale) m.normalScale.set(1, 1);
                        
                        // Mecha metalness refinement
                        if (m.name && (m.name.toLowerCase().includes('metal') || m.name.toLowerCase().includes('armor'))) {
                            m.metalness = Math.max(m.metalness, 0.7);
                            m.roughness = Math.min(m.roughness, 0.3);
                        }
                    }

                    // 4. Alpha/Transparency Fixes
                    // Some FBX exports set transparency incorrectly. If it looks "ghostly", we fix it.
                    if (m.opacity < 0.05) {
                        m.transparent = false;
                        m.opacity = 1.0;
                    }

                    return m;
                };

                if (Array.isArray(child.material)) {
                    child.material = child.material.map(refineMaterial);
                } else {
                    child.material = refineMaterial(child.material);
                }

                // Store refined material for view mode switching
                child.userData.pbrMaterial = child.material;
            }
        }
    });

    // 5. Camera & Control Focus
    camera.position.set(targetDim, targetDim * 0.7, targetDim);
    controls.target.set(0, targetDim / 2, 0);
    controls.update();

    // Reset View Mode to Material on load
    setViewMode('material');

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
        updateSkeletonUI(true, false);
    } else {
        console.log('No skeleton found in model. Initiating Auto-Rig Engine for Mechanical Hierarchy...');
        autoRigMechanicalModel(object);
    }
}

function autoRigMechanicalModel(object) {
    const virtualBones = [];
    
    // Step 1: Filter and identify significant mechanical pivots (Groups or Meshes with children)
    object.traverse((child) => {
        if (child.children.length > 0 && child !== object) {
            // Create a virtual bone at this pivot's location
            const vBone = new THREE.Bone();
            vBone.name = "vBone_" + (child.name || child.uuid.substring(0, 5));
            
            // Map the virtual bone to the world position of the mesh pivot
            const worldPos = new THREE.Vector3();
            child.getWorldPosition(worldPos);
            vBone.position.copy(worldPos);
            
            // Link the bone to the mesh for reference
            child.userData.virtualBone = vBone;
            virtualBones.push(vBone);
        }
    });

    if (virtualBones.length > 0) {
        // Step 2: Build the Bone hierarchy matching the Mesh hierarchy
        virtualBones.forEach(vBone => {
            // Find the mesh associated with this bone
            let sourceMesh = null;
            object.traverse(c => { if(c.userData.virtualBone === vBone) sourceMesh = c; });
            
            if (sourceMesh && sourceMesh.parent && sourceMesh.parent.userData.virtualBone) {
                sourceMesh.parent.userData.virtualBone.add(vBone);
                // Make the position relative to parent bone
                const parentWorldPos = new THREE.Vector3();
                sourceMesh.parent.getWorldPosition(parentWorldPos);
                vBone.position.sub(parentWorldPos);
            } else {
                scene.add(vBone); // Root bone
            }
        });

        bones = virtualBones;
        skeletonHelper = new THREE.SkeletonHelper(virtualBones[0]);
        skeletonHelper.visible = false;
        scene.add(skeletonHelper);
        
        console.log(`Auto-Rig Generated: ${bones.length} virtual joints mapped to mechanical pivots.`);
        updateSkeletonUI(true, true);
    } else {
        console.log('Model is a static single mesh. No joints identified.');
        updateSkeletonUI(false, false);
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

function setViewMode(mode) {
    if (!model) return;
    currentViewMode = mode;

    // Update UI buttons
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${mode}`).classList.add('active');

    model.traverse((child) => {
        if (child.isMesh) {
            // Restore previous PBR material first if it exists in userData
            if (child.userData.pbrMaterial) {
                child.material = child.userData.pbrMaterial;
            }

            const applyMode = (m) => {
                if (mode === 'wireframe') {
                    m.wireframe = true;
                } else if (mode === 'solid') {
                    m.wireframe = false;
                    // We swap the material but keep properties like DoubleSide
                    return solidMaterial;
                } else {
                    m.wireframe = false;
                }
                return m;
            };

            if (Array.isArray(child.material)) {
                child.material = child.material.map(applyMode);
            } else {
                child.material = applyMode(child.material);
            }
        }
    });
}
window.setViewMode = setViewMode;

function updateSkeletonUI(hasSkeleton, isAutoRigged) {
    const skeletonSection = document.getElementById('skeleton-section');
    if (skeletonSection) {
        skeletonSection.style.display = 'block';
        const status = document.getElementById('skeleton-status');
        if (status) {
            if (isAutoRigged) {
                status.textContent = `Auto-Rig: ${bones.length} Virtual Joints`;
                status.style.color = '#38bdf8'; // Sky blue for auto-rig
            } else if (hasSkeleton) {
                status.textContent = `Rig Detected: ${bones.length} Bones`;
                status.style.color = '#667eea'; // Standard purple for detected rig
            } else {
                status.textContent = 'Static Model (No Joints Found)';
                status.style.color = '#94a3b8';
            }
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
    const loadingManager = new THREE.LoadingManager();
    const loader = new FBXLoader(loadingManager);
    const loadingElement = document.getElementById('loading');
    const infoText = document.querySelector('#info p');

    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
        const percent = (itemsLoaded / itemsTotal) * 100;
        infoText.textContent = `Loading Assets: ${percent.toFixed(0)}%`;
    };

    loader.load(
        'source/Dyan_v06_t05.fbx',
        (object) => {
            processLoadedModel(object, 'Dyan_v06_t05.fbx');
        },
        (xhr) => {
            if (xhr.lengthComputable) {
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                infoText.textContent = `Downloading Model: ${percentComplete.toFixed(0)}%`;
            }
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
