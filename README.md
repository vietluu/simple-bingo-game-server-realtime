# 🎯 Simple Bingo Game Server - Realtime

A realtime multiplayer Bingo game built with Node.js, Socket.IO and TypeScript. The server supports multiple rooms, automatic number calling, and Bingo pattern detection.

## 🚀 Features

### 🎮 Game Features
- ✅ **Multiplayer Realtime**: Support multiple players simultaneously
- ✅ **Auto Number Calling**: Automatically calls numbers every 3 seconds
- ✅ **Smart Bingo Detection**: Automatically checks Bingo patterns (horizontal, vertical, diagonal)
- ✅ **Random Player Names**: Automatically generates random player names
- ✅ **5x5 Bingo Cards**: Creates standard Bingo cards with FREE space in center
- ✅ **Multiple Rooms**: Support for multiple game rooms
- ✅ **Auto Room Management**: Automatically resets rooms after game ends

### ⚡ Technical Features
- 🔄 **Hot Reload**: Uses nodemon for automatic restart on changes
- 🌐 **WebSocket**: Realtime communication with Socket.IO
- 📦 **TypeScript**: Type-safe development
- 🎯 **CORS Enabled**: Support for cross-origin requests
- 🔧 **Configurable**: Easy customization of wait times, player counts...

## 🛠️ Installation

### System Requirements
- Node.js >= 18.0.0
- npm or yarn

### Install dependencies
```bash
npm install
```

### Run development server
```bash
npm run dev
```

### Build production
```bash
npm run build
npm start
```

## 🎯 Usage

### Access server
```
http://localhost:3000
```

### Socket.IO Events

#### 📤 Client Events (Send to server)
- `startGame` - Automatically join default room
- `joinRoom(roomId, playerName)` - Join specific room
- `claimBingo(roomId)` - Claim Bingo
- `leaveGame(roomId)` - Leave game
- `callNumber(roomId)` - Manually call number (if needed)
- `stopGame(roomId)` - Stop game
- `checkRoomStatus(roomId)` - Check room status
- `reSyncNumbers()` - Resync called numbers

#### 📥 Server Events (Receive from server)
- `playerJoined` - Player joined notification
- `updatePlayers` - Update player list
- `updateRoomStatus` - Update room status
- `waitingStarted` - Start countdown for waiting players
- `waitingCountdown` - Countdown timer for waiting
- `gameStart` - Game started
- `numberCalled` - New number called
- `bingoResult` - Result when claiming Bingo
- `gameEnd` - Game ended
- `roomReset` - Room reset

## 🎲 How to Play

### Basic Rules
1. **Join Game**: Connect Socket.IO and emit `startGame` event
2. **Receive Bingo Card**: Server automatically creates 5x5 card with FREE space in center
3. **Wait for Players**: Game auto-starts after 5 seconds or when 10 players join
4. **Listen for Numbers**: Server automatically calls numbers every 3 seconds from 1-75
5. **Mark Numbers**: Mark the numbers on your card
6. **Claim Bingo**: When you have a complete pattern, emit `claimBingo`
7. **Win**: First player with valid pattern wins

### Bingo Patterns
- **Horizontal**: 5 consecutive numbers in a row
- **Vertical**: 5 consecutive numbers in a column
- **Diagonal**: 5 consecutive numbers diagonally (2 directions)

### Bingo Card Layout
```
B  I  N  G  O
1  16 31 46 61
2  17 32 47 62
3  18 🆓 48 63
4  19 33 49 64
5  20 34 50 65
```

## ⚙️ Configuration

### Customizable parameters in `src/index.ts`:
```typescript
const MIN_PLAYERS = 1;          // Minimum players required
const MAX_PLAYERS = 10;         // Maximum players allowed
const MAX_WAITING_TIME = 5000;  // Wait time (ms)
const DEFAULT_ROOM = "default"; // Default room name
```

### Nodemon configuration in `nodemon.json`:
```json
{
  "watch": ["src"],
  "ext": "ts,js,json",
  "ignore": ["src/**/*.spec.ts", "node_modules"],
  "exec": "tsx src/index.ts",
  "env": {
    "NODE_ENV": "development"
  }
}
```

## 🏗️ Architecture

### Tech Stack
- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Socket.IO + HTTP Server
- **Build Tool**: TSC (TypeScript Compiler)
- **Dev Tool**: Nodemon + TSX

### Project Structure
```
bingo-app/
├── src/
│   └── index.ts        # Main server file
├── package.json        # Dependencies & scripts
├── tsconfig.json       # TypeScript config
├── nodemon.json        # Nodemon config
└── README.md           # Documentation
```

## 🔧 Development

### Available Scripts
```bash
npm run dev     # Run development server with nodemon
npm run build   # Build TypeScript to JavaScript
npm start       # Run production server
```

### Debug
Server logs detailed information about:
- Player connections
- Room status
- Called numbers
- Bingo results
- Connection statistics

## 🌟 Client Example

### HTML + JavaScript Client
```html
<!DOCTYPE html>
<html>
<head>
    <title>Bingo Game</title>
    <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
</head>
<body>
    <div id="bingo-card"></div>
    <button onclick="joinGame()">Join Game</button>
    <button onclick="claimBingo()">BINGO!</button>
    
    <script>
        const socket = io('http://localhost:3000');
        
        function joinGame() {
            socket.emit('startGame');
        }
        
        function claimBingo() {
            socket.emit('claimBingo', 'default');
        }
        
        socket.on('playerJoined', (data) => {
            console.log('Joined as:', data.name);
            console.log('Your card:', data.bingoCard);
        });
        
        socket.on('numberCalled', (data) => {
            console.log('Number called:', data.number);
        });
        
        socket.on('bingoResult', (data) => {
            if (data.success) {
                alert('BINGO! You won!');
            } else {
                alert('Invalid BINGO claim');
            }
        });
    </script>
</body>
</html>
```

## 🐛 Troubleshooting

### Port 3000 already in use
```bash
npx kill-port 3000
# or
lsof -ti:3000 | xargs kill
```

### TypeScript compilation errors
```bash
npm run build
# Check errors in tsconfig.json
```

## 📝 License

MIT License - Free to use for any purpose.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Create Pull Request

## 📞 Support

If you encounter any issues, please create an issue or contact the developer.

---

**Happy Bingo Gaming! 🎉**
