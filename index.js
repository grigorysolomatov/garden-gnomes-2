const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { main } = require('./src/main.js');
// -----------------------------------------------------------------------------
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'client')));
// -----------------------------------------------------------------------------
server.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
    main(io);
});
