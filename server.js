const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

const players = {};
const colors = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF'];
let colorIndex = 0;

// Game settings
const PLAYER_SPEED = 5; // Server-side speed
const SERVER_TICK_RATE = 1000 / 10; // 10 updates per second (100ms)

// Serve static files from the current directory (where server.js is)
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Function to apply input to player state (server-side)
function applyInput(player, input) {
  let velocityX = 0;
  let velocityY = 0;

  if (input.left) velocityX = -PLAYER_SPEED;
  if (input.right) velocityX = PLAYER_SPEED;
  if (input.up) velocityY = -PLAYER_SPEED;
  if (input.down) velocityY = PLAYER_SPEED;

  player.x += velocityX;
  player.y += velocityY;

  // Always update velocityX and velocityY, even if they are 0
  player.velocityX = velocityX;
  player.velocityY = velocityY;

  // Keep player within bounds (800x600 game area)
  player.x = Math.max(0, Math.min(800, player.x));
  player.y = Math.max(0, Math.min(600, player.y));
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Assign a unique color to the new player
  const playerColor = colors[colorIndex % colors.length];
  colorIndex++;

  // Add new player to players object
  players[socket.id] = {
    x: Math.floor(Math.random() * 700) + 50, // Random initial X
    y: Math.floor(Math.random() * 500) + 50, // Random initial Y
    color: playerColor,
    id: socket.id,
    lastProcessedInput: 0, // To track client-side prediction reconciliation
    velocityX: 0, // Initial velocity
    velocityY: 0  // Initial velocity
  };

  // Send the current players state to the new player
  socket.emit('currentPlayers', players);

  // Broadcast the new player to all other players
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // Handle player input
  socket.on('playerInput', (inputData) => {
    const player = players[socket.id];
    if (player) {
      // Apply input to server's authoritative state
      applyInput(player, inputData.input);
      player.lastProcessedInput = inputData.sequenceNumber;

      // Send authoritative state back to the client that sent the input
      socket.emit('playerState', {
        x: player.x,
        y: player.y,
        lastProcessedInput: player.lastProcessedInput,
        // No need to send otherPlayers here, as it will be sent by the tick rate
      });
    }
  });

  // Handle player disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove player from players object
    delete players[socket.id];
    // Broadcast disconnection to all other players
    io.emit('disconnect', socket.id);
  });
});

// Game loop / Fixed server tick rate
setInterval(() => {
  // Prepare state for all players to send to clients
  const allPlayersState = {};
  for (const id in players) {
    allPlayersState[id] = {
      x: players[id].x,
      y: players[id].y,
      color: players[id].color,
      id: players[id].id,
      velocityX: players[id].velocityX, // Include velocity
      velocityY: players[id].velocityY  // Include velocity
    };
  }
  // Broadcast all players' states to all clients
  io.emit('playerMoved', allPlayersState);
}, SERVER_TICK_RATE);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});