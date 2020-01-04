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
  const buffer = fs.readFileSync(path.join(__dirname, DATA_DIR, 'total_follower_count.txt'))
  const total = buffer.toString('utf8')
  emitToPool("followers_count", total)
}

function initializeWatchers() {
  let lastFollower = getFileContent('most_recent_follower.txt')
  let lastSubscriber = getFileContent('most_recent_subscriber.txt')
  let lastResubscriber = getFileContent('most_recent_resubscriber.txt')

  watchFileContent('most_recent_follower.txt', (content) => {
    if (content === lastFollower) return
    emitToPool('follower', content)
    emitFollowersCount()
  })
  watchFileContent('most_recent_subscriber.txt', (content) => {
    if (content === lastSubscriber) return
    emitToPool('subscriber', content)
  })
  watchFileContent('most_recent_resubscriber.txt', (content) => {
    if (content === lastResubscriber) return
    emitToPool('subscriber', content)
  })
}

function watchFileContent(filename, cb) {
  fs.watchFile(path.join(__dirname, DATA_DIR, filename), () => {
    cb(getFileContent(filename))
  })
}

function getFileContent(filename) {
  const buffer = fs.readFileSync(path.join(__dirname, DATA_DIR, filename))
  const content = buffer.toString('utf8')
  return content
}
