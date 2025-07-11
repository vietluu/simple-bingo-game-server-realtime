import { Server } from 'socket.io';
import { createServer } from 'http';
import { Hono } from 'hono';
import dotenv from 'dotenv';

dotenv.config();

const app = new Hono();
app.get('/', (c) => c.text('Bingo Game Server is running!'));

const httpServer = createServer();

interface Room {
  players: { id: string; name: string; bingoCard?: number[][] }[];
  numbers: number[];
  calledNumbers: number[];
  status: "waiting" | "playing" | "finished";
  interval?: NodeJS.Timeout; 
  winner?: { id: string; name: string; winPattern: string };
  waitingTimer?: NodeJS.Timeout; 
  waitingStartTime?: number; 
  countdownInterval?: NodeJS.Timeout; 
}

const io = new Server(httpServer, {
  cors: {
    origin: '*', 
  },
});
const rooms: { [key: string]: Room } = {};

const MIN_PLAYERS = process.env.MIN_PLAYERS as unknown as number;

const MAX_PLAYERS = process.env.MAX_PLAYERS as unknown as number;

const MAX_WAITING_TIME = process.env.MAX_WAITING_TIME as unknown as number;

const DEFAULT_ROOM = "default";

createRoom(DEFAULT_ROOM);

function generateRandomPlayerName() {
  const adjectives = [
    "Speedy",
    "Lucky",
    "Brave",
    "Smart",
    "Happy",
    "Clever",
    "Swift",
    "Bold",
    "Wise",
    "Cool",
  ];
  const nouns = [
    "Player",
    "Gamer",
    "Winner",
    "Star",
    "Hero",
    "Champion",
    "Master",
    "Ace",
    "Pro",
    "Legend",
  ];

  const adjective =
    adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);

  return `${adjective}${noun}${number}`;
}

function createRoom(roomId: number | string) {
  rooms[roomId] = {
    players: [],
    numbers: generateBingoNumbers(),
    calledNumbers: [],
    status: "waiting", 
  };
}

function generateBingoNumbers() {
  const numbers = [];
  for (let i = 1; i <= 75; i++) {
    numbers.push(i);
  }
  return numbers;
}

function generateBingoCard() {
  const card: number[][] = [];
  
  const ranges = [
    [1, 15],   // B
    [16, 30],  // I
    [31, 45],  // N
    [46, 60],  // G
    [61, 75]   // O
  ];
  
  for (let col = 0; col < 5; col++) {
    const column: number[] = [];
    const [min, max] = ranges[col];
    const availableNumbers = [];
    
    for (let i = min; i <= max; i++) {
      availableNumbers.push(i);
    }
    
    for (let row = 0; row < 5; row++) {
      if (col === 2 && row === 2) {
        column.push(0);
      } else {
        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
        const number = availableNumbers.splice(randomIndex, 1)[0];
        column.push(number);
      }
    }
    
    card.push(column);
  }
  
  return card;
}

function checkBingo(bingoCard: number[][], calledNumbers: number[]) {
  const calledSet = new Set([...calledNumbers, 0]); 
  
  for (let row = 0; row < 5; row++) {
    let count = 0;
    for (let col = 0; col < 5; col++) {
      if (calledSet.has(bingoCard[col][row])) {
        count++;
      }
    }
    if (count === 5) return `Row ${row + 1}`;
  }
  
  for (let col = 0; col < 5; col++) {
    let count = 0;
    for (let row = 0; row < 5; row++) {
      if (calledSet.has(bingoCard[col][row])) {
        count++;
      }
    }
    if (count === 5) return `Column ${col + 1}`;
  }
  
  let diag1Count = 0;
  for (let i = 0; i < 5; i++) {
    if (calledSet.has(bingoCard[i][i])) {
      diag1Count++;
    }
  }
  if (diag1Count === 5) return "Diagonal (top-left to bottom-right)";
  
  let diag2Count = 0;
  for (let i = 0; i < 5; i++) {
    if (calledSet.has(bingoCard[i][4 - i])) {
      diag2Count++;
    }
  }
  if (diag2Count === 5) return "Diagonal (top-right to bottom-left)";
  
  return null;
}

