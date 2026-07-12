document.addEventListener('DOMContentLoaded', function() {
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
    
    // Initialize language selector if present
    if (languageSelect) {
        languageSelect.value = selectedLanguage;
        
        languageSelect.addEventListener('change', function() {
            selectedLanguage = this.value;
            localStorage.setItem('selectedLanguage', selectedLanguage);
            // Reload gestures if on dataset page
            if (gestureList) {
                loadGestures();
            }
            // Reload voices to auto-select matching voice
            loadVoices();
        });
    }
    
    // Initialize filter language if present
    if (filterLanguage) {
        filterLanguage.value = selectedLanguage;
        
        filterLanguage.addEventListener('change', function() {
            selectedLanguage = this.value;
            localStorage.setItem('selectedLanguage', selectedLanguage);
            loadGestures();
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
                cameraSelect.innerHTML = '<option value="">Camera listing not available</option>';
                return;
            }

            // Only request permission if explicitly asked (after user clicks start)
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
                cameraSelect.innerHTML = '<option value="">No cameras found</option>';
                showStatus('No cameras detected', true);
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
                    cameraSelect.innerHTML = '<option value="">Error loading cameras</option>';
                    showStatus('Error loading cameras: ' + error.message, true);
            }
        }

    // Load cameras on page load
    if (cameraSelect) {
        loadCameras();
    }

    if (refreshCamerasBtn) {
        refreshCamerasBtn.addEventListener('click', loadCameras);
    }

    // === SIGN DETECTION WITH MEDIAPIPE ===
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const webcam = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    const detectedText = document.getElementById('detectedText');
    const signNameInput = document.getElementById('signName');
    const recordBtn = document.getElementById('recordBtn');
    const stopRecordBtn = document.getElementById('stopRecordBtn');
    const recordStatus = document.getElementById('recordStatus');
    
    let hands;
    let camera;
    let stream;
    let isRecording = false;
    let currentSignData = [];
    let trainingData = []; // Array of {label: string, landmarks: number[]}

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
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5
        });

        hands.onResults(onHandsResults);
    }

    function onHandsResults(results) {
        const canvasCtx = canvas.getContext('2d');
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the video frame
        canvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                // Draw hand landmarks
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
                drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 3 });
                
                // Collect data or classify
                const flatLandmarks = flattenLandmarks(landmarks);
                if (isRecording && signNameInput.value) {
                    currentSignData.push(flatLandmarks);
                    if (recordStatus) recordStatus.textContent = `Recorded ${currentSignData.length} samples...`;
                } else if (trainingData.length > 0) {
                    const predictedSign = knnClassify(flatLandmarks);
                    if (detectedText && predictedSign) {
                        detectedText.textContent = predictedSign;
                    }
                }
            }
            
            if (!isRecording && trainingData.length === 0) {
                if (detectedText) {
                    detectedText.textContent = `Hand${results.multiHandLandmarks.length > 1 ? 's' : ''} detected! Collect data to start recognition.`;
                }
            }
        } else {
            if (detectedText) {
                detectedText.textContent = 'Waiting for detection...';
            }
        }

        canvasCtx.restore();
    }
    
    // Data Collection Controls
    if (recordBtn && stopRecordBtn) {
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
                // Add recorded data to training set
                const label = signNameInput.value;
                currentSignData.forEach(landmarks => {
                    trainingData.push({ label, landmarks });
                });
                if (recordStatus) recordStatus.textContent = `Saved ${currentSignData.length} samples for "${label}"! Total training data: ${trainingData.length}`;
                
                // Save to localStorage
                localStorage.setItem('signTrainingData', JSON.stringify(trainingData));
            } else {
                if (recordStatus) recordStatus.textContent = 'No data recorded!';
            }
        });
        
        // Load saved training data on page load
        const savedData = localStorage.getItem('signTrainingData');
        if (savedData) {
            trainingData = JSON.parse(savedData);
            if (recordStatus) recordStatus.textContent = `Loaded ${trainingData.length} training samples!`;
        }
    }

    if (startBtn && stopBtn && webcam && canvas) {
        initializeHands();
        
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
                    
                    // Set canvas size to match video
                    canvas.width = webcam.videoWidth;
                    canvas.height = webcam.videoHeight;
                    
                    // Initialize camera utility
                    camera = new Camera(webcam, {
                        onFrame: async () => {
                            await hands.send({ image: webcam });
                        },
                        width: 640,
                        height: 480
                    });
                    
                    await camera.start();
                    showStatus('Detection active! Show your hands!');
                };
                
                // Reload cameras to get labels now that we have permission
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
            if (camera) {
                camera.stop();
                camera = null;
            }
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                webcam.srcObject = null;
                // Clear canvas
                const canvasCtx = canvas.getContext('2d');
                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
                if (detectedText) {
                    detectedText.textContent = 'Waiting for detection...';
                }
                showStatus('Camera disconnected');
            }
        });
    }

    const startTranslationBtn = document.getElementById('startTranslationBtn');
    const stopTranslationBtn = document.getElementById('stopTranslationBtn');
    const translationWebcam = document.getElementById('translationWebcam');
    const startSTTBtn = document.getElementById('startSTTBtn');
    const stopSTTBtn = document.getElementById('stopSTTBtn');
    const sttLanguage = document.getElementById('sttLanguage');
    
    if (startTranslationBtn && stopTranslationBtn && translationWebcam) {
        let translationStream;
        
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
                        facingMode: 'user'
                    },
                    audio: false
                });
                
                translationWebcam.srcObject = translationStream;
                showStatus('Camera connected successfully!');
                
                translationWebcam.onloadedmetadata = () => {
                    translationWebcam.play();
                    showStatus('Camera is streaming');
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
            if (translationStream) {
                translationStream.getTracks().forEach(track => track.stop());
                translationWebcam.srcObject = null;
                showStatus('Camera disconnected');
            }
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
