    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
        import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
        // Realtime Database를 사용하도록 변경
        import { getDatabase, ref, push, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
        
        // Firebase 설정: 이 부분에 사용자의 프로젝트 정보를 붙여넣어야 합니다.
        // Firebase 콘솔의 프로젝트 설정에서 "앱" 섹션에 있는 "SDK 설정 및 구성"의 내용을 복사하여 붙여넣으세요.
        const firebaseConfig = {
            apiKey: "AIzaSyBwr1j5-SokeoEdaBL0uGejzZLLYW4IHLg",
            authDomain: "eco-vision-db.firebaseapp.com",
            databaseURL: "https://eco-vision-db-default-rtdb.firebaseio.com",
            projectId: "eco-vision-db",
            storageBucket: "eco-vision-db.firebasestorage.app",
            messagingSenderId: "340035289683",
            appId: "1:340035289683:web:dd65ba6bab22e91029fca6",
            measurementId: "G-8ZN69L0H1C"
        };
        
        // 전역 상태 변수
        let db, auth;
        let userId;
        let userName; // 사용자 이름을 저장할 변수
        let isSaving = false;
        let lastSaveTime = 0;
        const SAVE_INTERVAL = 60000; // 1분 (60000ms)마다 데이터 저장
        let lastSpeed = 0; // 이전에 감지된 속도를 저장하는 변수 (m/s)
        
        // 현재 오름 상태 변수 (로그아웃 시 초기화됨)
        let currentState = {
            level: 1,
            lifeForce: 0,
            ghgReduced: 0, // 그램(g) 단위
        };
        
        // 보상 목록 (초기 상태)
        const rewardsList = [
            { id: 'mission_3_clear', description: '미션 3개 클리어', completed: false },
            { id: 'mission_5_clear', description: '미션 5개 클리어', completed: false },
            { id: 'bike_10km', description: '자전거로 10km 이동', completed: false },
            { id: 'walk_1km', description: '도보로 1km 이동', completed: false },
            { id: 'no_plastic_day', description: '플라스틱 사용하지 않는 날', completed: false },
            { id: 'bring_tumbler', description: '개인 컵 사용하기', completed: false },
        ];
        
        // 레벨업에 필요한 생명력 정의 (최대 30레벨까지 확장)
        // 기존 패턴 (차이가 2배씩 증가)을 유지하여 계산
        const levelThresholds = {
            2: 100, 3: 300, 4: 700, 5: 1500, 6: 3100, 7: 6300, 8: 12700,
            9: 25500, 10: 51100, 11: 102300, 12: 204700, 13: 409500,
            14: 819100, 15: 1638300, 16: 3276700, 17: 6553500, 18: 13107100,
            19: 26214300, 20: 52428700, 21: 104857500, 22: 209715100,
            23: 419430300, 24: 838860700, 25: 1677721500, 26: 3355443100,
            27: 6710886300, 28: 13421772700, 29: 26843545500, 30: 53687091100,
        };

        // UI 요소 가져오기
        const profileIconWrapper = document.getElementById('profile-icon-wrapper');
        const oreumElement = document.getElementById('oreum');
        const levelValue = document.getElementById('level-value');
        const lifeForceValue = document.getElementById('life-force-value');
        const ghgReducedValue = document.getElementById('ghg-reduced-value');
        const logContainer = document.getElementById('log-container');
        const speedDisplayEl = document.getElementById("speed-display");
        const accDisplayEl = document.getElementById("acc-display");
        const dbStatusEl = document.getElementById("db-status");
        const userInfoDisplayEl = document.getElementById("user-info-display");
        const transportDisplayEl = document.getElementById("transport-display");
        const modalOverlay = document.getElementById("modal-overlay");
        const modalTitle = document.getElementById("modal-title");
        const modalMessage = document.getElementById("modal-message");
        const modalCloseBtn = document.getElementById("modal-close-btn");
        
        // 사이드 패널 관련 요소
        const sidePanelOverlay = document.getElementById("side-panel-overlay");
        const sidePanel = document.getElementById("side-panel");
        const sidePanelCloseBtn = document.getElementById("side-panel-close-btn");
        const loggedOutView = document.getElementById("logged-out-view");
        const loggedInView = document.getElementById("logged-in-view");
        const googleSignInBtn = document.getElementById("google-sign-in-btn");
        const signOutBtn = document.getElementById("sign-out-btn");
        const panelUserInfo = document.getElementById("panel-user-info");
        const panelLevelValue = document.getElementById("panel-level-value");
        const panelGhgReducedValue = document.getElementById("panel-ghg-reduced-value");

        // 미션 모달 관련 요소 추가
        const missionIconWrapper = document.getElementById("mission-icon-wrapper");
        const missionModalOverlay = document.getElementById("mission-modal-overlay");
        const missionCloseBtn = document.getElementById("mission-close-btn");
        const generateMissionBtn = document.getElementById("generate-mission-btn");
        const geminiLoadingEl = document.getElementById("gemini-loading");
        const missionListEl = document.getElementById("mission-list");
        
        // 보상 모달 관련 요소 추가
        const rewardsIconWrapper = document.getElementById("rewards-icon-wrapper");
        const rewardsModalOverlay = document.getElementById("rewards-modal-overlay");
        const rewardsCloseBtn = document.getElementById("rewards-close-btn");
        const rewardListContainer = document.getElementById('reward-list-container');
        const rewardsCountEl = document.getElementById('rewards-count');

        // Firebase 및 Realtime Database 초기화
        async function initializeFirebase() {
            try {
                const app = initializeApp(firebaseConfig);
                auth = getAuth(app);
                // Realtime Database로 변경
                db = getDatabase(app);

                // onAuthStateChanged 리스너 설정: 로그인/로그아웃 상태 변화를 감지
                onAuthStateChanged(auth, (user) => {
                    if (user) {
                        // 사용자 로그인 상태
                        console.log("User is signed in:", user);
                        userId = user.uid;
                        userName = user.displayName || `user-${user.uid.substring(0, 8)}`; // 사용자 이름이 없으면 UID를 사용
                        
                        // UI 업데이트
                        userInfoDisplayEl.textContent = `환영합니다, ${userName}님!`;
                        dbStatusEl.textContent = "Realtime Database 연결 완료!";
                        panelUserInfo.textContent = `${userName}님, 환영합니다!`;
                        
                        loggedOutView.classList.add('hidden');
                        loggedInView.classList.remove('hidden');

                        // 로그인 시 데이터 불러오기
                        loadGameStateFromDB(userId, userName);
                        
                    } else {
                        // 사용자 로그아웃 상태
                        console.log("User is signed out.");
                        userId = null;
                        userName = null;

                        // UI 업데이트
                        userInfoDisplayEl.textContent = "로그인하고 오름을 키워보세요!";
                        dbStatusEl.textContent = "로그인 대기 중...";
                        
                        loggedInView.classList.add('hidden');
                        loggedOutView.classList.remove('hidden');
                        
                        // 상태 초기화
                        currentState = { level: 1, lifeForce: 0, ghgReduced: 0 };
                        updateDisplay();
                    }
                });

            } catch (error) {
                console.error("Firebase 초기화 오류:", error);
                showModal("오류", `Firebase 연결 실패: ${error.message}`);
                dbStatusEl.textContent = "Firebase 연결 실패";
            }
        }

        // Realtime Database에서 게임 상태를 불러오는 함수
        async function loadGameStateFromDB(currentUserId, currentUserName) {
            dbStatusEl.textContent = "데이터 불러오는 중...";
            
            const userPath = `artifacts/${firebaseConfig.appId}/users-by-name/${currentUserName}`;
            
            const stateRef = ref(db, `${userPath}/game_state`);
            
            // onValue를 사용하여 실시간으로 데이터 변경을 감지
            onValue(stateRef, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    currentState = {
                        level: data.level || 1,
                        lifeForce: data.lifeForce || 0,
                        ghgReduced: data.ghgReduced || 0,
                    };
                    updateDisplay();
                    dbStatusEl.textContent = "게임 상태 불러오기 성공!";
                    logAction("저장된 게임 상태를 불러왔습니다.");
                    startSensorsAndGame(); // 게임 상태를 불러온 후 센서 시작
                } else {
                    console.log("저장된 데이터가 없습니다. 새로운 게임을 시작합니다.");
                    dbStatusEl.textContent = "새 게임 시작!";
                    logAction("새 게임을 시작합니다.");
                    startSensorsAndGame(); // 저장된 데이터가 없으면 즉시 센서 시작
                }
            }, (error) => {
                console.error("데이터 불러오기 오류:", error);
                dbStatusEl.textContent = "데이터 불러오기 오류";
                showModal("오류", `데이터를 불러오지 못했습니다: ${error.message}`);
                startSensorsAndGame(); // 오류가 발생해도 센서 시작
            });
        }
        
        function showModal(title, message) {
            modalTitle.textContent = title;
            modalMessage.textContent = message;
            modalOverlay.style.display = 'flex';
        }

        modalCloseBtn.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
        });

        function startSensorsAndGame() {
            let speed = 0;
            let accMagnitude = 0;
            
            transportDisplayEl.textContent = "감지 시작...";

            // GPS 속도 감지
            if (navigator.geolocation) {
                navigator.geolocation.watchPosition(
                    (pos) => {
                        speed = pos.coords.speed || 0; // m/s
                        speedDisplayEl.textContent = `${speed.toFixed(2)} m/s`;
                        updateGameAndTransport(speed, accMagnitude);
                    },
                    (err) => { 
                        transportDisplayEl.textContent = "GPS 오류"; 
                        console.error("Geolocation Error:", err);
                        
                        let errorMessage = "위치 정보 접근이 거부되었거나 오류가 발생했습니다.";
                        switch (err.code) {
                            case err.PERMISSION_DENIED:
                                errorMessage = "위치 정보 접근이 거부되었습니다. 브라우저 설정을 확인해주세요.";
                                break;
                            case err.POSITION_UNAVAILABLE:
                                errorMessage = "위치 정보를 사용할 수 없습니다. GPS 신호가 약한 지역일 수 있습니다.";
                                break;
                            case err.TIMEOUT:
                                errorMessage = "위치 정보 요청 시간이 초과되었습니다. 다시 시도해 주세요.";
                                break;
                        }
                        showModal("위치 정보 오류", errorMessage);
                    },
                    { enableHighAccuracy: true, maximumAge: 500, timeout: 5000 }
                );
            } else {
                transportDisplayEl.textContent = "GPS 미지원";
                showModal("오류", "이 브라우저는 위치 정보(GPS)를 지원하지 않습니다.");
            }

            // 가속도 센서 감지
            if (window.DeviceMotionEvent) {
                window.addEventListener("devicemotion", (event) => {
                    const acc = event.accelerationIncludingGravity;
                    accMagnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
                    accDisplayEl.textContent = `${accMagnitude.toFixed(2)} m/s²`;
                    updateGameAndTransport(speed, accMagnitude);
                });
            } else {
                console.warn("DeviceMotionEvent를 지원하지 않는 브라우저입니다.");
            }
        }

        // 오름 상태를 업데이트하는 핵심 로직
        function updateGame(transportType) {
            let lifeForceChange = 0;
            let ghgChange = 0;
            let logMessage = '';

            switch (transportType) {
                case "도보":
                    lifeForceChange = 10; // 요청에 따라 10으로 변경
                    ghgChange = 50; 
                    logMessage = `🚶‍♂️ 걸어서 탄소 감축! (+${lifeForceChange} 생명력)`;
                    break;
                case "자전거":
                    lifeForceChange = 7; // 요청에 따라 7로 변경
                    ghgChange = 30;
                    logMessage = `🚲 자전거로 환경 보호! (+${lifeForceChange} 생명력)`;
                    break;
                case "차량":
                    lifeForceChange = -10; // 요청에 따라 -10으로 변경
                    ghgChange = 50;
                    logMessage = `🚗 차량을 이용해 오름이 시들... (${lifeForceChange} 생명력)`;
                    break;
                default:
                    return; // 해당되지 않는 이동수단은 업데이트하지 않음
            }

            // 상태 업데이트
            currentState.lifeForce += lifeForceChange;
            currentState.ghgReduced += ghgChange;


            // 활동 로그 기록
            logAction(logMessage);

            // 레벨업 체크
            checkLevelUp();
            
            // 화면 업데이트
            updateDisplay();
            
            // 보상 완료 상태 확인 (예시)
            checkRewardsStatus();
        }

        // 이동수단 판단 및 Firebase에 저장하는 함수
        async function updateGameAndTransport(speed, accMagnitude) {
            // 사용자가 로그인하지 않았다면 데이터 저장 및 게임 업데이트를 중지
            if (!userId) {
                transportDisplayEl.textContent = "로그인 대기 중...";
                return;
            }

            let transport = "탐지 중...";
            const speed_kph = speed * 3.6; // m/s를 km/h로 변환
            
            // 이동수단 판단
            if (speed_kph >= 30) {
                transport = "차량";
            } else if (speed_kph >= 10) {
                transport = "자전거";
            } else if (speed_kph >= 1) { // 1km/h 이상일 때 도보로 판단하도록 변경
                transport = "도보";
            } else {
                transport = "정지 상태";
            }

            transportDisplayEl.textContent = transport;

            // Firebase에 데이터 저장
            const currentTime = Date.now();
            if (db && !isSaving && (currentTime - lastSaveTime > SAVE_INTERVAL)) {
                isSaving = true;
                try {
                    const data = {
                        transport: transport,
                        speed: speed,
                        acceleration: accMagnitude,
                        lifeForce: currentState.lifeForce,
                        ghgReduced: currentState.ghgReduced,
                        timestamp: new Date().toISOString() // Realtime DB는 Date 객체를 저장하지 못해 ISO 문자열로 변환
                    };
                    
                    const userPath = `artifacts/${firebaseConfig.appId}/users-by-name/${userName}`;
                    
                    // 게임 상태를 별도의 위치에 저장 (덮어쓰기)
                    await set(ref(db, `${userPath}/game_state`), {
                        level: currentState.level,
                        lifeForce: currentState.lifeForce,
                        ghgReduced: currentState.ghgReduced,
                    });
                    
                    // 이동 데이터를 별도의 컬렉션에 추가 (누적)
                    await push(ref(db, `${userPath}/transport_data`), data);
                    
                    console.log("데이터 저장 성공:", data);
                    dbStatusEl.textContent = "데이터 저장 완료!";

                    // 감지된 이동수단에 따라 게임 상태 업데이트
                    updateGame(transport);

                    lastSaveTime = currentTime;
                } catch (e) {
                    console.error("Realtime Database에 문서 추가 중 오류 발생: ", e);
                    dbStatusEl.textContent = "데이터 저장 오류";
                } finally {
                    isSaving = false;
                }
            }
            
            // 다음 감지를 위해 현재 속도를 lastSpeed에 저장
            lastSpeed = speed;
        }

        // 활동 로그를 화면에 추가하는 함수
        function logAction(text) {
            const newLog = document.createElement('p');
            newLog.textContent = text;
            logContainer.prepend(newLog); // 최신 로그가 위에 보이도록
            if (logContainer.children.length > 5) {
                logContainer.removeChild(logContainer.lastElementChild);
            }
        }

        // 레벨업 조건을 확인하고 처리하는 함수
        function checkLevelUp() {
            const nextLevel = currentState.level + 1;
            // 다음 레벨이 존재하고, 현재 생명력이 필요조건을 충족하는 경우
            if (levelThresholds[nextLevel] && currentState.lifeForce >= levelThresholds[nextLevel]) {
                currentState.level = nextLevel;
                // 레벨업 로그 기록
                const levelUpLog = document.createElement('p');
                levelUpLog.textContent = `🎉 축하합니다! 오름이 Level ${currentState.level}(으)로 성장했습니다!`;
                levelUpLog.style.fontWeight = 'bold';
                levelUpLog.style.color = '#2c5b2c';
                logContainer.prepend(levelUpLog);
            }
        }

        // 화면의 모든 정보를 현재 상태에 맞게 업데이트하는 함수
        function updateDisplay() {
            // 메인 대시보드 숫자 업데이트
            levelValue.textContent = currentState.level;
            lifeForceValue.textContent = currentState.lifeForce;
            ghgReducedValue.textContent = `${currentState.ghgReduced}g`;
            
            // 사이드 패널의 숫자 업데이트
            panelLevelValue.textContent = currentState.level;
            panelGhgReducedValue.textContent = `${currentState.ghgReduced}g`;

            // 오름의 시각적 스타일 업데이트 (CSS 클래스 변경)
            oreumElement.className = 'oreum'; // 초기화
            oreumElement.classList.add(`level-${currentState.level}`);
        }
        
        // 보상 목록을 화면에 렌더링하는 함수
        function renderRewards() {
            rewardListContainer.innerHTML = ''; // 기존 목록 초기화
            rewardsList.forEach(reward => {
                const rewardItem = document.createElement('div');
                const completedClass = reward.completed ? 'completed' : '';
                
                rewardItem.className = `reward-item ${completedClass}`;
                rewardItem.innerHTML = `
                    <div class="reward-icon-container">
                        ${reward.completed ? 
                            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' :
                            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
                        }
                    </div>
                    <p>${reward.description}</p>
                `;
                rewardListContainer.appendChild(rewardItem);
            });
            
            const completedCount = rewardsList.filter(r => r.completed).length;
            rewardsCountEl.textContent = `${rewardsList.length - completedCount}개`;
        }
        
        // 보상 완료 상태를 확인하는 함수 (예시)
        function checkRewardsStatus() {
            // 이 함수는 실제 미션 완료 로직과 연결되어야 합니다.
            // 여기서는 단순히 예시로 GHGs 감축량에 따라 보상을 완료 처리합니다.
            
            if (currentState.ghgReduced >= 150) {
                const reward = rewardsList.find(r => r.id === 'mission_3_clear');
                if (reward) reward.completed = true;
            }
            if (currentState.ghgReduced >= 250) {
                const reward = rewardsList.find(r => r.id === 'mission_5_clear');
                if (reward) reward.completed = true;
            }
            if (currentState.ghgReduced >= 100) {
                const reward = rewardsList.find(r => r.id === 'walk_1km');
                if (reward) reward.completed = true;
            }
            
            // 보상 탭이 열릴 때마다 최신 상태로 다시 렌더링
            renderRewards();
        }

        /**
         * ✨ Gemini API를 사용하여 새로운 친환경 미션을 생성합니다.
         */
        async function generateNewMission() {
            const userPrompt = "Create a single, creative, and unique eco-friendly mission. The mission must be a single sentence in Korean and related to daily life. Do not include titles or headings. Only provide the mission text.";
            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

            // 로딩 상태 시작
            generateMissionBtn.disabled = true;
            geminiLoadingEl.classList.remove('hidden');

            const payload = {
                contents: [{ parts: [{ text: userPrompt }] }],
                systemInstruction: {
                    parts: [{ text: "당신은 사람들의 환경 보호를 돕는 친절한 안내자입니다." }]
                },
            };

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const result = await response.json();
                const candidate = result.candidates?.[0];

                if (candidate && candidate.content?.parts?.[0]?.text) {
                    const missionText = candidate.content.parts[0].text.trim();
                    addNewMissionToUI(missionText);
                    logAction("✨ 새로운 미션이 생성되었습니다!");
                } else {
                    throw new Error("API 응답에 내용이 없습니다.");
                }

            } catch (error) {
                console.error("Gemini API 호출 오류:", error);
                showModal("미션 생성 오류", `새로운 미션을 만들지 못했습니다: ${error.message}`);
            } finally {
                // 로딩 상태 종료
                generateMissionBtn.disabled = false;
                geminiLoadingEl.classList.add('hidden');
            }
        }
        
        /**
         * 생성된 미션을 UI에 추가합니다.
         */
        function addNewMissionToUI(missionText) {
            const newMissionItem = document.createElement('li');
            newMissionItem.className = 'mission-item gemini-generated-item';
            newMissionItem.innerHTML = `<h3>✨ 오늘의 미션 (Gemini)</h3><p>${missionText}</p>`;
            
            // 기존 미션 목록 맨 위에 추가
            missionListEl.prepend(newMissionItem);

            // 미션이 너무 많아지면 오래된 미션 제거
            if (missionListEl.children.length > 6) {
                missionListEl.removeChild(missionListEl.lastElementChild);
            }
        }

        // Google 로그인 함수
        async function signInWithGoogle() {
            const provider = new GoogleAuthProvider();
            try {
                const result = await signInWithPopup(auth, provider);
                // 로그인 성공 후 처리 (onAuthStateChanged가 알아서 처리)
            } catch (error) {
                console.error("Google 로그인 오류:", error);
                showModal("로그인 오류", `Google 로그인에 실패했습니다: ${error.message}`);
            }
        }

        // 사이드 패널 열기
        function openSidePanel() {
            sidePanelOverlay.classList.add('active');
            sidePanel.classList.add('active');
        }

        // 사이드 패널 닫기
        function closeSidePanel() {
            sidePanelOverlay.classList.remove('active');
            sidePanel.classList.remove('active');
        }
        
        // 미션 모달 열기
        function openMissionModal() {
            missionModalOverlay.style.display = 'flex';
        }

        // 미션 모달 닫기
        function closeMissionModal() {
            missionModalOverlay.style.display = 'none';
        }
        
        // 보상 모달 열기
        function openRewardsModal() {
            rewardsModalOverlay.style.display = 'flex';
            checkRewardsStatus(); // 모달이 열릴 때마다 보상 상태 업데이트
        }

        // 보상 모달 닫기
        function closeRewardsModal() {
            rewardsModalOverlay.style.display = 'none';
        }

        // 이벤트 리스너
        profileIconWrapper.addEventListener('click', openSidePanel);
        sidePanelCloseBtn.addEventListener('click', closeSidePanel);
        sidePanelOverlay.addEventListener('click', (e) => {
            if (e.target === sidePanelOverlay) {
                closeSidePanel();
            }
        });
        
        missionIconWrapper.addEventListener('click', openMissionModal);
        missionCloseBtn.addEventListener('click', closeMissionModal);
        missionModalOverlay.addEventListener('click', (e) => {
            if (e.target === missionModalOverlay) {
                closeMissionModal();
            }
        });
        
        // 보상 버튼 클릭 이벤트 리스너 추가
        rewardsIconWrapper.addEventListener('click', openRewardsModal);
        rewardsCloseBtn.addEventListener('click', closeRewardsModal);
        rewardsModalOverlay.addEventListener('click', (e) => {
            if (e.target === rewardsModalOverlay) {
                closeRewardsModal();
            }
        });

        googleSignInBtn.addEventListener('click', signInWithGoogle);
        signOutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                showModal("로그아웃", "성공적으로 로그아웃 되었습니다.");
                closeSidePanel();
            }).catch((error) => {
                showModal("로그아웃 실패", `오류: ${error.message}`);
            });
        });

        // 초기 화면 설정
        window.addEventListener('load', initializeFirebase);
