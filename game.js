
(() => {
  "use strict";

  // Supabase 프로젝트 정보 입력
  const SUPABASE_URL = "여기에_SUPABASE_URL";
  const SUPABASE_ANON_KEY = "여기에_SUPABASE_ANON_KEY";

  const $ = id => document.getElementById(id);
  const MAX_PLAYERS = 20;

  const ROLES = {
    citizen: {
      name: "시민",
      team: "citizen",
      description: "마피아와 중립 세력을 찾아 제거하세요."
    },
    doctor: {
      name: "의사",
      team: "citizen",
      description: "밤에 한 명을 보호할 수 있습니다."
    },
    reporter: {
      name: "기자",
      team: "citizen",
      description: "게임 중 한 번 플레이어의 직업을 공개할 수 있습니다."
    },
    police: {
      name: "경찰",
      team: "citizen",
      description: "밤에 한 명의 행동을 막을 수 있습니다."
    },
    detective: {
      name: "탐정",
      team: "citizen",
      description: "밤에 한 명의 팀을 조사할 수 있습니다."
    },
    medium: {
      name: "영매",
      team: "citizen",
      description: "탈락한 플레이어에 대한 정보를 얻습니다."
    },
    politician: {
      name: "정치인",
      team: "citizen",
      description: "투표에서 특별한 영향력을 발휘합니다."
    },
    soldier: {
      name: "군인",
      team: "citizen",
      description: "특별한 생존 능력을 가진 시민입니다."
    },
    watcher: {
      name: "감시자",
      team: "citizen",
      description: "밤에 한 플레이어의 행동을 관찰합니다."
    },
    trapper: {
      name: "함정꾼",
      team: "citizen",
      description: "자신을 공격한 적에게 대응합니다."
    },
    guardian: {
      name: "수호자",
      team: "citizen",
      description: "다른 플레이어를 보호합니다."
    },
    psychologist: {
      name: "심리학자",
      team: "citizen",
      description: "플레이어의 행동에 대한 정보를 얻습니다."
    },
    timeTraveler: {
      name: "시간여행자",
      team: "citizen",
      description: "특별한 시간 능력을 가진 시민입니다."
    },
    boss: {
      name: "마피아 보스",
      team: "mafia",
      description: "마피아 팀의 우두머리입니다."
    },
    spy: {
      name: "스파이",
      team: "mafia",
      description: "마피아 팀의 정보를 수집합니다."
    },
    intimidator: {
      name: "협박범",
      team: "mafia",
      description: "상대의 행동에 영향을 줍니다."
    },
    disguiser: {
      name: "변장사",
      team: "mafia",
      description: "자신의 정체를 숨깁니다."
    },
    controller: {
      name: "조종자",
      team: "mafia",
      description: "다른 플레이어의 행동에 영향을 줍니다."
    },
    doppelganger: {
      name: "도플갱어",
      team: "mafia",
      description: "다른 사람의 정체를 흉내 냅니다."
    },
    necromancer: {
      name: "강령술사",
      team: "mafia",
      description: "특별한 능력을 가진 마피아입니다."
    },
    ghostMafia: {
      name: "유령 마피아",
      team: "mafia",
      description: "마피아 팀을 돕는 특별한 역할입니다."
    },
    clown: {
      name: "광대",
      team: "neutral",
      description: "투표로 탈락하면 승리합니다."
    },
    immortal: {
      name: "불사자",
      team: "neutral",
      description: "특별한 생존 조건을 가지고 있습니다."
    },
    mirror: {
      name: "거울",
      team: "neutral",
      description: "다른 플레이어의 능력에 영향을 받습니다."
    },
    trickster: {
      name: "사기꾼",
      team: "neutral",
      description: "혼란을 일으키는 특별한 역할입니다."
    },
    psycho: {
      name: "사이코",
      team: "neutral",
      description: "독립적인 승리 조건을 가진 역할입니다."
    }
  };

  let client = null;
  let channel = null;
  let roomCode = "";
  let myId = "";
  let myName = "";
  let isHost = false;
  let connected = false;
  let players = [];
  let game = null;
  let chatMessages = [];
  let toastTimer = null;

  function notify(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function setStatus(message) {
    $("connectionStatus").textContent = message;
  }

  function showScreen(id) {
    ["homeScreen", "lobbyScreen", "gameScreen"].forEach(screen => {
      $(screen).classList.toggle("hidden", screen !== id);
    });

    $("chatSection").classList.toggle(
      "hidden",
      id === "homeScreen"
    );
  }

  function validName() {
    const name = $("playerName").value.trim();

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
    let result = "";

    for (let i = 0; i < 6; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }

    return result;
  }

  function makeId() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now();
  }

  function getPlayer(id) {
    return players.find(player => player.id === id);
  }

  function alivePlayers() {
    return players.filter(player => player.alive);
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

  function createSupabase() {
    if (!window.supabase) {
      notify("Supabase 라이브러리를 불러오지 못했습니다.");
      return false;
    }

    if (
      SUPABASE_URL.includes("여기에_") ||
      SUPABASE_ANON_KEY.includes("여기에_")
    ) {
      notify("game.js에 Supabase 정보를 먼저 입력하세요.");
      return false;
    }

    client = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

    return true;
  }

  async function openChannel(code) {
    roomCode = code;

    channel = client.channel("mafia-room-" + code, {
      config: {
        presence: { key: myId },
        broadcast: { self: false }
      }
    });

    channel.on("presence", { event: "sync" }, () => {
      updatePresenceList();
    });

    channel.on("broadcast", { event: "message" }, ({ payload }) => {
      handleMessage(payload);
    });

    return new Promise((resolve, reject) => {
      channel.subscribe(async status => {
        if (status === "SUBSCRIBED") {
          connected = true;
          setStatus("온라인 연결됨");

          await channel.track({
            id: myId,
            name: myName,
            host: isHost,
            joinedAt: Date.now()
          });

          resolve(true);
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          connected = false;
          reject(new Error("방 연결에 실패했습니다."));
        }
      });
    });
  }

  async function sendMessage(type, data = {}) {
    if (!channel || !connected) return;

    await channel.send({
      type: "broadcast",
      event: "message",
      payload: {
        type,
        sender: myId,
        data
      }
    });
  }

  function updatePresenceList() {
    if (!channel) return;

    const state = channel.presenceState();
    const found = new Map();

    Object.values(state).flat().forEach(item => {
      if (!item.id) return;

      found.set(item.id, {
        id: item.id,
        name: item.name || "플레이어",
        host: !!item.host
      });
    });

    if (!game) {
      players = Array.from(found.values()).map(item => ({
        ...item,
        alive: true
      }));

      renderLobby();
    }
  }

  function renderLobby() {
    $("roomCodeDisplay").textContent = roomCode;
    $("playerCount").textContent =
      `${players.length} / ${MAX_PLAYERS}`;

    $("hostBadge").classList.toggle("hidden", !isHost);
    $("hostSettings").classList.toggle("hidden", !isHost);
    $("guestNotice").classList.toggle("hidden", isHost);

    $("startGameBtn").classList.toggle("hidden", !isHost);
    $("startGameBtn").disabled = players.length < 3;

    $("playerList").innerHTML = players.map((player, index) => `
      <div class="player-item">
        <div class="player-avatar">${index + 1}</div>
        <span class="player-name">${escapeHTML(player.name)}</span>
        <span class="player-tag">${player.host ? "방장" : "참가자"}</span>
      </div>
    `).join("");

    if (!players.length) {
      $("playerList").innerHTML =
        '<p class="notice">참가자를 기다리는 중입니다.</p>';
    }
  }

  async function createRoom() {
    if (!createSupabase()) return;

    const name = validName();
    if (!name) return;

    myId = makeId();
    myName = name;
    isHost = true;

    setStatus("방 생성 중...");

    let success = false;

    for (let i = 0; i < 5; i++) {
      const code = randomCode();

      try {
        await openChannel(code);
        success = true;
        break;
      } catch (error) {
        if (channel) {
          await client.removeChannel(channel);
          channel = null;
        }
      }
    }

    if (!success) {
      notify("방을 만들지 못했습니다. 다시 시도하세요.");
      setStatus("연결 실패");
      return;
    }

    players = [{
      id: myId,
      name: myName,
      host: true,
      alive: true
    }];

    showScreen("lobbyScreen");
    renderLobby();
    notify("방이 만들어졌습니다.");
  }

  async function joinRoom() {
    if (!createSupabase()) return;

    const name = validName();
    if (!name) return;

    const code = $("roomCodeInput").value.trim().toUpperCase();

    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
      notify("올바른 6자리 방 코드를 입력하세요.");
      return;
    }

    myId = makeId();
    myName = name;
    isHost = false;

    setStatus("방 참가 중...");

    try {
      await openChannel(code);

      await new Promise(resolve => setTimeout(resolve, 500));

      updatePresenceList();

      if (!players.length) {
        await closeRoom();
        notify("해당 방을 찾을 수 없습니다.");
        return;
      }

      if (players.length >= MAX_PLAYERS) {
        await closeRoom();
        notify("방이 가득 찼습니다.");
        return;
      }

      showScreen("lobbyScreen");
      renderLobby();
      notify("방에 참가했습니다.");
    } catch (error) {
      console.error(error);
      notify("방에 연결할 수 없습니다.");
      setStatus("연결 실패");
    }
  }

  async function closeRoom() {
    connected = false;

    if (channel && client) {
      await client.removeChannel(channel);
    }

    channel = null;
    roomCode = "";
    players = [];
    game = null;
    chatMessages = [];
    isHost = false;

    showScreen("homeScreen");
    setStatus("대기 중");
  }

  async function startGame() {
    if (!isHost || !connected) return;

    updatePresenceList();

    if (players.length < 3) {
      notify("최소 3명이 필요합니다.");
      return;
    }

    const mafiaCount = Number($("mafiaCount").value);

    if (mafiaCount >= players.length) {
      notify("마피아 수가 너무 많습니다.");
      return;
    }

    const shuffled = [...players].sort(() => Math.random() - 0.5);

    const roleIds = Object.keys(ROLES);
    const mafiaRoles = roleIds.filter(id => ROLES[id].team === "mafia");

    const citizenRoles = [
      "doctor", "reporter", "police", "detective",
      "medium", "politician", "soldier", "watcher",
      "trapper", "guardian", "psychologist", "timeTraveler"
    ];

    const neutralRoles = [
      "clown", "immortal", "mirror", "trickster", "psycho"
    ];

    const assigned = [];
    const selectedMafia = mafiaRoles
      .sort(() => Math.random() - 0.5)
      .slice(0, mafiaCount);

    selectedMafia.forEach(role => assigned.push(role));

    const remaining = shuffled.length - assigned.length;

    const selectedCitizen = citizenRoles
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.max(0, remaining - 1));

    selectedCitizen.forEach(role => assigned.push(role));

    while (assigned.length < shuffled.length) {
      assigned.push(neutralRoles[
        Math.floor(Math.random() * neutralRoles.length)
      ]);
    }

    const roleOrder = [...assigned].sort(() => Math.random() - 0.5);

    const gamePlayers = shuffled.map((player, index) => ({
      ...player,
      role: roleOrder[index],
      alive: true
    }));

    game = {
      round: 1,
      phase: "night",
      discussionTime: Number($("discussionTime").value),
      players: gamePlayers,
      votes: {},
      nightActions: {},
      message: "밤이 되었습니다. 각자의 역할을 확인하세요."
    };

    await sendMessage("GAME_START", game);
    applyGame(game);
  }

  function applyGame(nextGame) {
    game = nextGame;
    players = game.players;

    showScreen("gameScreen");

    const me = game.players.find(player => player.id === myId);

    $("myRole").textContent = me ? ROLES[me.role].name : "알 수 없음";
    $("myRoleDescription").textContent =
      me ? ROLES[me.role].description : "";

    renderGame();
  }

  function renderGame() {
    if (!game) return;

    $("roundLabel").textContent = `${game.round}일차`;
    $("phaseLabel").textContent =
      game.phase === "night" ? "밤" : "낮";

    $("gameTitle").textContent =
      game.phase === "night" ? "밤이 되었습니다" : "낮이 되었습니다";

    $("gameMessage").textContent = game.message;

    $("aliveCount").textContent =
      `${alivePlayers().length}명 생존`;

    $("gamePlayerList").innerHTML = game.players.map((player, index) => `
      <div class="player-item ${player.alive ? "" : "dead"}">
        <div class="player-avatar">${index + 1}</div>
        <span class="player-name">${escapeHTML(player.name)}</span>
        <span class="player-tag">${player.alive ? "생존" : "탈락"}</span>
      </div>
    `).join("");

    $("hostGameControls").classList.toggle("hidden", !isHost);

    renderActions();
    renderChat();
  }

  function renderActions() {
    const area = $("actionArea");
    const me = getPlayer(myId);

    area.innerHTML = "";

    if (!me || !me.alive) {
      area.textContent = "탈락한 플레이어는 행동할 수 없습니다.";
      return;
    }

    const targets = game.players.filter(p =>
      p.alive && p.id !== myId
    );

    if (game.phase === "day") {
      const label = document.createElement("h3");
      label.textContent = "투표할 플레이어";
      area.appendChild(label);

      const select = document.createElement("select");
      select.id = "voteTarget";

      targets.forEach(player => {
        const option = document.createElement("option");
        option.value = player.id;
        option.textContent = player.name;
        select.appendChild(option);
      });

      area.appendChild(select);

      const button = document.createElement("button");
      button.className = "secondary";
      button.textContent = "투표하기";
      button.onclick = () => {
        if (!select.value) return;
        sendMessage("VOTE", { target: select.value });
        notify("투표를 제출했습니다.");
      };

      area.appendChild(button);
      return;
    }

    if (game.phase === "night" && ROLES[me.role].team === "mafia") {
      const label = document.createElement("h3");
      label.textContent = "밤 행동 대상";
      area.appendChild(label);

      const select = document.createElement("select");
      select.id = "nightTarget";

      targets.forEach(player => {
        const option = document.createElement("option");
        option.value = player.id;
        option.textContent = player.name;
        select.appendChild(option);
      });

      area.appendChild(select);

      const button = document.createElement("button");
      button.className = "secondary";
      button.textContent = "대상 선택";
      button.onclick = () => {
        if (!select.value) return;
        sendMessage("NIGHT_ACTION", { target: select.value });
        notify("행동을 제출했습니다.");
      };

      area.appendChild(button);
    } else if (game.phase === "night") {
      area.textContent = "밤이 끝날 때까지 기다리세요.";
    }
  }

  function checkWinner() {
    const alive = alivePlayers();
    const mafia = alive.filter(p => ROLES[p.role].team === "mafia");
    const others = alive.filter(p => ROLES[p.role].team !== "mafia");

    if (mafia.length === 0) return "시민 팀";
    if (mafia.length >= others.length) return "마피아 팀";
    return null;
  }

  async function advancePhase() {
    if (!isHost || !game) return;

    if (game.phase === "night") {
      const targetVotes = Object.values(game.nightActions);
      const counts = {};

      targetVotes.forEach(id => {
        counts[id] = (counts[id] || 0) + 1;
      });

      const target = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])[0]?.[0];

      if (target) {
        const victim = getPlayer(target);
        if (victim && victim.alive) victim.alive = false;
      }

      game.phase = "day";
      game.message = "아침이 되었습니다. 토론 후 투표하세요.";
      game.votes = {};
      game.nightActions = {};
    } else {
      const counts = {};

      Object.values(game.votes).forEach(id => {
        counts[id] = (counts[id] || 0) + 1;
      });

      const result = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])[0];

      if (result) {
        const target = getPlayer(result[0]);
        if (target && target.alive) target.alive = false;
      }

      const winner = checkWinner();

      if (winner) {
        game.phase = "end";
        game.message = `${winner} 승리!`;
        await sendMessage("GAME_UPDATE", game);
        applyGame(game);
        notify(`${winner} 승리!`);
        return;
      }

      game.round++;
      game.phase = "night";
      game.message = "밤이 되었습니다. 마피아는 행동을 선택하세요.";
      game.votes = {};
      game.nightActions = {};
    }

    await sendMessage("GAME_UPDATE", game);
    applyGame(game);
  }

  function addChat(name, message, system = false) {
    chatMessages.push({ name, message, system });
    chatMessages = chatMessages.slice(-100);
    renderChat();
  }

  function renderChat() {
    $("chatHeading").textContent = "전체 채팅";
    $("chatMode").textContent = "전체 공개";

    $("chatMessages").innerHTML = chatMessages.map(item => `
      <div class="chat-line">
        ${
          item.system
            ? `<span class="system">${escapeHTML(item.message)}</span>`
            : `<strong>${escapeHTML(item.name)}</strong>${escapeHTML(item.message)}`
        }
      </div>
    `).join("");

    $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
  }

  async function handleMessage(message) {
    if (!message || message.sender === myId) return;

    const { type, data } = message;

    if (type === "CHAT") {
      addChat(data.name, data.message);
      return;
    }

    if (type === "GAME_START" || type === "GAME_UPDATE") {
      if (!isHost) applyGame(data);
      return;
    }

    if (!isHost || !game) return;

    if (type === "VOTE") {
      game.votes[message.sender] = data.target;
      return;
    }

    if (type === "NIGHT_ACTION") {
      const actor = getPlayer(message.sender);

      if (
        actor &&
        actor.alive &&
        ROLES[actor.role].team === "mafia"
      ) {
        game.nightActions[message.sender] = data.target;
      }
    }
  }

  async function sendChat(event) {
    event.preventDefault();

    const message = $("chatInput").value.trim();
    if (!message || !connected) return;

    $("chatInput").value = "";

    addChat(myName, message);

    await sendMessage("CHAT", {
      name: myName,
      message
    });
  }

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      notify("방 코드를 복사했습니다.");
    } catch {
      notify("코드: " + roomCode);
    }
  }

  $("createRoomBtn").addEventListener("click", createRoom);
  $("joinRoomBtn").addEventListener("click", joinRoom);
  $("copyCodeBtn").addEventListener("click", copyRoomCode);
  $("startGameBtn").addEventListener("click", startGame);
  $("leaveRoomBtn").addEventListener("click", closeRoom);
  $("nextPhaseBtn").addEventListener("click", advancePhase);
  $("chatForm").addEventListener("submit", sendChat);

  setStatus("Supabase 설정 필요");
})();
