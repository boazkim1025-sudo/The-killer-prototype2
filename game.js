
(() => {
  "use strict";

  // =========================================
  // SUPABASE 설정
  // =========================================

const SUPABASE_URL = "https://vkhfrxnwdvocgrvzpuhr.supabase.co";

const SUPABASE_KEY = "sb_publishable_5bcixPexFdz1S2O1IoYsow_YjzwCq3o";

  const MAX_PLAYERS = 20;
  const MIN_PLAYERS = 5;

  const ROLE_INFO = {
    citizen: { name: "시민", description: "토론과 투표로 마피아를 찾아내세요." },
    doctor: { name: "의사", description: "시민 팀 소속 직업입니다." },
    reporter: { name: "기자", description: "시민 팀 소속 직업입니다." },
    police: { name: "경찰", description: "시민 팀 소속 직업입니다." },
    detective: { name: "탐정", description: "시민 팀 소속 직업입니다." },
    medium: { name: "영매", description: "시민 팀 소속 직업입니다." },
    politician: { name: "정치인", description: "시민 팀 소속 직업입니다." },
    soldier: { name: "군인", description: "시민 팀 소속 직업입니다." },
    watcher: { name: "감시자", description: "시민 팀 소속 직업입니다." },
    trapper: { name: "함정꾼", description: "시민 팀 소속 직업입니다." },
    guardian: { name: "수호자", description: "시민 팀 소속 직업입니다." },
    psychologist: { name: "심리학자", description: "시민 팀 소속 직업입니다." },
    timeTraveler: { name: "시간여행자", description: "시민 팀 소속 직업입니다." },
    boss: { name: "마피아 보스", description: "마피아 팀의 리더입니다." },
    spy: { name: "스파이", description: "마피아 팀 소속 직업입니다." },
    intimidator: { name: "협박꾼", description: "마피아 팀 소속 직업입니다." },
    disguiser: { name: "변장가", description: "마피아 팀 소속 직업입니다." },
    controller: { name: "조종자", description: "마피아 팀 소속 직업입니다." },
    doppelganger: { name: "도플갱어", description: "마피아 팀 소속 직업입니다." },
    necromancer: { name: "강령술사", description: "마피아 팀 소속 직업입니다." },
    ghostMafia: { name: "유령 마피아", description: "마피아 팀 소속 직업입니다." }
  };

  // =========================================
  // 전역 상태
  // =========================================

  const $ = id => document.getElementById(id);

  let client = null;
  let initPromise = null;
  let channel = null;

  let myId = "";
  let myName = "";
  let roomCode = "";
  let isHost = false;
  let connected = false;

  let players = [];
  let chatMessages = [];
  let currentRole = null;

  let toastTimer = null;
  let gameScreenLoading = false;
  let lobbyRefreshRunning = false;

  // =========================================
  // 기본 화면 기능
  // =========================================

  function notify(message) {
    const element = $("toast");

    if (!element) {
      alert(message);
      return;
    }

    element.textContent = message;
    element.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      element.classList.remove("show");
    }, 2600);
  }

  function setStatus(message) {
    if ($("connectionStatus")) {
      $("connectionStatus").textContent = message;
    }
  }

  function showScreen(id) {
    ["homeScreen", "lobbyScreen", "gameScreen"].forEach(screen => {
      if ($(screen)) {
        $(screen).classList.toggle("hidden", screen !== id);
      }
    });

    if ($("chatSection")) {
      $("chatSection").classList.toggle(
        "hidden",
        id === "homeScreen"
      );
    }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function validName() {
    const name = $("playerName")?.value.trim() || "";

    if (!name) {
      notify("닉네임을 입력하세요.");
      return null;
    }

    if (name.length > 12) {
      notify("닉네임은 12글자 이하로 입력하세요.");
      return null;
    }

    return name;
  }

  function randomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";

    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    return code;
  }

  // =========================================
  // SUPABASE 연결 및 익명 로그인
  // =========================================

  async function initialize() {
    if (client && myId) {
      return;
    }

    if (initPromise) {
      return initPromise;
    }

    initPromise = (async () => {
      if (!window.supabase) {
        throw new Error(
          "Supabase 라이브러리를 불러오지 못했습니다. 인터넷 연결과 index.html을 확인하세요."
        );
      }

      if (!client) {
       client = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
      }

      setStatus("Supabase 로그인 중...");

      const {
        data: sessionData,
        error: sessionError
      } = await client.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      let user = sessionData.session?.user;

      if (!user) {
        const {
          data,
          error
        } = await client.auth.signInAnonymously();

        if (error) {
          throw error;
        }

        user = data.user;
      }

      if (!user) {
        throw new Error("사용자 정보를 가져오지 못했습니다.");
      }

      myId = user.id;

      setStatus("Supabase 연결됨");
    })();

    try {
      await initPromise;
    } catch (error) {
      initPromise = null;
      client = null;
      myId = "";
      setStatus("Supabase 연결 실패");
      throw error;
    }
  }

  // =========================================
  // 데이터베이스 RPC
  // =========================================

  async function rpc(name, params) {
    if (!client) {
      throw new Error("Supabase에 먼저 연결해야 합니다.");
    }

    const {
      data,
      error
    } = await client.rpc(name, params);

    if (error) {
      console.error("Supabase RPC 오류:", name, error);
      throw error;
    }

    if (data?.ok === false) {
      throw new Error(data.error || "요청을 처리하지 못했습니다.");
    }

    return data;
  }

  // =========================================
  // 실시간 방 연결
  // =========================================

  async function connectRoom(code) {
    roomCode = code;

    if (channel && client) {
      await client.removeChannel(channel);
      channel = null;
    }

    connected = false;

    channel = client.channel("mafia-room-" + code, {
      config: {
        presence: {
          key: myId
        },
        broadcast: {
          self: false
        }
      }
    });

    channel.on(
      "presence",
      { event: "sync" },
      () => {
        refreshLobby().catch(error => {
          console.error("참가자 목록 갱신 오류:", error);
        });
      }
    );

    channel.on(
      "broadcast",
      { event: "room_changed" },
      () => {
        refreshLobby().catch(error => {
          console.error("방 정보 갱신 오류:", error);
        });
      }
    );

    channel.on(
      "broadcast",
      { event: "chat" },
      ({ payload }) => {
        if (!payload || payload.sender === myId) return;

        addChat(payload.name, payload.message);
      }
    );

    await new Promise((resolve, reject) => {
      let finished = false;

      const timeout = setTimeout(() => {
        if (!finished) {
          finished = true;
          reject(new Error("실시간 방 연결 시간이 초과되었습니다."));
        }
      }, 15000);

      channel.subscribe(async status => {
        if (status === "SUBSCRIBED" && !finished) {
          try {
            connected = true;

            await channel.track({
              id: myId,
              name: myName,
              joinedAt: new Date().toISOString()
            });

            finished = true;
            clearTimeout(timeout);
            setStatus("온라인 연결됨");
            resolve(true);
          } catch (error) {
            finished = true;
            clearTimeout(timeout);
            reject(error);
          }
        }

        if (
          (status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT") &&
          !finished
        ) {
          finished = true;
          clearTimeout(timeout);
          reject(new Error("실시간 방 연결에 실패했습니다."));
        }
      });
    });

    await refreshLobby();
  }

  async function broadcastRoomChanged() {
    if (!channel || !connected) return;

    const result = await channel.send({
      type: "broadcast",
      event: "room_changed",
      payload: {
        sender: myId
      }
    });

    if (result === "error") {
      console.error("방 변경 알림 전송에 실패했습니다.");
    }
  }

  // =========================================
  // 대기실 정보 가져오기
  // =========================================

  async function refreshLobby() {
    if (!roomCode || !client || lobbyRefreshRunning) return;

    lobbyRefreshRunning = true;

    try {
      const data = await rpc("get_mafia_lobby", {
        p_code: roomCode
      });

      players = data.players || [];

      const me = players.find(player => player.id === myId);

      if (!me) {
        notify("방에서 나갔습니다.");
        await closeRoom(false);
        return;
      }

      isHost = !!me.host;

      if (data.status === "playing") {
        await showGameScreen();
        return;
      }

      renderLobby();
    } finally {
      lobbyRefreshRunning = false;
    }
  }

  // =========================================
  // 게임 화면
  // =========================================

  async function showGameScreen() {
    if (!roomCode || gameScreenLoading) return;

    gameScreenLoading = true;

    try {
      const data = await rpc("get_my_mafia_role", {
        p_code: roomCode
      });

      currentRole = data;

      const info = ROLE_INFO[data.role_id] || {
        name: data.role_id || "알 수 없는 직업",
        description: "직업 정보를 확인할 수 없습니다."
      };

      $("roundLabel").textContent = `제 ${data.round}일차`;

      $("phaseLabel").textContent =
        data.phase === "night" ? "밤" : data.phase;

      $("gameTitle").textContent = "게임이 시작되었습니다";
      $("gameMessage").textContent = "당신의 직업을 확인하세요.";

      $("myRole").textContent = info.name;

      $("myRoleDescription").textContent =
        `팀: ${data.team === "mafia" ? "마피아" : "시민"} · ${info.description}`;

      $("aliveCount").textContent =
        `${players.length}명`;

      if ($("gamePlayerList")) {
        $("gamePlayerList").innerHTML = players.map((player, index) => `
          <div class="player-item">
            <span>${index + 1}. ${escapeHTML(player.name)}</span>
          </div>
        `).join("");
      }

      if ($("actionArea")) {
        $("actionArea").innerHTML =
          '<p class="notice">직업별 능력과 낮·밤 진행은 다음 단계에서 연결됩니다.</p>';
      }

      if ($("hostGameControls")) {
        $("hostGameControls").classList.add("hidden");
      }

      showScreen("gameScreen");
      setStatus("게임 진행 중");
    } catch (error) {
      console.error("직업 정보 오류:", error);
      notify(error.message || "직업 정보를 불러오지 못했습니다.");
    } finally {
      gameScreenLoading = false;
    }
  }

  // =========================================
  // 대기실 화면
  // =========================================

  function renderLobby() {
    if (!roomCode) return;

    $("roomCodeDisplay").textContent = roomCode;

    $("playerCount").textContent =
      `${players.length} / ${MAX_PLAYERS}`;

    $("hostBadge")?.classList.toggle("hidden", !isHost);
    $("hostSettings")?.classList.toggle("hidden", !isHost);
    $("guestNotice")?.classList.toggle("hidden", isHost);

    $("startGameBtn")?.classList.toggle("hidden", !isHost);

    if ($("startGameBtn")) {
      $("startGameBtn").disabled =
        players.length < MIN_PLAYERS;
    }

    if ($("playerList")) {
      $("playerList").innerHTML = players.map((player, index) => `
        <div class="player-item">
          <div class="player-avatar">${index + 1}</div>
          <span class="player-name">
            ${escapeHTML(player.name)}
          </span>
          <span class="player-tag">
            ${player.host ? "방장" : "참가자"}
          </span>
        </div>
      `).join("");

      if (players.length === 0) {
        $("playerList").innerHTML =
          '<p class="notice">참가자를 기다리는 중입니다.</p>';
      }
    }

    if (isHost) {
      loadSettings();
    }
  }

  async function loadSettings() {
    try {
      const data = await rpc("get_mafia_lobby", {
        p_code: roomCode
      });

      if ($("mafiaCount")) {
        $("mafiaCount").value =
          data.settings?.mafiaCount ?? 2;
      }

      if ($("discussionTime")) {
        $("discussionTime").value =
          data.settings?.discussionTime ?? 3;
      }
    } catch (error) {
      console.error("설정 불러오기 오류:", error);
    }
  }

  // =========================================
  // 방 만들기
  // =========================================

  async function createRoom() {
    const name = validName();
    if (!name) return;

    try {
      await initialize();

      myName = name;
      isHost = true;

      setStatus("방 생성 중...");

      let created = false;
      let lastError = null;

      for (let attempt = 0; attempt < 10; attempt++) {
        const code = randomCode();

        try {
          const result = await rpc("create_mafia_room", {
            p_code: code,
            p_name: myName
          });

          if (result?.ok) {
            roomCode = code;
            created = true;
            break;
          }

          if (result?.error === "CODE_EXISTS") {
            continue;
          }

          throw new Error(result?.error || "방 생성에 실패했습니다.");
        } catch (error) {
          lastError = error;

          if (error.message === "CODE_EXISTS") {
            continue;
          }

          throw error;
        }
      }

      if (!created) {
        throw lastError || new Error("방 코드를 만들지 못했습니다.");
      }

      await connectRoom(roomCode);

      showScreen("lobbyScreen");

      await broadcastRoomChanged();

      notify("방이 만들어졌습니다!");
    } catch (error) {
      console.error("방 생성 오류:", error);
      notify(error.message || "방 생성에 실패했습니다.");
      setStatus("연결 실패");
    }
  }

  // =========================================
  // 방 참가하기
  // =========================================

  async function joinRoom() {
    const name = validName();
    if (!name) return;

    const code =
      $("roomCodeInput")?.value.trim().toUpperCase() || "";

    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
      notify("올바른 6자리 방 코드를 입력하세요.");
      return;
    }

    try {
      await initialize();

      myName = name;
      isHost = false;

      setStatus("방 참가 중...");

      await rpc("join_mafia_room", {
        p_code: code,
        p_name: myName
      });

      await connectRoom(code);

      showScreen("lobbyScreen");

      await broadcastRoomChanged();

      notify("방에 참가했습니다!");
    } catch (error) {
      console.error("방 참가 오류:", error);

      const messages = {
        ROOM_NOT_FOUND: "존재하지 않는 방입니다.",
        ROOM_FULL: "방이 가득 찼습니다.",
        GAME_ALREADY_STARTED: "이미 게임이 시작된 방입니다.",
        CODE_EXISTS: "방 코드가 중복되었습니다."
      };

      notify(
        messages[error.message] ||
        error.message ||
        "방 참가에 실패했습니다."
      );

      setStatus("연결 실패");

      if (channel && client) {
        await client.removeChannel(channel);
        channel = null;
      }

      connected = false;
      roomCode = "";
    }
  }

  // =========================================
  // 방 설정 변경
  // =========================================

  async function saveSettings() {
    if (!isHost || !roomCode) return;

    const mafiaCount = Number($("mafiaCount").value);
    const discussionTime = Number($("discussionTime").value);

    try {
      await rpc("update_mafia_settings", {
        p_code: roomCode,
        p_settings: {
          mafiaCount,
          discussionTime
        }
      });

      await broadcastRoomChanged();

      notify("게임 설정을 저장했습니다.");
    } catch (error) {
      console.error("설정 저장 오류:", error);
      notify(error.message || "설정 저장에 실패했습니다.");
    }
  }

  // =========================================
  // 방 나가기
  // =========================================

  async function closeRoom(callServer = true) {
    const oldCode = roomCode;

    try {
      if (callServer && client && oldCode) {
        await rpc("leave_mafia_room", {
          p_code: oldCode
        });
      }

      if (channel && connected) {
        await channel.send({
          type: "broadcast",
          event: "room_changed",
          payload: {
            sender: myId
          }
        });
      }
    } catch (error) {
      console.error("방 나가기 오류:", error);
    }

    connected = false;

    if (channel && client) {
      await client.removeChannel(channel);
    }

    channel = null;
    roomCode = "";
    players = [];
    chatMessages = [];
    currentRole = null;
    isHost = false;
    gameScreenLoading = false;

    renderChat();
    showScreen("homeScreen");
    setStatus(client && myId ? "Supabase 연결됨" : "연결 확인 전");

    if (callServer) {
      notify("방에서 나왔습니다.");
    }
  }

  // =========================================
  // 채팅
  // =========================================

  function addChat(name, message, system = false) {
    chatMessages.push({
      name,
      message,
      system
    });

    chatMessages = chatMessages.slice(-100);

    renderChat();
  }

  function renderChat() {
    if (!$("chatMessages")) return;

    $("chatHeading").textContent = "전체 채팅";
    $("chatMode").textContent = "전체 공개";

    $("chatMessages").innerHTML = chatMessages.map(item => `
      <div class="chat-line">
        ${
          item.system
            ? `<span class="system">${escapeHTML(item.message)}</span>`
            : `<strong>${escapeHTML(item.name)}</strong>
               ${escapeHTML(item.message)}`
        }
      </div>
    `).join("");

    $("chatMessages").scrollTop =
      $("chatMessages").scrollHeight;
  }

  async function sendChat(event) {
    event.preventDefault();

    const message = $("chatInput")?.value.trim();

    if (!message || !connected || !channel) {
      notify("채팅 서버에 연결되어 있지 않습니다.");
      return;
    }

    if (message.length > 200) {
      notify("채팅은 200글자 이하로 입력하세요.");
      return;
    }

    $("chatInput").value = "";

    addChat(myName, message);

    const result = await channel.send({
      type: "broadcast",
      event: "chat",
      payload: {
        sender: myId,
        name: myName,
        message
      }
    });

    if (result === "error") {
      notify("메시지를 전송하지 못했습니다.");
    }
  }

  // =========================================
  // 방 코드 복사
  // =========================================

  async function copyRoomCode() {
    if (!roomCode) return;

    try {
      await navigator.clipboard.writeText(roomCode);
      notify("방 코드를 복사했습니다.");
    } catch {
      notify("방 코드: " + roomCode);
    }
  }

  // =========================================
  // 게임 시작
  // =========================================

  async function startGame() {
    if (!isHost || !roomCode) return;

    if (players.length < MIN_PLAYERS) {
      notify(`게임 시작에는 최소 ${MIN_PLAYERS}명이 필요합니다.`);
      return;
    }

    try {
      $("startGameBtn").disabled = true;

      await rpc("start_mafia_game", {
        p_code: roomCode
      });

      await broadcastRoomChanged();
      await showGameScreen();

      notify("게임이 시작되었습니다!");
    } catch (error) {
      console.error("게임 시작 오류:", error);

      notify(error.message || "게임을 시작하지 못했습니다.");

      if ($("startGameBtn")) {
        $("startGameBtn").disabled =
          players.length < MIN_PLAYERS;
      }
    }
  }

  // =========================================
  // 버튼 연결
  // =========================================

  $("createRoomBtn")?.addEventListener(
    "click",
    createRoom
  );

  $("joinRoomBtn")?.addEventListener(
    "click",
    joinRoom
  );

  $("copyCodeBtn")?.addEventListener(
    "click",
    copyRoomCode
  );

  $("startGameBtn")?.addEventListener(
    "click",
    startGame
  );

  $("leaveRoomBtn")?.addEventListener(
    "click",
    () => closeRoom(true)
  );

  $("chatForm")?.addEventListener(
    "submit",
    sendChat
  );

  $("mafiaCount")?.addEventListener(
    "change",
    saveSettings
  );

  $("discussionTime")?.addEventListener(
    "change",
    saveSettings
  );

  // =========================================
  // 초기 화면 및 Supabase 연결 확인
  // =========================================

  setStatus("Supabase 연결 확인 중...");
  renderChat();

  initialize()
    .then(() => {
      setStatus("Supabase 연결됨");
      console.log("Supabase 로그인 연결 성공");
    })
    .catch(error => {
      console.error("Supabase 초기 연결 실패:", error);
      setStatus("Supabase 연결 실패");
    });

})();
