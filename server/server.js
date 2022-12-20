var http = require("http");
var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var ip = require("ip");
var os = require("os");

app.use(express.static("."));
app.use(bodyParser.urlencoded({
  extended: false,
  limit: "50mb"
}));

app.get("/hello", function(req, res) {
  res.send("hello");
});

var httpServer = http.createServer(app).listen(80);

/****************
 * Socket Magic *
 ****************/

var devices = {};
var storage = {};

var hardcodedDeviceIds = [
  '#ff0000', // red
  '#0000ff', // blue
  '#008000', // green
  '#ffff00', // yellow
  '#800080', // purple
  '#00ffff', // cyan
  '#808000', // olive
  '#ffa500', // orange
  '#ff00ff', // fuchsia
];

var socketIO = require("socket.io").listen(httpServer);

socketIO.sockets.on("connection", function(socket) {

  socket.on("disconnect", function() {
    if (socket.deviceId) {
      delete devices[socket.deviceId];
      socketIO.sockets.emit("xd", {
        event: "devices",
        important: true,
        devices: devices
      });
    }
  });

  socket.on("xd", function(message, callback) {
    console.log("XD", message);

    var result = undefined;
    if (message.event == "storage") {
      result = storage;
      if (message.func === "get") {
        if (message.key) result = storage[message.key];
      } else if (message.func === "set") {
        if (message.key && message.data !== undefined) storage[message.key] = message.data;
        else if (message.key) delete storage[message.key];
        else if (typeof message.data === "object") storage = message.data;
        console.info(storage);

        socketIO.sockets.emit("xd", {
          event: "storage",
          important: true,
          storage: storage
        });
      }
    } else if (message.event == "device" && !socket.deviceId) {
      var id = 0;
      do {
        socket.deviceId = id < hardcodedDeviceIds.length - 1 ? hardcodedDeviceIds[id++] : newDeviceId();
      }
      while (socket.deviceId in devices);
      result = socket.deviceId;
      console.log("new device", result);
    } else {
      socketIO.sockets.emit("xd", message);
    }

    if (typeof callback == "function") {
      callback(result);
    }

    if (message.event == "device") {
      var device = {
        deviceId: result
      };
      for (var k in message) {
        if (k != "event") {
          device[k] = message[k];
        }
      }
      devices[socket.deviceId] = device;

      console.log(devices);
      socketIO.sockets.emit("xd", {
        event: "devices",
        important: true,
        devices: devices
      });
    }
  });

  socket.on("room", function(room) {
    console.log("joined room", room);
    socket.join(room);

    socket.on("disconnect", function() {
      console.log("left room", room);
      socket.leave(room);
    });

    socket.on("webRTC", function(msg) {
      console.log("webRTC", msg);
      socketIO.sockets.in(room).emit("webRTC", msg);
    });
  });
});

function newDeviceId() {
  var letters = "0123456789ABCDEF".split(""),
    id = "#";
  for (var i = 0; i < 6; i++) {
    id += letters[Math.round(Math.random() * 15)];
  }
  return id;
}

/*****************
 * /Socket Magic *
 *****************/

console.log("IP = " + ip.address());
console.log("hostname = " + os.hostname());