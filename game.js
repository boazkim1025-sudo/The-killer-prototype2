
(() => {
  "use strict";

  // =========================================
  // SUPABASE 설정
  // =========================================

  const SUPABASE_URL =
    "https://vkhfrxnwdvocgrvzpuhr.supabase.co";

  const SUPABASE_ANON_KEY =
    "sb_publishable_5bcixPexFdz1S2O1IoYsow_YjzwCq3o";

  const MAX_PLAYERS = 20;

  const $ = id => document.getElementById(id);

  let client = null;
  let channel = null;

  let myId = "";
  let myName = "";
  let roomCode = "";
  let isHost = false;
  let connected = false;

  let players = [];
  let chatMessages = [];

  let toastTimer = null;

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
    if (!window.supabase) {
      throw new Error("Supabase 라이브러리를 불러오지 못했습니다.");
    }

    client = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

    setStatus("로그인 중...");

    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();

    if (sessionError) throw sessionError;

    let user = sessionData.session?.user;

    if (!user) {
      const { data, error } =
        await client.auth.signInAnonymously();

      if (error) throw error;

      user = data.user;
    }

    if (!user) {
      throw new Error("사용자 정보를 가져오지 못했습니다.");
    }

    myId = user.id;

    setStatus("온라인 연결됨");
  }

  // =========================================
  // 데이터베이스 RPC
  // =========================================

  async function rpc(name, params) {
    const { data, error } = await client.rpc(name, params);

    if (error) {
      console.error("Supabase 오류:", error);
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
        refreshLobby().catch(console.error);
      }
    );

    channel.on(
      "broadcast",
      { event: "room_changed" },
      () => {
        refreshLobby().catch(console.error);
      }
    );

    channel.on(
      "broadcast",
      { event: "chat" },
      ({ payload }) => {
        if (payload?.sender === myId) return;

        addChat(
          payload.name,
          payload.message
        );
      }
    );

    await new Promise((resolve, reject) => {
      channel.subscribe(async status => {
        if (status === "SUBSCRIBED") {
          connected = true;

          try {
            await channel.track({
              id: myId,
              name: myName,
              joinedAt: new Date().toISOString()
            });

            resolve(true);
          } catch (error) {
            reject(error);
          }
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          reject(new Error("실시간 방 연결에 실패했습니다."));
        }
      });
    });

    await refreshLobby();
  }

  async function broadcastRoomChanged() {
    if (!channel || !connected) return;

    await channel.send({
      type: "broadcast",
      event: "room_changed",
      payload: {
        sender: myId
      }
    });
  }

  // =========================================
  // 대기실 정보 가져오기
  // =========================================

  async function refreshLobby() {
    if (!roomCode || !client) return;

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

    renderLobby();
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
      $("startGameBtn").disabled = players.length < 3;
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

    // 방 설정 표시
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
      console.error(error);
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

      for (let attempt = 0; attempt < 10; attempt++) {
        const code = randomCode();

        const result = await rpc("create_mafia_room", {
          p_code: code,
          p_name: myName
        });

        if (result.ok) {
          roomCode = code;
          created = true;
          break;
        }
      }

      if (!created) {
        throw new Error("방 코드를 만들지 못했습니다.");
      }

      await connectRoom(roomCode);

      showScreen("lobbyScreen");

      await broadcastRoomChanged();

      notify("방이 만들어졌습니다!");

    } catch (error) {
      console.error(error);
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
      console.error(error);

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

      if (channel) {
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
          payload: { sender: myId }
        });
      }
    } catch (error) {
      console.error(error);
    }

    connected = false;

    if (channel && client) {
      await client.removeChannel(channel);
    }

    channel = null;
    roomCode = "";
    players = [];
    chatMessages = [];
    isHost = false;

    renderChat();
    showScreen("homeScreen");
    setStatus("대기 중");

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

    if (!message || !connected || !channel) return;

    if (message.length > 200) {
      notify("채팅은 200글자 이하로 입력하세요.");
      return;
    }

    $("chatInput").value = "";

    addChat(myName, message);

    await channel.send({
      type: "broadcast",
      event: "chat",
      payload: {
        sender: myId,
        name: myName,
        message
      }
    });
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
    if (!isHost) return;

    notify(
      "대기실은 작동합니다. 게임 진행 및 직업 배정 기능은 다음 단계에서 연결합니다."
    );
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
  // 초기 화면
  // =========================================

  setStatus("대기 중");
  renderChat();

})();
