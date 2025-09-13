// Firebase SDK import
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, push, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase 설정: 사용자의 프로젝트 정보를 붙여넣습니다.
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

// --------------------------------------------------
// 전역 상태 및 변수 선언
let db, auth;
let userId;
let userName;
let isSaving = false;
let lastSaveTime = 0;
const SAVE_INTERVAL = 60000;
let lastSpeed = 0;

let currentState = {
    level: 1,
    lifeForce: 0,
    ghgReduced: 0,
};

const rewardsList = [
    { id: 'mission_3_clear', description: '미션 3개 클리어', completed: false },
    { id: 'mission_5_clear', description: '미션 5개 클리어', completed: false },
    { id: 'bike_10km', description: '자전거로 10km 이동', completed: false },
    { id: 'walk_1km', description: '도보로 1km 이동', completed: false },
    { id: 'no_plastic_day', description: '플라스틱 사용하지 않는 날', completed: false },
    { id: 'bring_tumbler', description: '개인 컵 사용하기', completed: false },
];

const levelThresholds = {
    2: 100, 3: 300, 4: 700, 5: 1500, 6: 3100, 7: 6300, 8: 12700,
    9: 25500, 10: 51100, 11: 102300, 12: 204700, 13: 409500,
    14: 819100, 15: 1638300, 16: 3276700, 17: 6553500, 18: 13107100,
    19: 26214300, 20: 52428700, 21: 104857500, 22: 209715100,
    23: 419430300, 24: 838860700, 25: 1677721500, 26: 3355443100,
    27: 6710886300, 28: 13421772700, 29: 26843545500, 30: 53687091100,
};

// --------------------------------------------------
// UI 요소 가져오기 (DOM)
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

const missionIconWrapper = document.getElementById("mission-icon-wrapper");
const missionModalOverlay = document.getElementById("mission-modal-overlay");
const missionCloseBtn = document.getElementById("mission-close-btn");
const missionListEl = document.getElementById("mission-list");

const rewardsIconWrapper = document.getElementById("rewards-icon-wrapper");
const rewardsModalOverlay = document.getElementById("rewards-modal-overlay");
const rewardsCloseBtn = document.getElementById("rewards-close-btn");
const rewardListContainer = document.getElementById('reward-list-container');
const rewardsCountEl = document.getElementById('rewards-count');

// --------------------------------------------------
// 함수 정의
function openModal(modalId) {
    const allModals = document.querySelectorAll('.modal-overlay, #mission-modal-overlay, #rewards-modal-overlay');
    allModals.forEach(modal => {
        modal.classList.add('hidden');
    });
    const targetModal = document.getElementById(modalId);
    if (targetModal) {
        targetModal.classList.remove('hidden');
    }
}

function logAction(message) {
    const logList = document.getElementById('log-list');
    if (logList) {
        const logItem = document.createElement('li');
        logItem.textContent = message;
        logList.prepend(logItem);
    } else {
        console.error('HTML에 id="log-list" 요소가 없습니다.');
    }
}

function showModal(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalOverlay.style.display = 'flex';
}

function startSensorsAndGame() {
    let speed = 0;
    let accMagnitude = 0;
    
    transportDisplayEl.textContent = "감지 시작...";

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (pos) => {
                speed = pos.coords.speed || 0;
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

function updateGame(transportType) {
    let lifeForceChange = 0;
    let ghgChange = 0;
    let logMessage = '';

    switch (transportType) {
        case "도보":
            lifeForceChange = 10;
            ghgChange = 50;
            logMessage = `🚶‍♂️ 걸어서 탄소 감축! (+${lifeForceChange} 생명력)`;
            break;
        case "자전거":
            lifeForceChange = 7;
            ghgChange = 30;
            logMessage = `🚲 자전거로 환경 보호! (+${lifeForceChange} 생명력)`;
            break;
        case "차량":
            lifeForceChange = -10;
            ghgChange = 50;
            logMessage = `🚗 차량을 이용해 오름이 시들... (${lifeForceChange} 생명력)`;
            break;
        default:
            return;
    }

    currentState.lifeForce += lifeForceChange;
    currentState.ghgReduced += ghgChange;
    
    logAction(logMessage);
    checkLevelUp();
    updateDisplay();
    checkRewardsStatus();
}

async function updateGameAndTransport(speed, accMagnitude) {
    if (!userId) {
        transportDisplayEl.textContent = "로그인 대기 중...";
        return;
    }

    let transport = "탐지 중...";
    const speed_kph = speed * 3.6;

    if (speed_kph >= 30) {
        transport = "차량";
    } else if (speed_kph >= 10) {
        transport = "자전거";
    } else if (speed_kph >= 1) {
        transport = "도보";
    } else {
        transport = "정지 상태";
    }

    transportDisplayEl.textContent = transport;

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
                timestamp: new Date().toISOString()
            };
            
            const userPath = `artifacts/${firebaseConfig.appId}/users-by-name/${userName}`;
            
            await set(ref(db, `${userPath}/game_state`), {
                level: currentState.level,
                lifeForce: currentState.lifeForce,
                ghgReduced: currentState.ghgReduced,
            });
            
            await push(ref(db, `${userPath}/transport_data`), data);
            
            console.log("데이터 저장 성공:", data);
            dbStatusEl.textContent = "데이터 저장 완료!";
            updateGame(transport);
            lastSaveTime = currentTime;
        } catch (e) {
            console.error("Realtime Database에 문서 추가 중 오류 발생: ", e);
            dbStatusEl.textContent = "데이터 저장 오류";
        } finally {
            isSaving = false;
        }
    }
    lastSpeed = speed;
}

