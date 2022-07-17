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
                    break;
                case 'close_bid':
                    for (const w of workers) {
                        if (w.process.pid !=  msg.sender) {
                            w.send({ type: 'close_bid', data: msg.data , sender: msg.sender})
                        }
                    }
                    io.emit('new_bid', null)
                    console.log("Server: closed bid from worker " + msg.sender);
                    break;
                case 'get_data':
                    for (const w of workers) {
                        console.log(msg.data)
                        if (w.process.pid == msg.data.target) {
                            console.log('Load Data Msg')
                            w.send({ type: 'load_data', data: {buyers: msg.data.buyers, bids: msg.data.bids} , sender: msg.sender})
                        }
                    }
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
        if(workers.length > 1)
        {
            console.log('Get Data')
            workers[0].send({ type: 'get_data', target: newWorker.process.pid})
        }
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
                break;
            case 'close_bid':
                var bidId = msg.data;
                bids.find(b => b.id = bidId).status = 'Closed';
                console.log(process.pid + ': closed bid from worker '+ msg.sender)
                break;
            case 'get_data':
                process.send({ type: 'get_data', data: {target: msg.target, buyers: buyers, bids: bids} , sender: process.pid});
                break;
            case 'load_data':
                console.log('Load Data')
                bids = msg.data.bids;
                buyers = msg.data.buyers;
                break;
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
                    bids.find(b => b.id == newBid.id).user = newBid.user;
                    console.log(process.pid + ": bid "+ newBid.id+" updated")
                    process.send({ type: 'update_bid', data: newBid , sender: process.pid});
                    return callback(null, { status: "S", error: null })
                } else {
                    return callback(null, { status: "N", error: "Invalid Bid" });
                }
            },
            getBids: (_, callback) => {
                var currentBids = getCurrentBids();
                console.log('From: ' + process.pid);
                return callback(null, { bids: currentBids });
            },
            getBidsHistory: (_, callback) => {
                return callback(null, {bids: bids});
            },
            closeBid: (call, callback) => 
            {
                var i = bids.map(function(b) {return b.id}).indexOf(call.request.id);
                if(i == -1)
                    return callback(null, { status: "N", error: "Invalid Bid" });

                var bid = bids[i];
                if(parseInt(bid.startTimestamp) + parseInt(bid.duration) < Date.now())
                    return callback(null, { status: "N", error: "Bid is already closed" });

                bid.status = "Closed";
                process.send({ type: 'close_bid', data: bid.id , sender: process.pid});
                return callback(null, { status: "S", error: null })
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

    function validateNewBid(newBid) 
    {
        var currentBids = getCurrentBids();
        var bid = currentBids.find(b => b.id == newBid.id);

        if (bid == undefined || bid.price >= newBid.price)
            return false;

        return true;
    }

    function getCurrentBids()
    {
        var currentBids = bids.filter(b => parseInt(b.startTimestamp) + parseInt(b.duration) > Date.now());
        return currentBids;
    }
}