function callNumber(roomId: string) {
  const room = rooms[roomId];
  if (room.numbers.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * room.numbers.length);
  const number = room.numbers.splice(index, 1)[0];
  room.calledNumbers.push(number);
  return number;
}

function startAutoNumberCalling(roomId: string) {
  const room = rooms[roomId];
  if (room.interval) {
    clearInterval(room.interval);
  }
  
  console.log(`Starting auto number calling for room ${roomId}`);
  
  room.interval = setInterval(() => {
    if (room.status === "playing") {
      const number = callNumber(roomId);
      if (number) {
        console.log(`Auto called number ${number} in room ${roomId}`);
        io.to(roomId).emit("numberCalled", {
          number: number,
          totalCalled: room.calledNumbers.length,
          remaining: room.numbers.length
        });
        
        checkForBingo(roomId);
        
      } else {
        console.log(`All 75 numbers called in room ${roomId}, ending game`);
        endGame(roomId, "All 75 numbers called", null);
      }
    } else {
      clearInterval(room.interval);
      room.interval = undefined;
    }
    }, 3000); 
  }

function stopAutoNumberCalling(roomId: string) {
  const room = rooms[roomId];
  if (room.interval) {
    console.log(`Stopping auto number calling for room ${roomId}`);
    clearInterval(room.interval);
    room.interval = undefined;
  }
}

function startWaitingTimer(roomId: string) {
  const room = rooms[roomId];
  if (!room || room.status !== "waiting") return;
  
  if (room.waitingTimer) {
    clearTimeout(room.waitingTimer);
  }
  if (room.countdownInterval) {
    clearInterval(room.countdownInterval);
  }
  
  room.waitingStartTime = Date.now();
  console.log(`Starting 2-minute waiting timer for room ${roomId}`);
  
  io.to(roomId).emit("waitingStarted", {
    maxWaitingTime: MAX_WAITING_TIME,
    message: "Waiting for more players. Game will start automatically in 2 minutes.",
    allNumbers: Array.from({length: 75}, (_, i) => i + 1), 
    calledNumbers: [] 
  });
  
  room.countdownInterval = setInterval(() => {
    if (room.status !== "waiting" || !room.waitingStartTime) {
      if (room.countdownInterval) {
        clearInterval(room.countdownInterval);
        room.countdownInterval = undefined;
      }
      return;
    }
    
    const elapsed = Date.now() - room.waitingStartTime;
    const remaining = Math.max(0, MAX_WAITING_TIME - elapsed);
    
    if (remaining > 0) {
      io.to(roomId).emit("waitingCountdown", {
        remainingTime: remaining,
        remainingSeconds: Math.ceil(remaining / 1000)
      });
    } else {
      if (room.countdownInterval) {
        clearInterval(room.countdownInterval);
        room.countdownInterval = undefined;
      }
    }
  }, 1000);
  
  room.waitingTimer = setTimeout(() => {
    if (room.status === "waiting") {
      console.log(`2-minute waiting time expired for room ${roomId}, force starting game`);
      
      io.to(roomId).emit("waitingEnded", {
        reason: "Time expired - Game started!"
      });
      
      startGame(roomId);
      
      if (room.countdownInterval) {
        clearInterval(room.countdownInterval);
        room.countdownInterval = undefined;
      }
    }
    room.waitingTimer = undefined;
    room.waitingStartTime = undefined;
  }, MAX_WAITING_TIME);
}

function stopWaitingTimer(roomId: string) {
  const room = rooms[roomId];
  if (room) {
    if (room.waitingTimer) {
      console.log(`Stopping waiting timer for room ${roomId}`);
      clearTimeout(room.waitingTimer);
      room.waitingTimer = undefined;
      room.waitingStartTime = undefined;
    }
    if (room.countdownInterval) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = undefined;
    }
  }
}

