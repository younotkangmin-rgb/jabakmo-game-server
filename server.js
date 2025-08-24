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

// Serve static files from the current directory (where server.js is)
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

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
    id: socket.id
  };

  // Send the current players state to the new player
  socket.emit('currentPlayers', players);

  // Broadcast the new player to all other players
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // Handle player movement
  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      // Update player position based on velocity (simple physics)
      // For a real game, you'd want server-side authoritative movement
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;

      // Broadcast updated position to all clients
      io.emit('playerMoved', players[socket.id]);
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

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});