function checkLevelUp() {
    const nextLevel = currentState.level + 1;
    if (levelThresholds[nextLevel] && currentState.lifeForce >= levelThresholds[nextLevel]) {
        currentState.level = nextLevel;
        const levelUpLog = document.createElement('p');
        levelUpLog.textContent = `🎉 축하합니다! 오름이 Level ${currentState.level}(으)로 성장했습니다!`;
        levelUpLog.style.fontWeight = 'bold';
        levelUpLog.style.color = '#2c5b2c';
        logContainer.prepend(levelUpLog);
    }
}

function updateDisplay() {
    levelValue.textContent = currentState.level;
    lifeForceValue.textContent = currentState.lifeForce;
    ghgReducedValue.textContent = `${currentState.ghgReduced}g`;
    
    panelLevelValue.textContent = currentState.level;
    panelGhgReducedValue.textContent = `${currentState.ghgReduced}g`;

    oreumElement.className = 'oreum';
    oreumElement.classList.add(`level-${currentState.level}`);
}

function renderRewards() {
    rewardListContainer.innerHTML = '';
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

function checkRewardsStatus() {
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
    renderRewards();
}

async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Google 로그인 오류:", error);
        showModal("로그인 오류", `Google 로그인에 실패했습니다: ${error.message}`);
    }
}

function openSidePanel() {
    sidePanelOverlay.classList.add('active');
    sidePanel.classList.add('active');
}

function closeSidePanel() {
    sidePanelOverlay.classList.remove('active');
    sidePanel.classList.remove('active');
}

// --------------------------------------------------
// 이벤트 리스너: DOM이 로드된 후 실행됩니다.

document.addEventListener('DOMContentLoaded', () => {
    // Firebase 초기화 함수 호출
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);

    // onAuthStateChanged 리스너 설정: 로그인/로그아웃 상태 변화 감지
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("User is signed in:", user);
            userId = user.uid;
            userName = user.displayName || `user-${user.uid.substring(0, 8)}`;
            
            userInfoDisplayEl.textContent = `환영합니다, ${userName}님!`;
            dbStatusEl.textContent = "Realtime Database 연결 완료!";
            panelUserInfo.textContent = `${userName}님, 환영합니다!`;
            
            loggedOutView.classList.add('hidden');
            loggedInView.classList.remove('hidden');

            loadGameStateFromDB(userId, userName);
        } else {
            console.log("User is signed out.");
            userId = null;
            userName = null;
            
            userInfoDisplayEl.textContent = "로그인하고 오름을 키워보세요!";
            dbStatusEl.textContent = "로그인 대기 중...";
            
            loggedInView.classList.add('hidden');
            loggedOutView.classList.remove('hidden');
            
            currentState = { level: 1, lifeForce: 0, ghgReduced: 0 };
            updateDisplay();
        }
    });

    // 모든 UI 이벤트 리스너
    profileIconWrapper.addEventListener('click', openSidePanel);
    sidePanelCloseBtn.addEventListener('click', closeSidePanel);
    sidePanelOverlay.addEventListener('click', (e) => {
        if (e.target === sidePanelOverlay) {
            closeSidePanel();
        }
    });
    
    missionIconWrapper.addEventListener('click', () => {
        openModal('mission-modal-overlay');
    });
    missionCloseBtn.addEventListener('click', () => openModal(''));
    missionModalOverlay.addEventListener('click', (e) => {
        if (e.target === missionModalOverlay) {
            openModal('');
        }
    });
    
    // 보상 탭 이벤트 리스너
    rewardsIconWrapper.addEventListener('click', () => {
        renderRewards(); // 보상 모달이 열릴 때 보상 목록을 다시 렌더링
        openModal('rewards-modal-overlay'); // 모달을 보이게 함
    });
    rewardsCloseBtn.addEventListener('click', () => openModal(''));
    rewardsModalOverlay.addEventListener('click', (e) => {
        if (e.target === rewardsModalOverlay) {
            openModal('');
        }
    });
    
    modalCloseBtn.addEventListener('click', () => {
        modalOverlay.style.display = 'none';
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
});

// Firebase에서 게임 상태를 불러오는 함수
async function loadGameStateFromDB(currentUserId, currentUserName) {
    dbStatusEl.textContent = "데이터 불러오는 중...";
    const userPath = `artifacts/${firebaseConfig.appId}/users-by-name/${currentUserName}`;
    const stateRef = ref(db, `${userPath}/game_state`);

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
        } else {
            console.log("저장된 데이터가 없습니다. 새로운 게임을 시작합니다.");
            dbStatusEl.textContent = "새 게임 시작!";
            logAction("새 게임을 시작합니다.");
        }
        startSensorsAndGame();
    }, (error) => {
        console.error("데이터 불러오기 오류:", error);
        dbStatusEl.textContent = "데이터 불러오기 오류";
        showModal("오류", `데이터를 불러오지 못했습니다: ${error.message}`);
        startSensorsAndGame();
    });
}
