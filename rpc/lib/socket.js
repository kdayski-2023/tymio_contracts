const server = require('http').createServer();
const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    },
    enabledTransports: ['ws', 'wss'],
});
const SOCKET_PORT = process.env.SOCKET_PORT || 5002;

function Socket() {
    this.connections = []
    io.on('connection', client => {
        console.log('socket connection')
        const { sessionToken } = client.handshake.query
        // client.join(sessionToken)
        console.log(sessionToken)
        // TODO IF CONNECTION EXIST
        this.connections.push({ sessionToken, client })
        client.emit('log', 'Socket connetion established');
    });
    server.listen(SOCKET_PORT, () => {
        console.log(`Socket server started on port ${SOCKET_PORT}`)
    });
}
Socket.prototype.emit = function emit(data) {
    const { sessionToken, msg } = data
    const finded = this.connections.find(s => s.sessionToken == sessionToken)
    finded.client.emit('log', msg);
}
module.exports = { Socket, io };