function checkRoomStatus(roomId: string) {
  const room = rooms[roomId];
  
  if (room.players.length >= MAX_PLAYERS && room.status === "waiting") {
    console.log(`Room ${roomId} has enough players (${room.players.length}), starting game early`);
    io.to(roomId).emit("waitingEnded", {
      reason: "Enough players joined - Game started!"
    });
    startGame(roomId);
  } else if (room.players.length > 0 && room.status === "waiting" && !room.waitingTimer) {
    startWaitingTimer(roomId);
  }
}

function startGame(roomId: string) {
  const room = rooms[roomId];
  if (room.status !== "waiting") {
    return;
  }
  
  room.status = "playing";
  console.log(`Game started in room ${roomId}`);
  
  stopWaitingTimer(roomId);
  
  io.to(roomId).emit("gameStart", {
    message: "Game is starting now!",
    allNumbers: Array.from({ length: 75 }, (_, i) => i + 1),
    calledNumbers: room.calledNumbers
  })
  
  startAutoNumberCalling(roomId);
}

function checkForBingo(roomId: string) {
  const room = rooms[roomId];
  if (!room || room.status !== "playing") return;
  
  for (const player of room.players) {
    if (player.bingoCard) {
      const winPattern = checkBingo(player.bingoCard, room.calledNumbers);
      if (winPattern) {
        console.log(`${player.name} claimed BINGO with ${winPattern}`);
      }
    }
  }
}

function endGame(roomId: string, reason: string, winner: { id: string; name: string; winPattern: string } | null) {
  const room = rooms[roomId];
  if (!room) return;
  
  console.log(`Game ended in room ${roomId}: ${reason}`);
  room.status = "finished";
  
  if (winner) {
    room.winner = winner;
    console.log(`Winner: ${winner.name} with ${winner.winPattern}`);
  }
  
  stopAutoNumberCalling(roomId);
  
  io.to(roomId).emit("gameEnd", {
    reason: reason,
    winner: winner,
    calledNumbers: room.calledNumbers,
    totalNumbersCalled: room.calledNumbers.length
  });
  
  setTimeout(() => {
    resetRoom(roomId);
  }, 10000);
}

function resetRoom(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;
  
  console.log(`Resetting room ${roomId} and kicking all players`);
  
  io.to(roomId).emit("roomReset", {
    message: "Game ended! You have been disconnected from the room.",
    kicked: true,
    allNumbers: Array.from({length: 75}, (_, i) => i + 1), 
    calledNumbers: []
  });
  
  for (const player of room.players) {
    const socket = io.sockets.sockets.get(player.id);
    if (socket) {
      socket.leave(roomId);
      socket.emit("kickedFromRoom", {
        message: "You have been disconnected from the room after game ended.",
        roomId: roomId
      });
    }
  }
  
  room.status = "waiting";
  room.calledNumbers = [];
  room.numbers = generateBingoNumbers();
  room.winner = undefined;
  room.players = []; 
  
  stopAutoNumberCalling(roomId);
  stopWaitingTimer(roomId);
  
  console.log(`Room ${roomId} has been reset and all players kicked out`);
}

