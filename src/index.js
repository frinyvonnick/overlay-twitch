const handler = require("serve-handler");
const http = require("http");
const fetch = require("node-fetch");
const qs = require("querystring");
const ngrok = require("ngrok");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

const connectionPool = [];

const emitToPool = (channel, message) => {
  connectionPool.forEach(socket => {
    socket.emit(channel, message);
  });
};

const server = http.createServer((request, response) => {
  return handler(request, response, {
    public: "src"
  });
});

var io = require("socket.io")(server);

io.on("connection", function(socket) {
  connectionPool.push(socket);
  emitFollowersCount();
  emitSubscribersCount();
  socket.on("disconnect", function() {
    const connectionIndex = connectionPool.findIndex(
      connection => connection === socket
    );
    connectionPool.splice(connectionIndex, 1);
  });
});

server.listen(3000, () => {
  console.log("Running at http://localhost:3000");
  console.log('pid is ' + process.pid);
  initializeWatchers();
});

const DATA_DIR = '../data'

function emitFollowersCount() {
  const total = getFileContent('total_follower_count.txt')
  emitToPool("follower_count", total)
}

function emitSubscribersCount() {
  const total = getFileContent('total_subscriber_count.txt')
  emitToPool("subscriber_count", total)
}

function initializeWatchers() {
  watchFileContent('most_recent_follower.txt', (content) => {
    emitToPool('follower', content)
    emitFollowersCount()
  })
  watchFileContent('most_recent_subscriber.txt', (content) => {
    emitToPool('subscriber', content)
    emitSubscribersCount()
  })
  watchFileContent('most_recent_resubscriber.txt', (content) => {
    emitToPool('subscriber', content)
    emitSubscribersCount()
  })
}

function watchFileContent(filename, cb) {
  let previousContent = getFileContent(filename)
  fs.watchFile(path.join(__dirname, DATA_DIR, filename), () => {
    const content = getFileContent(filename)
    if (content === previousContent) return
    cb(content)
  })
}

function getFileContent(filename) {
  const buffer = fs.readFileSync(path.join(__dirname, DATA_DIR, filename))
  const content = buffer.toString('utf8')
  return content
}
