const handler = require("serve-handler");
const http = require("http");
const fetch = require("node-fetch");
const qs = require("querystring");

require("dotenv").config();

const connectionPool = [];

const emitToPool = (channel, message) => {
  connectionPool.forEach(socket => {
    socket.emit(channel, message);
  });
};

async function getFollowersCount() {
  const id = await getUserId(process.argv[3])
  return fetch(`https://api.twitch.tv/helix/users/follows?to_id=${id}`, {
    method: "GET",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      "Accept": "application/vnd.twitchtv.v5+json"
    },
  })
    .then(res => res.json())
    .then(({ total }) => total)
}

function getUserId(login) {
  return fetch(`https://api.twitch.tv/kraken/users?login=${login}`, {
    method: "GET",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      "Accept": "application/vnd.twitchtv.v5+json"
    },
  })
    .then(res => res.json())
    .then(({ users }) => users)
    .then(([{ _id }]) => _id)
}

async function subscribeToFollowers() {
  const id = await getUserId(process.argv[3])
  return fetch("https://api.twitch.tv/helix/webhooks/hub", {
    method: "POST",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "hub.callback": `${process.argv[2]}/twitch`,
      "hub.mode": "subscribe",
      "hub.lease_seconds": "864000",
      "hub.topic":
        `https://api.twitch.tv/helix/users/follows?first=1&to_id=${id}`
    })
  })
    .then(res => res.status)
    .then(console.log)
    .catch(e => console.error(e));
}

subscribeToFollowers()

const server = http.createServer((request, response) => {
  if (request.url.includes("/followers")) {
    const followersCount = getFollowersCount()
      .then(total => {
        response.write(JSON.stringify({ data: total }));
        response.end()
      })

    response.writeHead(200);
    return;
  }
  else if (request.url.includes("/twitch")) {
    const params = qs.decode(request.url.split("?")[1]);

    if (params["hub.challenge"]) {
      response.writeHead(200);
      response.write(params["hub.challenge"]);
      response.end();
    } else {
      let body = "";
      request.on("data", chunk => {
        body += chunk;
      });
      request.on("end", () => {
        console.log("NEW FOLLOWER", JSON.parse(body).data[0].from_name);
        emitToPool("follower", body);
        response.end("ok");
      });
    }
    return;
  }

  return handler(request, response, {
    public: "src"
  });
});

var io = require("socket.io")(server);

io.on("connection", function(socket) {
  connectionPool.push(socket);
  socket.on("disconnect", function() {
    const connectionIndex = connectionPool.findIndex(
      connection => connection === socket
    );
    connectionPool.splice(connectionIndex, 1);
  });
});

server.listen(3000, () => {
  console.log("Running at http://localhost:3000");
});