io.on("connection", (socket: any) => {
  console.log(`New connection: ${socket.id}`);

  socket.on("startGame", () => {
    const roomId = DEFAULT_ROOM;
    
    if (rooms[roomId].status !== "waiting") {
      socket.emit("joinError", { 
        message: "Cannot join - game is already in progress or finished",
        roomStatus: rooms[roomId].status
      });
      return;
    }
    
    const existingPlayer = rooms[roomId].players.find(player => player.id === socket.id);
    if (existingPlayer) {
      console.log(`Socket ${socket.id} already in room ${roomId} as ${existingPlayer.name}`);
      socket.emit("playerJoined", { 
        name: existingPlayer.name, 
        roomId: roomId,
        bingoCard: existingPlayer.bingoCard,
        allNumbers: Array.from({length: 75}, (_, i) => i + 1),
        calledNumbers: rooms[roomId].calledNumbers
      });
      return;
    }
    
    const playerName = generateRandomPlayerName();
    const bingoCard = generateBingoCard();
    
    socket.join(roomId);
    rooms[roomId].players.push({ 
      id: socket.id, 
      name: playerName,
      bingoCard: bingoCard
    });

    console.log(`${playerName} (${socket.id}) joined the default room`);

    io.to(roomId).emit("updatePlayers", rooms[roomId].players);
    io.to(roomId).emit("updateRoomStatus", {
      status: rooms[roomId].status,
      players: rooms[roomId].players.length,
      minPlayers: MIN_PLAYERS,
    });

    socket.emit("playerJoined", { 
      name: playerName, 
      roomId: roomId,
      bingoCard: bingoCard,
      allNumbers: Array.from({length: 75}, (_, i) => i + 1),
      calledNumbers: rooms[roomId].calledNumbers
    });

    checkRoomStatus(roomId);
  });

  socket.on("joinRoom", (roomId: string, playerName: string) => {
    if (!rooms[roomId]) {
      createRoom(roomId);
    }
    
    if (rooms[roomId].status !== "waiting") {
      socket.emit("joinError", { 
        message: "Cannot join - game is already in progress or finished",
        roomStatus: rooms[roomId].status,
        roomId: roomId
      });
      console.log(`${playerName} attempted to join room ${roomId} but game is ${rooms[roomId].status}`);
      return;
    }
    
    const existingPlayer = rooms[roomId].players.find(player => player.id === socket.id);
    if (existingPlayer) {
      console.log(`Socket ${socket.id} already in room ${roomId}`);
      return;
    }
    
    socket.join(roomId);
    const bingoCard = generateBingoCard();
    rooms[roomId].players.push({ 
      id: socket.id, 
      name: playerName,
      bingoCard: bingoCard
    });
    
    console.log(`${playerName} (${socket.id}) joined room ${roomId}`);
    
    io.to(roomId).emit("updatePlayers", rooms[roomId].players);
    io.to(roomId).emit("updateRoomStatus", {
      status: rooms[roomId].status,
      players: rooms[roomId].players.length,
      minPlayers: MIN_PLAYERS,
    });
    
    socket.emit("playerJoined", { 
      name: playerName, 
      roomId: roomId,
      bingoCard: bingoCard,
      allNumbers: Array.from({length: 75}, (_, i) => i + 1),
      calledNumbers: rooms[roomId].calledNumbers
    });
    
    checkRoomStatus(roomId);
  });

 
  socket.on("callNumber", (roomId: string) => {
    const room = rooms[roomId];
    if (room.status === "playing") {
      const number = callNumber(roomId);
      if (number) {
        console.log(`Manual called number ${number} in room ${roomId}`);
        io.to(roomId).emit("numberCalled", {
          number: number,
          totalCalled: room.calledNumbers.length,
          remaining: room.numbers.length
        });
      }
    }
  });

  socket.on("reSyncNumbers", () => {
    const room = rooms[DEFAULT_ROOM];
    if (room) {
      console.log(`Re-syncing called numbers for room ${DEFAULT_ROOM}`, room.calledNumbers);
      
      socket.emit("reSyncNumbersResult", {
        calledNumbers: room.calledNumbers,
      });
    } else {
      socket.emit("reSyncNumbersError", { message: "Room not found" });
    }
  });

 
  socket.on("stopGame", (roomId: string) => {
    const room = rooms[roomId];
    if (room && room.status === "playing") {
      console.log(`Game stopped in room ${roomId}`);
      room.status = "waiting";
      stopAutoNumberCalling(roomId);
      
      io.to(roomId).emit("gameStopped", {
        reason: "Game stopped by player",
        calledNumbers: room.calledNumbers
      });
      
      io.to(roomId).emit("updateRoomStatus", {
        status: room.status,
        players: room.players.length,
        minPlayers: MIN_PLAYERS,
      });
    }
  });

 
  socket.on("claimBingo", (roomId: string) => {
    const room = rooms[roomId];
    if (!room || room.status !== "playing") {
      socket.emit("bingoResult", { success: false, message: "Game not in progress" });
      return;
    }
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.bingoCard) {
      socket.emit("bingoResult", { success: false, message: "Player not found or no bingo card" });
      return;
    }
    
    const winPattern = checkBingo(player.bingoCard, room.calledNumbers);
    if (winPattern) {
     
      console.log(`${player.name} claimed BINGO with ${winPattern}`);
      socket.emit("bingoResult", { success: true, message: "BINGO! You won!", pattern: winPattern });
      
      endGame(roomId, "BINGO!", { 
        id: player.id, 
        name: player.name, 
        winPattern: winPattern 
      });
    } else {
     
      console.log(`${player.name} made invalid BINGO claim`);
      socket.emit("bingoResult", { success: false, message: "Invalid BINGO claim" });
    }
  });

  
  socket.on("checkRoomStatus", (roomId: string) => {
    const room = rooms[roomId];
    if (room) {
      socket.emit("roomStatusInfo", {
        roomId: roomId,
        status: room.status,
        players: room.players.length,
        minPlayers: MIN_PLAYERS,
        canJoin: room.status === "waiting"
      });
    } else {
      socket.emit("roomStatusInfo", {
        roomId: roomId,
        status: "not_found",
        players: 0,
        minPlayers: MIN_PLAYERS,
        canJoin: true
      });
    }
  });

  socket.on("leaveGame", (roomId: string) => {
    const room = rooms[roomId];
    if (!room) return;
    
    const playerIndex = room.players.findIndex(player => player.id === socket.id);
    if (playerIndex !== -1) {
      const playerName = room.players[playerIndex].name;
      console.log(`${playerName} manually left the game in room ${roomId}`);
      
      room.players = room.players.filter(player => player.id !== socket.id);
      socket.leave(roomId);
      
      io.to(roomId).emit("updatePlayers", room.players);
      io.to(roomId).emit("updateRoomStatus", {
        status: room.status,
        players: room.players.length,
        minPlayers: MIN_PLAYERS,
      });
      
      if (roomId === DEFAULT_ROOM && room.players.length === 0) {
        console.log(`Default room is empty after manual leave, resetting...`);
        stopAutoNumberCalling(roomId);
        stopWaitingTimer(roomId); // Dừng waiting timer
        room.status = "waiting";
        room.calledNumbers = [];
        room.numbers = generateBingoNumbers();
        room.winner = undefined;
      }
      
      socket.emit("leftGame", { message: "You have left the game", roomId: roomId });
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    for (const roomId in rooms) {
      const playerIndex = rooms[roomId].players.findIndex(player => player.id === socket.id);
      if (playerIndex !== -1) {
        const playerName = rooms[roomId].players[playerIndex].name;
        console.log(`${playerName} (${socket.id}) left the room ${roomId}`);
        
        rooms[roomId].players = rooms[roomId].players.filter(
          (player) => player.id !== socket.id
        );
        
        io.to(roomId).emit("updatePlayers", rooms[roomId].players);
        io.to(roomId).emit("updateRoomStatus", {
          status: rooms[roomId].status,
          players: rooms[roomId].players.length,
          minPlayers: MIN_PLAYERS,
        });
        
        if (roomId === DEFAULT_ROOM && rooms[roomId].players.length === 0) {
          console.log(`Default room is empty, resetting...`);
          
          stopAutoNumberCalling(roomId);
          stopWaitingTimer(roomId);
          
          rooms[roomId].status = "waiting";
          rooms[roomId].calledNumbers = [];
          rooms[roomId].numbers = generateBingoNumbers();
          rooms[roomId].winner = undefined;
        }
      }
    }
    
    console.log(`Total connections: ${io.engine.clientsCount}`);
  });
});
const PORT = process.env.PORT;
httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Socket.IO server is ready for connections`);
})
  
setInterval(() => {
  const totalConnections = io.engine.clientsCount;
  const totalPlayers = Object.values(rooms).reduce((sum, room) => sum + room.players.length, 0);
  console.log(`Status - Connections: ${totalConnections}, Players in rooms: ${totalPlayers}`);
}, 30000);