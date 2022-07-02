const express = require('express');
var cluster = require('cluster');
const socketio = require('socket.io')

const grpc = require("@grpc/grpc-js");
const PROTO_PATH = "./auction.proto";
var protoLoader = require("@grpc/proto-loader");


const PORT = 3000;
const WsPort = 4000;

const options = {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
};

if (cluster.isMaster) {
    var numWorkers = require('os').cpus().length;
    numWorkers = 2;
    var workers = [];
    var conections = [];

    const app = express();

    const server = app.listen(process.env.PORT || WsPort, () => {
        console.log(`WS Server Started on Port ` + WsPort)
    })

    const io = socketio(server,
        {
            cors: {
                origin: "http://localhost:5000",
                methods: ["GET", "POST"],
                transports: ['websocket', 'polling'],
                credentials: true
            },
            allowEIO3: true
        }
    );

    io.on('connection', socket => {
        console.log("User connected");

        conections.push(socket);
    })

    console.log('Master cluster setting up ' + numWorkers + ' workers...');

    for (var i = 0; i < numWorkers; i++) {
        var worker = cluster.fork();
        workers.push(worker);

        worker.on('message', function (msg) {
            switch (msg.type) {
                case 'new_bid':
                    for (const w of workers) {
                        if (w.process.pid !=  msg.sender) {
                            w.send({ type: 'new_bid', data: msg.data , sender: msg.sender})
                        }
                    }
                    console.log("Server: new bid from worker " +  msg.sender);
                    io.emit('new_bid', msg.data)
                    break;
                case 'update_bid':
                    for (const w of workers) {
                        if (w.process.pid !=  msg.sender) {
                            w.send({ type: 'update_bid', data: msg.data , sender: msg.sender})
                        }
                    }
                    console.log("Server: bid update from worker " +  msg.sender);
                    io.emit('update_bid', msg.data)
                    break;
                case 'new_buyer':
                    for (const w of workers) {
                        if (w.process.pid !=  msg.sender) {
                            w.send({ type: 'new_buyer', data: msg.data , sender: msg.sender})
                        }
                    }
                    console.log("Server: new buyer from worker " + msg.sender);
            }
        });
    }

    cluster.on('online', function (worker) {
        console.log('Worker ' + worker.process.pid + ' is online');
    });

    cluster.on('exit', function (worker, code, signal) {
        console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);

        var index = workers.indexOf(worker);
        if (index > -1) {
            workers.splice(index, 1);
        }

        console.log('Starting a new worker');

        var newWorker = cluster.fork();
        workers.push(newWorker);
    });
  


} else {
    var buyers = [];
    var bids = [];
    var conections = [];

    var packageDefinition = protoLoader.loadSync(PROTO_PATH, options);
    const auctionProto = grpc.loadPackageDefinition(packageDefinition);

    const server = new grpc.Server();
    const app = express()

    process.on("message", function (msg) {
        switch (msg.type) {
            case 'new_bid':
                var bid = msg.data;
                bids.push(bid);
                console.log(process.pid + ': new bid '+bid.id +' from worker '+ msg.sender +' created')
                break;
            case 'update_bid':
                var newBid = msg.data;
                if (validateNewBid(newBid)) {
                    bids.find(b => b.id == newBid.id).price = newBid.price;
                    console.log(process.pid + ': bid '+newBid.id +' from worker '+ msg.sender +' updated')
                }
                break;
            case 'new_buyer':
                var buyer = msg.data;
                if (validateBuyer(buyer)) {
                    buyers.push(buyer);
                    console.log(process.pid + ': new buyer from worker '+ msg.sender +' created')
                }
        }
    })

    server.addService(auctionProto.AuctionService.service,
        {
            postBuyer: (call, callback) => {
                var buyer = call.request;
                
                if (validateBuyer(buyer)) {
                    buyers.push(buyer);
                    console.log(process.pid + ": buyer "+buyer.name+" added")
                    process.send({ type: 'new_buyer', data: buyer , sender: process.pid});
                    return callback(null, { status: "S", error: null });
                }
                else {
                    return callback(null, { status: "N", error: "Invalid Username" });
                }
            },
            postBid: (call, callback) => {
                var bid = call.request;
                bids.push(bid);
                console.log(process.pid + ": bid "+ bid.id+" created")
                process.send({ type: 'new_bid', data: bid , sender: process.pid});
                return callback(null, { status: "S", error: null })
            },
            postNewBid: (call, callback) => {
                var newBid = call.request;
                if (validateNewBid(newBid)) {
                    bids.find(b => b.id == newBid.id).price = newBid.price;
                    console.log(process.pid + ": bid "+ newBid.id+" updated")
                    process.send({ type: 'update_bid', data: newBid , sender: process.pid});
                    return callback(null, { status: "S", error: null })
                } else {
                    return callback(null, { status: "N", error: "Invalid Bid" });
                }
            },
            getBids: (_, callback) => {
                return callback(null, { bids: bids });
            }
        });

    server.bindAsync(
        "localhost:" + PORT,
        grpc.ServerCredentials.createInsecure(),
        (error, port) => {
            console.log("Server running at http://localhost:" + PORT);
            server.start();
        }
    );


    function validateBuyer(buyer) {
        if (buyers.find(b => b.name == buyer.name) != undefined)
            return false;

        return true;
    }

    function validateNewBid(newBid) {
        var bid = bids.find(b => b.id == newBid.id);

        if (bid == undefined || bid.price >= newBid.price)
            return false;

        return true;
    }
}