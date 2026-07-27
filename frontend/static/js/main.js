document.addEventListener('DOMContentLoaded', async function() {
    const gestureForm = document.getElementById('gestureForm');
    const gestureList = document.getElementById('gestureList');
    const contactForm = document.getElementById('contactForm');
    const statusElement = document.getElementById('status');
    const cameraSelect = document.getElementById('cameraSelect');
    const refreshCamerasBtn = document.getElementById('refreshCamerasBtn');
    const languageSelect = document.getElementById('languageSelect');
    const filterLanguage = document.getElementById('filterLanguage');
    const gestureLanguage = document.getElementById('gestureLanguage');
    
    // Store selected language, default to 'isl' (Indian Sign Language)
    let selectedLanguage = localStorage.getItem('selectedLanguage') || 'isl';
    
    function trainingStorageKey(lang) {
        return `signTrainingData_${lang || selectedLanguage}`;
    }

    function loadTrainingDataForLanguage(lang) {
        const key = trainingStorageKey(lang);
        const savedData = localStorage.getItem(key);
        let loaded = [];
        if (savedData) {
            try { loaded = JSON.parse(savedData); } catch (e) { loaded = []; }
        }
        trainingData = loaded;
        renderTrainingHistory();
        if (recordStatus) {
            if (loaded.length > 0) {
                recordStatus.textContent = `Loaded ${loaded.length} training samples for ${getLanguageName(lang || selectedLanguage)}!`;
            } else {
                recordStatus.textContent = `No saved data yet for ${getLanguageName(lang || selectedLanguage)}. Start recording!`;
            }
        }
        return loaded;
    }

    function saveTrainingDataForLanguage() {
        localStorage.setItem(trainingStorageKey(selectedLanguage), JSON.stringify(trainingData));
    }

    function onSelectedLanguageChanged(newLang) {
        selectedLanguage = newLang;
        localStorage.setItem('selectedLanguage', selectedLanguage);
        if (gestureList) loadGestures();
        loadVoices();
        if (typeof renderTrainingHistory === 'function') {
            loadTrainingDataForLanguage(selectedLanguage);
        }
        if (gestureLanguage) gestureLanguage.value = selectedLanguage;
        if (filterLanguage) filterLanguage.value = selectedLanguage;
        showStatus(`Switched to ${getLanguageName(selectedLanguage)}`);
    }

    // Initialize language selector if present
    if (languageSelect) {
        languageSelect.value = selectedLanguage;

        languageSelect.addEventListener('change', function() {
            onSelectedLanguageChanged(this.value);
        });
    }
    
    // Initialize filter language if present
    if (filterLanguage) {
        filterLanguage.value = selectedLanguage;

        filterLanguage.addEventListener('change', function() {
            onSelectedLanguageChanged(this.value);
        });
    }
    
    // Initialize gesture language if present
    if (gestureLanguage) {
        gestureLanguage.value = selectedLanguage;
    }

    if (gestureForm) {
        gestureForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const name = document.getElementById('gestureName').value;
            const desc = document.getElementById('gestureDesc').value;
            const lang = document.getElementById('gestureLanguage') ? 
                document.getElementById('gestureLanguage').value : selectedLanguage;
            
            try {
                const response = await fetch('/api/gestures', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        gesture_name: name, 
                        description: desc,
                        language: lang
                    })
                });
                
                if (response.ok) {
                    alert('Gesture added successfully!');
                    gestureForm.reset();
                    loadGestures();
                }
            } catch (error) {
                console.error('Error adding gesture:', error);
            }
        });
    }

    async function loadGestures() {
        if (!gestureList) return;
        
        try {
            const response = await fetch(`/api/gestures?language=${selectedLanguage}`);
            const gestures = await response.json();
            
            gestureList.innerHTML = '';
            gestures.forEach(gesture => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${gesture[1]}</strong>: ${gesture[2]} <em>(${getLanguageName(gesture[3])})</em>`;
                gestureList.appendChild(li);
            });
            
            const totalGestures = document.getElementById('totalGestures');
            if (totalGestures) {
                totalGestures.textContent = gestures.length;
            }
        } catch (error) {
                console.error('Error loading gestures:', error);
        }
    }

    function getLanguageName(code) {
        const languages = {
            'isl': 'Indian Sign Language (ISL)',
            'ben-sl': 'Bengali Sign Language',
            'hin-sl': 'Hindi Sign Language',
            'kan-sl': 'Kannada Sign Language',
            'tam-sl': 'Tamil Sign Language',
            'tel-sl': 'Telugu Sign Language',
            'mar-sl': 'Marathi Sign Language'
        };
        return languages[code] || code;
    }

    loadGestures();

    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Thank you for your message!');
            contactForm.reset();
        });
    }

    // Get permission help element
    const permissionHelp = document.getElementById('permissionHelp');
    
    function showStatus(message, isError = false) {
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.style.color = isError ? '#e74c3c' : '#27ae60';
        }
        console.log(message);
    }
    
    function showPermissionHelp(show) {
        if (permissionHelp) {
            permissionHelp.style.display = show ? 'block' : 'none';
        }
    }

    async function loadCameras(askPermission = false) {
        if (!cameraSelect) return;

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                cameraSelect.innerHTML = '<option value="">Use default camera</option>';
                return;
            }

            if (askPermission) {
                try {
                    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                    tempStream.getTracks().forEach(track => track.stop());
                } catch (e) {
                    console.log('Permission not granted yet');
                }
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');

            cameraSelect.innerHTML = '';

            if (videoDevices.length === 0) {
                cameraSelect.innerHTML = '<option value="">Use default camera</option>';
                showStatus('Camera listing unavailable - default will be used');
            } else {
                videoDevices.forEach((device, index) => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.textContent = device.label || `Camera ${index + 1}`;
                    cameraSelect.appendChild(option);
                });
                showStatus(`Found ${videoDevices.length} camera(s) available`);
            }
        } catch (error) {
            console.error('Error loading cameras:', error);
            cameraSelect.innerHTML = '<option value="">Use default camera</option>';
        }
    }

    // Load cameras on page load with timeout fallback
    if (cameraSelect) {
        const cameraTimeout = setTimeout(() => {
            if (cameraSelect && cameraSelect.innerHTML.includes('Loading cameras')) {
                cameraSelect.innerHTML = '<option value="">Use default camera</option>';
            }
        }, 3000);

        loadCameras().then(() => {
            clearTimeout(cameraTimeout);
        }).catch(() => {
            clearTimeout(cameraTimeout);
            if (cameraSelect && cameraSelect.innerHTML.includes('Loading cameras')) {
                cameraSelect.innerHTML = '<option value="">Use default camera</option>';
            }
        });
    }

    if (refreshCamerasBtn) {
        refreshCamerasBtn.style.cursor = 'pointer';
        refreshCamerasBtn.addEventListener('click', () => loadCameras(true));
    }

    // === SIGN DETECTION WITH MEDIAPIPE ===
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const webcam = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    const detectedText = document.getElementById('detectedText');
    const detectedFacial = document.getElementById('detectedFacial');
    const signNameInput = document.getElementById('signName');
    const recordBtn = document.getElementById('recordBtn');
    const stopRecordBtn = document.getElementById('stopRecordBtn');
    const recordStatus = document.getElementById('recordStatus');
    const toggleHandOnly = document.getElementById('toggleHandOnly');
    const toggleFaceOnly = document.getElementById('toggleFaceOnly');
    const toggleBoth = document.getElementById('toggleBoth');
    
    let hands;
    let faceMesh;
    let camera;
    let stream;
    let isRecording = false;
    let currentSignData = [];
    let trainingData = []; // Array of {label: string, landmarks: number[]}
    let detectionMode = 'both'; // 'hands', 'face', or 'both'
    let lastHandResults = null;
    let lastFaceResults = null;
    let frameScheduled = false;
    let isCameraActive = false;
    let animationId = null;
    // FPS throttling: target 30 FPS for preview and MediaPipe detection
    const TARGET_FPS = 30;
    const FRAME_INTERVAL = 1000 / TARGET_FPS;
    let lastFrameTime = 0;
    let lastDetectionTime = 0;
    
    // Detection & Training History
    let detectionHistory = JSON.parse(localStorage.getItem('detectionHistory') || '[]');
    let lastLoggedSign = '';
    let lastLoggedTime = 0;
    const SIGN_LOG_COOLDOWN_MS = 1500; // Prevent duplicate entries for same sign
    const clearDetectionHistoryBtn = document.getElementById('clearDetectionHistory');
    const clearTrainingHistoryBtn = document.getElementById('clearTrainingHistory');
    const detectionHistoryList = document.getElementById('detectionHistoryList');
    const trainingHistoryList = document.getElementById('trainingHistoryList');
    
    function formatTime(timestamp) {
        const d = new Date(timestamp);
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        const s = String(d.getSeconds()).padStart(2, '0');
        return `${h}:${m}:${s}`;
    }
    
    function addDetectionToHistory(signName) {
        const now = Date.now();
        if (signName === lastLoggedSign && (now - lastLoggedTime) < SIGN_LOG_COOLDOWN_MS) return;
        lastLoggedSign = signName;
        lastLoggedTime = now;
        
        detectionHistory.unshift({ sign: signName, time: now });
        if (detectionHistory.length > 100) detectionHistory.pop();
        localStorage.setItem('detectionHistory', JSON.stringify(detectionHistory));
        renderDetectionHistory();
    }
    
    function renderDetectionHistory() {
        if (!detectionHistoryList) return;
        if (detectionHistory.length === 0) {
            detectionHistoryList.innerHTML = '<p style="color: #999; text-align: center; padding: 1rem;">No signs detected yet.</p>';
            return;
        }
        detectionHistoryList.innerHTML = detectionHistory.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0.8rem; border-bottom: 1px solid #f0f0f0;">
                <span style="font-weight: 600; color: #2c3e50;">${escapeHtml(item.sign)}</span>
                <span style="color: #888; font-size: 0.85rem;">${formatTime(item.time)}</span>
            </div>
        `).join('');
    }
    
    function renderTrainingHistory() {
        if (!trainingHistoryList) return;
        if (trainingData.length === 0) {
            trainingHistoryList.innerHTML = '<p style="color: #999; text-align: center; padding: 1rem;">No signs recorded yet.</p>';
            return;
        }
        const counts = {};
        trainingData.forEach(d => {
            counts[d.label] = (counts[d.label] || 0) + 1;
        });
        const entries = Object.entries(counts);
        const totalSamples = entries.reduce((s, e) => s + e[1], 0);
        trainingHistoryList.innerHTML = `
            <div style="padding: 0.5rem 0.8rem; border-bottom: 2px solid #e0e0e0; margin-bottom: 0.5rem;">
                <span style="font-weight: 600; color: #2c3e50;">Total:</span>
                <span style="color: #888;"> ${entries.length} sign(s) &middot; ${totalSamples} sample(s)</span>
            </div>
            ${entries.map(([label, count]) => `
                <div style="display: flex; justify-content: space-between; padding: 0.5rem 0.8rem; border-bottom: 1px solid #f0f0f0;">
                    <span style="font-weight: 600; color: #27ae60;">${escapeHtml(label)}</span>
                    <span style="color: #888; font-size: 0.9rem;">${count} sample(s)</span>
                </div>
            `).join('')}
        `;
    }
    
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    if (clearDetectionHistoryBtn) {
        clearDetectionHistoryBtn.style.cursor = 'pointer';
        clearDetectionHistoryBtn.addEventListener('click', () => {
            if (confirm('Clear detection history?')) {
                detectionHistory = [];
                localStorage.removeItem('detectionHistory');
                lastLoggedSign = '';
                lastLoggedTime = 0;
                renderDetectionHistory();
                showStatus('Detection history cleared');
            }
        });
    }
    
    if (clearTrainingHistoryBtn) {
        clearTrainingHistoryBtn.style.cursor = 'pointer';
        clearTrainingHistoryBtn.addEventListener('click', () => {
            if (confirm(`Delete ALL recorded signs for ${getLanguageName(selectedLanguage)}? This cannot be undone.`)) {
                trainingData = [];
                localStorage.removeItem(trainingStorageKey(selectedLanguage));
                renderTrainingHistory();
                if (recordStatus) recordStatus.textContent = `No saved data yet for ${getLanguageName(selectedLanguage)}. Start recording!`;
                showStatus(`All recorded signs for ${getLanguageName(selectedLanguage)} deleted`);
            }
        });
    }
    
    // Initial render on load
    renderDetectionHistory();
    renderTrainingHistory();
    
    // Facial landmark indices for expressions
    const TOP_LIP = 13;
    const BOTTOM_LIP = 14;
    const LEFT_EYE_TOP = 386;
    const LEFT_EYE_BOTTOM = 374;
    const RIGHT_EYE_TOP = 159;
    const RIGHT_EYE_BOTTOM = 145;
    const LEFT_BROW_INNER = 285;
    const RIGHT_BROW_INNER = 52;
    const LEFT_BROW_OUTER = 336;
    const RIGHT_BROW_OUTER = 105;

    // Simple KNN Classifier
    function euclideanDistance(a, b) {
        return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
    }

    function knnClassify(landmarks, k = 5) {
        if (trainingData.length === 0) return null;
        
        const distances = trainingData.map((data, index) => ({
            index,
            distance: euclideanDistance(landmarks, data.landmarks),
            label: data.label
        })).sort((a, b) => a.distance - b.distance);
        
        const neighbors = distances.slice(0, k);
        const labelCounts = {};
        neighbors.forEach(n => {
            labelCounts[n.label] = (labelCounts[n.label] || 0) + 1;
        });
        
        let maxCount = 0;
        let predictedLabel = null;
        for (const label in labelCounts) {
            if (labelCounts[label] > maxCount) {
                maxCount = labelCounts[label];
                predictedLabel = label;
            }
        }
        return predictedLabel;
    }

    // Flatten landmarks to a 1D array
    function flattenLandmarks(landmarks) {
        return landmarks.flatMap(lm => [lm.x, lm.y, lm.z]);
    }

    async function initializeHands() {
        hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 0, // Lower complexity for better performance
            minDetectionConfidence: 0.6, // Slightly lower for faster detection
            minTrackingConfidence: 0.4
        });

        hands.onResults(onHandsResults);
    }

    async function initializeFaceMesh() {
        faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });

        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: false, // Disable refined landmarks for better performance
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.4
        });

        faceMesh.onResults(onFaceResults);
    }

    function detectFacialExpression(landmarks) {
        // Calculate mouth openness
        const topLip = landmarks[TOP_LIP];
        const bottomLip = landmarks[BOTTOM_LIP];
        const mouthOpenness = Math.abs(topLip.y - bottomLip.y);
        
        // Calculate eye openness
        const leftEyeTop = landmarks[LEFT_EYE_TOP];
        const leftEyeBottom = landmarks[LEFT_EYE_BOTTOM];
        const rightEyeTop = landmarks[RIGHT_EYE_TOP];
        const rightEyeBottom = landmarks[RIGHT_EYE_BOTTOM];
        const leftEyeOpenness = Math.abs(leftEyeTop.y - leftEyeBottom.y);
        const rightEyeOpenness = Math.abs(rightEyeTop.y - rightEyeBottom.y);
        const avgEyeOpenness = (leftEyeOpenness + rightEyeOpenness) / 2;
        
        // Calculate eyebrow position
        const leftBrowInner = landmarks[LEFT_BROW_INNER];
        const rightBrowInner = landmarks[RIGHT_BROW_INNER];
        const leftBrowOuter = landmarks[LEFT_BROW_OUTER];
        const rightBrowOuter = landmarks[RIGHT_BROW_OUTER];
        const avgBrowY = (leftBrowInner.y + rightBrowInner.y + leftBrowOuter.y + rightBrowOuter.y) / 4;
        
        // Simple expression detection (thresholds are approximate, can be tuned)
        if (mouthOpenness > 0.08 && avgEyeOpenness > 0.03) {
            return 'Surprised 😲';
        } else if (mouthOpenness > 0.05 && avgEyeOpenness < 0.025) {
            return 'Happy 😊';
        } else if (avgBrowY < 0.3 && mouthOpenness < 0.03) {
            return 'Angry 😠';
        } else if (avgBrowY > 0.35 && mouthOpenness < 0.03) {
            return 'Sad 😢';
        } else {
            return 'Neutral 😐';
        }
    }

    function onHandsResults(results) {
        lastHandResults = results;
        scheduleRender();
    }

    function onFaceResults(results) {
        lastFaceResults = results;
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const expression = detectFacialExpression(results.multiFaceLandmarks[0]);
            if (detectedFacial) {
                detectedFacial.textContent = expression;
            }
        } else {
            if (detectedFacial) {
                detectedFacial.textContent = 'Waiting for face...';
            }
        }
        scheduleRender();
    }

    function continuousPreviewLoop(timestamp) {
        if (!isCameraActive) return;
        animationId = requestAnimationFrame(continuousPreviewLoop);
        
        const elapsed = timestamp - lastFrameTime;
        if (elapsed < FRAME_INTERVAL) return; // skip frames to hit ~30 FPS
        lastFrameTime = timestamp - (elapsed % FRAME_INTERVAL);
        
        renderCanvas();
    }

    function scheduleRender() {
        // Render is already handled by continuousPreviewLoop when camera is active
        if (!isCameraActive && !frameScheduled) {
            frameScheduled = true;
            requestAnimationFrame(() => {
                renderCanvas();
                frameScheduled = false;
            });
        }
    }

    function renderCanvas() {
        if (!canvas) return;
        const canvasCtx = canvas.getContext('2d');
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        // Always draw the current webcam frame so user can see themselves immediately
        if (webcam && webcam.readyState === 4) {
            canvasCtx.drawImage(webcam, 0, 0, canvas.width, canvas.height);
        } else if (lastHandResults && lastHandResults.image) {
            canvasCtx.drawImage(lastHandResults.image, 0, 0, canvas.width, canvas.height);
        } else if (lastFaceResults && lastFaceResults.image) {
            canvasCtx.drawImage(lastFaceResults.image, 0, 0, canvas.width, canvas.height);
        }

        const hasDrawingUtils = typeof drawConnectors !== 'undefined' && typeof drawLandmarks !== 'undefined';
        const hasHandConns = typeof HAND_CONNECTIONS !== 'undefined';
        const hasFaceMesh = typeof FACEMESH_TESSELATION !== 'undefined' &&
                            typeof FACEMESH_RIGHT_EYE !== 'undefined' &&
                            typeof FACEMESH_RIGHT_EYEBROW !== 'undefined' &&
                            typeof FACEMESH_LEFT_EYE !== 'undefined' &&
                            typeof FACEMESH_LEFT_EYEBROW !== 'undefined' &&
                            typeof FACEMESH_FACE_OVAL !== 'undefined' &&
                            typeof FACEMESH_LIPS !== 'undefined';

        // Draw hand landmarks if in hands or both mode
        if ((detectionMode === 'hands' || detectionMode === 'both') && lastHandResults && lastHandResults.multiHandLandmarks) {
            for (const landmarks of lastHandResults.multiHandLandmarks) {
                if (hasDrawingUtils && hasHandConns) {
                    try {
                        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
                        drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 3 });
                    } catch (e) {
                        console.warn('Hand drawing error:', e);
                    }
                }
                
                // Collect data or classify
                const flatLandmarks = flattenLandmarks(landmarks);
                if (isRecording && signNameInput.value) {
                    currentSignData.push(flatLandmarks);
                    if (recordStatus) recordStatus.textContent = `Recorded ${currentSignData.length} samples...`;
                } else if (trainingData.length > 0) {
                    const predictedSign = knnClassify(flatLandmarks);
                    if (detectedText && predictedSign) {
                        addDetectionToHistory(predictedSign);
                        if (detectedText.textContent !== predictedSign) {
                            detectedText.textContent = predictedSign;
                            if ('speechSynthesis' in window) {
                                try {
                                    speechSynthesis.cancel();
                                    const utterance = new SpeechSynthesisUtterance(predictedSign);
                                    utterance.rate = 0.9;
                                    const prefLang = getSpokenLangCode(selectedLanguage);
                                    if (voiceSelector && voiceSelector.value !== '') {
                                        utterance.voice = voices[voiceSelector.value];
                                    } else {
                                        const matching = voices.find(v => v.lang.toLowerCase().startsWith(prefLang));
                                        if (matching) utterance.voice = matching;
                                        if (matching) utterance.lang = matching.lang;
                                    }
                                    speechSynthesis.speak(utterance);
                                } catch (e) {
                                    console.warn('Speech error:', e);
                                }
                            }
                        }
                    }
                }
            }
            
            if (!isRecording && trainingData.length === 0 && lastHandResults.multiHandLandmarks.length > 0) {
                if (detectedText) {
                    detectedText.textContent = `Hand${lastHandResults.multiHandLandmarks.length > 1 ? 's' : ''} detected! Collect data to start recognition.`;
                }
            }
        } else if (detectionMode === 'hands') {
            if (detectedText && !isRecording) {
                detectedText.textContent = 'Waiting for hands...';
            }
        }

        // Draw face landmarks if in face or both mode
        if ((detectionMode === 'face' || detectionMode === 'both') && lastFaceResults && lastFaceResults.multiFaceLandmarks) {
            for (const landmarks of lastFaceResults.multiFaceLandmarks) {
                if (hasDrawingUtils && hasFaceMesh) {
                    try {
                        drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, { color: '#C0C0C070', lineWidth: 1 });
                        drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, { color: '#FF3030' });
                        drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYEBROW, { color: '#FF3030' });
                        drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, { color: '#30FF30' });
                        drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYEBROW, { color: '#30FF30' });
                        drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, { color: '#E0E0E0' });
                        drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, { color: '#E0E0E0' });
                    } catch (e) {
                        console.warn('Face drawing error:', e);
                    }
                }
            }
        }

        canvasCtx.restore();
    }
    
    // Data Collection Controls
    if (recordBtn && stopRecordBtn) {
        recordBtn.style.cursor = 'pointer';
        stopRecordBtn.style.cursor = 'pointer';

        recordBtn.addEventListener('click', () => {
            if (!signNameInput.value) {
                alert('Please enter a sign name first!');
                return;
            }
            isRecording = true;
            currentSignData = [];
            recordBtn.style.display = 'none';
            stopRecordBtn.style.display = 'inline-block';
            if (recordStatus) recordStatus.textContent = 'Recording... Make the sign!';
        });
        
        stopRecordBtn.addEventListener('click', () => {
            isRecording = false;
            stopRecordBtn.style.display = 'none';
            recordBtn.style.display = 'inline-block';
            
            if (currentSignData.length > 0) {
                const label = signNameInput.value;
                currentSignData.forEach(landmarks => {
                    trainingData.push({ label, landmarks });
                });
                if (recordStatus) recordStatus.textContent = `Saved ${currentSignData.length} samples for "${label}"! Total training data: ${trainingData.length}`;
                
                saveTrainingDataForLanguage();
                renderTrainingHistory();
            } else {
                if (recordStatus) recordStatus.textContent = 'No data recorded!';
            }
        });
        
        const preLoadedSigns = [];
        const loadedData = loadTrainingDataForLanguage(selectedLanguage);
        trainingData = [...preLoadedSigns, ...loadedData];
        renderTrainingHistory();
    }

    // Detection mode toggles
    if (toggleHandOnly && toggleFaceOnly && toggleBoth) {
        function applyDetectionModeUI() {
            if (detectionMode === 'hands') {
                toggleHandOnly.className = 'btn-primary';
                toggleFaceOnly.className = 'btn-secondary';
                toggleBoth.className = 'btn-secondary';
            } else if (detectionMode === 'face') {
                toggleHandOnly.className = 'btn-secondary';
                toggleFaceOnly.className = 'btn-primary';
                toggleBoth.className = 'btn-secondary';
            } else {
                toggleHandOnly.className = 'btn-secondary';
                toggleFaceOnly.className = 'btn-secondary';
                toggleBoth.className = 'btn-primary';
            }
        }
        applyDetectionModeUI();

        toggleHandOnly.style.cursor = 'pointer';
        toggleFaceOnly.style.cursor = 'pointer';
        toggleBoth.style.cursor = 'pointer';

        toggleHandOnly.addEventListener('click', () => {
            detectionMode = 'hands';
            applyDetectionModeUI();
            showStatus('Detection mode: Hands Only');
            if (detectedText) detectedText.textContent = 'Waiting for hands...';
        });

        toggleFaceOnly.addEventListener('click', () => {
            detectionMode = 'face';
            applyDetectionModeUI();
            showStatus('Detection mode: Face Only');
            if (detectedFacial) detectedFacial.textContent = 'Waiting for face...';
        });

        toggleBoth.addEventListener('click', () => {
            detectionMode = 'both';
            applyDetectionModeUI();
            showStatus('Detection mode: Hands + Face');
        });
    }

    if (startBtn && stopBtn && webcam && canvas) {
        startBtn.style.cursor = 'pointer';
        stopBtn.style.cursor = 'pointer';
        let mediapipeReady = false;
        let mediapipeInitPromise = null;

        async function ensureMediaPipeInitialized() {
            if (mediapipeReady) return true;
            if (mediapipeInitPromise) return mediapipeInitPromise;
            mediapipeInitPromise = (async () => {
                try {
                    if (typeof Hands === 'undefined' || typeof FaceMesh === 'undefined' || typeof Camera === 'undefined') {
                        console.warn('MediaPipe scripts not loaded, detection unavailable');
                        return false;
                    }
                    await initializeHands();
                    await initializeFaceMesh();
                    mediapipeReady = true;
                    return true;
                } catch (e) {
                    console.warn('MediaPipe initialization failed:', e);
                    return false;
                }
            })();
            return mediapipeInitPromise;
        }

        startBtn.addEventListener('click', async function() {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('Media devices API not available in this browser');
                }

                showStatus('Requesting camera permission...');

                const selectedCameraId = cameraSelect ? cameraSelect.value : '';

                const constraints = {
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 30, max: 30 },
                        facingMode: 'user'
                    },
                    audio: false
                };

                if (selectedCameraId) {
                    constraints.video.deviceId = { exact: selectedCameraId };
                }

                stream = await navigator.mediaDevices.getUserMedia(constraints);

                webcam.srcObject = stream;
                showStatus('Camera connected! Initializing detection...');

                webcam.onloadedmetadata = async () => {
                    webcam.play();

                    canvas.width = webcam.videoWidth;
                    canvas.height = webcam.videoHeight;

                    isCameraActive = true;
                    continuousPreviewLoop();

                    const mpReady = await ensureMediaPipeInitialized();
                    if (mpReady) {
                        try {
                            camera = new Camera(webcam, {
                                onFrame: async () => {
                                    try {
                                        const tasks = [];
                                        if ((detectionMode === 'hands' || detectionMode === 'both') && hands) {
                                            tasks.push(hands.send({ image: webcam }).catch(err => console.warn('Hands detection error:', err)));
                                        }
                                        if ((detectionMode === 'face' || detectionMode === 'both') && faceMesh) {
                                            tasks.push(faceMesh.send({ image: webcam }).catch(err => console.warn('FaceMesh detection error:', err)));
                                        }
                                        await Promise.all(tasks);
                                    } catch (e) {
                                        console.warn('MediaPipe onFrame error:', e);
                                    }
                                },
                                width: 640,
                                height: 480
                            });

                            await camera.start();
                            showStatus('Detection active! Show your hands!');
                        } catch (e) {
                            console.warn('Failed to start MediaPipe camera:', e);
                            showStatus('Camera active! (MediaPipe detection unavailable)');
                        }
                    } else {
                        showStatus('Camera active! (Detection scripts failed to load)');
                    }
                };

                if (cameraSelect) {
                    loadCameras(true);
                }
            } catch (error) {
                let errorMessage = 'Could not access camera: ';

                switch (error.name) {
                    case 'NotAllowedError':
                        errorMessage += 'Permission denied. Please allow camera access in your browser settings.';
                        showPermissionHelp(true);
                        break;
                    case 'NotFoundError':
                        errorMessage += 'No camera found. Please connect a camera and try again.';
                        showPermissionHelp(false);
                        break;
                    case 'NotReadableError':
                        errorMessage += 'Camera is already in use by another application.';
                        showPermissionHelp(false);
                        break;
                    case 'OverconstrainedError':
                        errorMessage += 'No camera matches the requested constraints.';
                        showPermissionHelp(false);
                        break;
                    case 'AbortError':
                        errorMessage += 'Camera access aborted.';
                        showPermissionHelp(false);
                        break;
                    case 'TypeError':
                        errorMessage += 'Invalid constraints.';
                        showPermissionHelp(false);
                        break;
                    default:
                        errorMessage += error.message;
                        showPermissionHelp(false);
                }

                console.error('Camera access error:', error);
                showStatus(errorMessage, true);
                alert(errorMessage);
            }
        });

        stopBtn.addEventListener('click', function() {
            isCameraActive = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }

            if (camera) {
                camera.stop();
                camera = null;
            }
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                webcam.srcObject = null;
                const canvasCtx = canvas.getContext('2d');
                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
                if (detectedText) {
                    detectedText.textContent = 'Waiting for detection...';
                }
                if (detectedFacial) {
                    detectedFacial.textContent = 'Waiting for face...';
                }
                showStatus('Camera disconnected');
            }
        });
    }

    const startTranslationBtn = document.getElementById('startTranslationBtn');
    const stopTranslationBtn = document.getElementById('stopTranslationBtn');
    const translationWebcam = document.getElementById('translationWebcam');
    const translationCanvas = document.getElementById('translationCanvas');
    const startSTTBtn = document.getElementById('startSTTBtn');
    const stopSTTBtn = document.getElementById('stopSTTBtn');
    const sttLanguage = document.getElementById('sttLanguage');

    let translationHands;
    let translationFaceMesh;
    let translationCamera;
    let transLastHandResults = null;
    let transLastFaceResults = null;
    let transLastSign = '';
    let transLastSignTime = 0;
    let transAnimationId = null;
    let transLastFrameTime = 0;
    let isTransCameraActive = false;
    const TRANS_FRAME_INTERVAL = 1000 / 30;

    async function ensureTranslationMediaPipe() {
        if (typeof Hands === 'undefined' || typeof FaceMesh === 'undefined' || typeof Camera === 'undefined') {
            return false;
        }
        try {
            if (!translationHands) {
                translationHands = new Hands({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
                });
                translationHands.setOptions({
                    maxNumHands: 2,
                    modelComplexity: 0,
                    minDetectionConfidence: 0.6,
                    minTrackingConfidence: 0.4
                });
                translationHands.onResults((r) => { transLastHandResults = r; scheduleTransRender(); });
            }
            if (!translationFaceMesh) {
                translationFaceMesh = new FaceMesh({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
                });
                translationFaceMesh.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: false,
                    minDetectionConfidence: 0.6,
                    minTrackingConfidence: 0.4
                });
                translationFaceMesh.onResults((r) => { transLastFaceResults = r; scheduleTransRender(); });
            }
            return true;
        } catch (e) {
            console.warn('Translation MediaPipe init failed:', e);
            return false;
        }
    }

    let transFrameScheduled = false;
    function scheduleTransRender() {
        if (!transFrameScheduled && !isTransCameraActive) {
            transFrameScheduled = true;
            requestAnimationFrame(() => { renderTranslationCanvas(); transFrameScheduled = false; });
        }
    }

    function continuousTransPreviewLoop(timestamp) {
        if (!isTransCameraActive) return;
        transAnimationId = requestAnimationFrame(continuousTransPreviewLoop);
        const elapsed = timestamp - transLastFrameTime;
        if (elapsed < TRANS_FRAME_INTERVAL) return;
        transLastFrameTime = timestamp - (elapsed % TRANS_FRAME_INTERVAL);
        renderTranslationCanvas();
    }

    function renderTranslationCanvas() {
        if (!translationCanvas) return;
        const tCtx = translationCanvas.getContext('2d');
        tCtx.save();
        tCtx.clearRect(0, 0, translationCanvas.width, translationCanvas.height);
        if (translationWebcam && translationWebcam.readyState === 4) {
            tCtx.drawImage(translationWebcam, 0, 0, translationCanvas.width, translationCanvas.height);
        }
        const hasDraw = typeof drawConnectors !== 'undefined' && typeof drawLandmarks !== 'undefined';
        const hasHandConns = typeof HAND_CONNECTIONS !== 'undefined';
        const hasFaceMesh = typeof FACEMESH_TESSELATION !== 'undefined';
        if (transLastHandResults && transLastHandResults.multiHandLandmarks) {
            for (const landmarks of transLastHandResults.multiHandLandmarks) {
                if (hasDraw && hasHandConns) {
                    try {
                        drawConnectors(tCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
                        drawLandmarks(tCtx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 3 });
                    } catch (e) {}
                }
                if (trainingData.length > 0) {
                    const flat = flattenLandmarks(landmarks);
                    const pred = knnClassify(flat);
                    if (pred) {
                        const now = Date.now();
                        if (pred !== transLastSign || (now - transLastSignTime) > 1500) {
                            transLastSign = pred;
                            transLastSignTime = now;
                            addDetectionToHistory(pred);
                            if (translatedText) {
                                translatedText.textContent = pred;
                            }
                            if ('speechSynthesis' in window) {
                                try {
                                    speechSynthesis.cancel();
                                    const utter = new SpeechSynthesisUtterance(pred);
                                    utter.rate = 0.9;
                                    const preferredLang = getSpokenLangCode(selectedLanguage);
                                    if (voiceSelector && voiceSelector.value !== '') {
                                        utter.voice = voices[voiceSelector.value];
                                    } else {
                                        const matching = voices.find(v => v.lang.toLowerCase().startsWith(preferredLang));
                                        if (matching) utter.voice = matching;
                                        utter.lang = matching ? matching.lang : (preferredLang + '-' + (preferredLang === 'en' ? 'IN' : preferredLang === 'hi' ? 'IN' : 'IN'));
                                    }
                                    speechSynthesis.speak(utter);
                                } catch (e) {}
                            }
                        }
                    }
                }
            }
        }
        if (transLastFaceResults && transLastFaceResults.multiFaceLandmarks && hasDraw && hasFaceMesh) {
            for (const landmarks of transLastFaceResults.multiFaceLandmarks) {
                try {
                    drawConnectors(tCtx, landmarks, FACEMESH_TESSELATION, { color: '#C0C0C070', lineWidth: 1 });
                    drawConnectors(tCtx, landmarks, FACEMESH_RIGHT_EYE, { color: '#FF3030' });
                    drawConnectors(tCtx, landmarks, FACEMESH_RIGHT_EYEBROW, { color: '#FF3030' });
                    drawConnectors(tCtx, landmarks, FACEMESH_LEFT_EYE, { color: '#30FF30' });
                    drawConnectors(tCtx, landmarks, FACEMESH_LEFT_EYEBROW, { color: '#30FF30' });
                    drawConnectors(tCtx, landmarks, FACEMESH_FACE_OVAL, { color: '#E0E0E0' });
                    drawConnectors(tCtx, landmarks, FACEMESH_LIPS, { color: '#E0E0E0' });
                } catch (e) {}
            }
        }
        tCtx.restore();
    }

    if (startTranslationBtn && stopTranslationBtn && translationWebcam) {
        let translationStream;
        startTranslationBtn.style.cursor = 'pointer';
        stopTranslationBtn.style.cursor = 'pointer';

        startTranslationBtn.addEventListener('click', async function() {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('Media devices API not available in this browser');
                }

                showStatus('Requesting camera permission...');

                translationStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 30, max: 30 },
                        facingMode: 'user'
                    },
                    audio: false
                });

                translationWebcam.srcObject = translationStream;
                showStatus('Camera connected! Initializing translation detection...');

                translationWebcam.onloadedmetadata = async () => {
                    translationWebcam.play();
                    if (translationCanvas) {
                        translationCanvas.width = translationWebcam.videoWidth;
                        translationCanvas.height = translationWebcam.videoHeight;
                    }
                    isTransCameraActive = true;
                    continuousTransPreviewLoop();
                    const mpReady = await ensureTranslationMediaPipe();
                    if (mpReady) {
                        try {
                            translationCamera = new Camera(translationWebcam, {
                                onFrame: async () => {
                                    try {
                                        const tasks = [];
                                        if (translationHands) tasks.push(translationHands.send({ image: translationWebcam }).catch(() => {}));
                                        if (translationFaceMesh) tasks.push(translationFaceMesh.send({ image: translationWebcam }).catch(() => {}));
                                        await Promise.all(tasks);
                                    } catch (e) {}
                                },
                                width: 640,
                                height: 480
                            });
                            await translationCamera.start();
                            showStatus(`Translation active for ${getLanguageName(selectedLanguage)}! Show your hands!`);
                            if (translatedText && translatedText.textContent.includes('will appear here')) {
                                translatedText.textContent = 'Awaiting sign detection...';
                            }
                        } catch (e) {
                            console.warn('Failed to start translation camera:', e);
                            showStatus('Camera active! (detection unavailable)');
                        }
                    } else {
                        showStatus('Camera active! (detection scripts failed to load)');
                    }
                };
            } catch (error) {
                let errorMessage = 'Could not access camera: ';
                switch (error.name) {
                    case 'NotAllowedError':
                        errorMessage += 'Permission denied. Please allow camera access in your browser settings.';
                        showPermissionHelp(true);
                        break;
                    case 'NotFoundError':
                        errorMessage += 'No camera found. Please connect a camera and try again.';
                        showPermissionHelp(false);
                        break;
                    case 'NotReadableError':
                        errorMessage += 'Camera is already in use by another application.';
                        showPermissionHelp(false);
                        break;
                    case 'OverconstrainedError':
                        errorMessage += 'No camera matches the requested constraints.';
                        showPermissionHelp(false);
                        break;
                    case 'AbortError':
                        errorMessage += 'Camera access aborted.';
                        showPermissionHelp(false);
                        break;
                    case 'TypeError':
                        errorMessage += 'Invalid constraints.';
                        showPermissionHelp(false);
                        break;
                    default:
                        errorMessage += error.message;
                        showPermissionHelp(false);
                }
                console.error('Translation camera access error:', error);
                showStatus(errorMessage, true);
                alert(errorMessage);
            }
        });

        stopTranslationBtn.addEventListener('click', function() {
            isTransCameraActive = false;
            if (transAnimationId) {
                cancelAnimationFrame(transAnimationId);
                transAnimationId = null;
            }
            if (translationCamera) {
                translationCamera.stop();
                translationCamera = null;
            }
            if (translationStream) {
                translationStream.getTracks().forEach(track => track.stop());
                translationWebcam.srcObject = null;
                translationStream = null;
            }
            if (translationCanvas) {
                const tCtx = translationCanvas.getContext('2d');
                tCtx.clearRect(0, 0, translationCanvas.width, translationCanvas.height);
            }
            showStatus('Camera disconnected');
        });
    }

    // === SPEECH TO TEXT ===
    if (startSTTBtn && stopSTTBtn) {
        let recognition;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            startSTTBtn.disabled = true;
            startSTTBtn.textContent = "Speech recognition not supported";
            showStatus("Speech recognition not supported in this browser. Try Chrome/Edge.", true);
        } else {
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            
            if (sttLanguage) {
                recognition.lang = sttLanguage.value;
                sttLanguage.addEventListener('change', function() {
                    recognition.lang = this.value;
                });
            }
            
            recognition.onstart = function() {
                startSTTBtn.style.display = "none";
                stopSTTBtn.style.display = "inline-block";
                showStatus("Listening... Speak now!");
            };
            
            recognition.onresult = function(event) {
                let transcript = "";
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript;
                }
                if (textToSpeak) {
                    textToSpeak.value = transcript;
                }
            };
            
            recognition.onerror = function(event) {
                console.error("Speech recognition error:", event.error);
                let errorMsg = "Speech recognition error: ";
                switch(event.error) {
                    case 'not-allowed':
                        errorMsg += "Microphone permission denied. Please allow microphone access.";
                        showPermissionHelp(true);
                        break;
                    case 'no-speech':
                        errorMsg += "No speech detected.";
                        break;
                    default:
                        errorMsg += event.error;
                }
                showStatus(errorMsg, true);
            };
            
            recognition.onend = function() {
                startSTTBtn.style.display = "inline-block";
                stopSTTBtn.style.display = "none";
                showStatus("Stopped listening");
            };
            
            startSTTBtn.addEventListener('click', function() {
                recognition.start();
            });
            
            stopSTTBtn.addEventListener('click', function() {
                recognition.stop();
            });
        }
    }

    const speakBtn = document.getElementById('speakBtn');
    const clearBtn = document.getElementById('clearBtn');
    const translatedText = document.getElementById('translatedText');
    const textToSpeak = document.getElementById('textToSpeak');
    const voiceSelector = document.getElementById('voiceSelector');
    
    // Map sign language codes to spoken language codes
    function getSpokenLangCode(signLangCode) {
        const mapping = {
            'isl': 'hi', // Indian Sign Language → Hindi
            'ben-sl': 'bn', // Bengali Sign Language → Bengali
            'hin-sl': 'hi', // Hindi Sign Language → Hindi
            'kan-sl': 'kn', // Kannada Sign Language → Kannada
            'tam-sl': 'ta', // Tamil Sign Language → Tamil
            'tel-sl': 'te', // Telugu Sign Language → Telugu
            'mar-sl': 'mr' // Marathi Sign Language → Marathi
        };
        return mapping[signLangCode] || 'en'; // Default to English
    }
    
    // Load and populate voices
    let voices = [];
    
    function loadVoices() {
        voices = speechSynthesis.getVoices();
        if (voiceSelector) {
            voiceSelector.innerHTML = '';
            
            // List of Indian language codes we want to show
            const indianLangs = ['en', 'hi', 'bn', 'ta', 'te', 'kn', 'mr', 'gu', 'pa', 'or', 'as', 'ml'];
            
            // Filter voices: English OR any Indian language
            const filteredVoices = voices.filter(voice => {
                const langCode = voice.lang.toLowerCase();
                return indianLangs.some(indLang => langCode.startsWith(indLang));
            });
            
            if (filteredVoices.length === 0) {
                voiceSelector.innerHTML = '<option value="">No Indian/English voices found</option>';
            } else {
                // Get the preferred spoken language for current selected sign language
                const preferredLang = getSpokenLangCode(selectedLanguage);
                
                filteredVoices.forEach((voice, index) => {
                    const option = document.createElement('option');
                    const originalIndex = voices.indexOf(voice);
                    option.value = originalIndex;
                    option.textContent = `${voice.name} (${voice.lang})`;
                    
                    // Auto-select voice matching the preferred language
                    if (voice.lang.toLowerCase().startsWith(preferredLang)) {
                        option.selected = true;
                    } else if (voice.lang.startsWith('en') && !voiceSelector.querySelector('[selected]')) {
                        // Fallback to English if no matching language found
                        option.selected = true;
                    }
                    
                    voiceSelector.appendChild(option);
                });
            }
        }
    }
    
    // Some browsers load voices asynchronously
    if ('speechSynthesis' in window) {
        speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices(); // Try to load immediately
    }
    
    if (speakBtn) {
        speakBtn.addEventListener('click', function() {
            // Use the textarea for input
            const text = textToSpeak ? textToSpeak.value : (translatedText ? translatedText.textContent : 'Hello!');
            
            // Use browser's speech synthesis for better voices
            if ('speechSynthesis' in window) {
                // Cancel any ongoing speech
                speechSynthesis.cancel();
                
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                
                if (voiceSelector && voiceSelector.value !== '') {
                    utterance.voice = voices[voiceSelector.value];
                }
                
                speechSynthesis.speak(utterance);
                console.log('Speaking:', text);
            } else {
                alert('Speech synthesis is not available in your browser.');
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            if (textToSpeak) {
                textToSpeak.value = '';
            }
            if (translatedText) {
                translatedText.textContent = 'Your sign language translations will appear here!';
            }
        });
    }
});
