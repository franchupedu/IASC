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

if(cluster.isMaster) 
{
    var numWorkers = require('os').cpus().length;
    numWorkers = 1;
    var workers = [];
    var conections = [];

    const app = express();

    const server = app.listen(process.env.PORT || WsPort, () => 
    {
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

    io.on('connection', socket => 
    {
        console.log("User connected");

        conections.push(socket);
    })
   
    console.log('Master cluster setting up ' + numWorkers + ' workers...');
   
    for(var i = 0; i < numWorkers; i++) 
    {
        var worker = cluster.fork();
        workers.push(worker);

        worker.on('message', function(msg)
        {
            switch(msg.type)
            {
                case 'new_bid':
                    io.emit('new_bid', msg.data)
                    break;
                case 'update_bid':
                    io.emit('update_bid', msg.data)
                    break;
            }
        });
    }

    cluster.on('online', function(worker) 
    {
        console.log('Worker ' + worker.process.pid + ' is online');
    });
      
    cluster.on('exit', function(worker, code, signal) 
    {
        console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
        
        var index = workers.indexOf(worker);
        if (index > -1) {
            workers.splice(index, 1);
        }

        console.log('Starting a new worker');

        var newWorker = cluster.fork();
        workers.push(newWorker);
    });

} else
{
    var buyers = [];
    var bids = [];
    var conections = [];

    var packageDefinition = protoLoader.loadSync(PROTO_PATH, options);
    const auctionProto = grpc.loadPackageDefinition(packageDefinition);

    const server = new grpc.Server();
    const app = express()

    server.addService(auctionProto.AuctionService.service, 
    {
        postBuyer: (call, callback) => 
        {
            var buyer = call.request;
            if(validateBuyer(buyer))
            {
                buyers.push(buyer);
                return callback(null, {status: "S", error: null});
            }
            else
            {
                return callback(null, {status: "N", error: "Invalid Username"});
            }      
        },
        postBid: (call, callback) => 
        {
            var bid = call.request;
            bids.push(bid);
            process.send({type: 'new_bid', data: bid});
            return callback(null, {status: "S", error: null})
        },
        postNewBid: (call, callback) => 
        {
            var newBid = call.request;
            if(validateNewBid(newBid))
            {
                bids.find(b => b.id == newBid.id).price = newBid.price;
                process.send({type: 'update_bid', data: newBid});
                return callback(null, {status: "S", error: null})
            }else
            {
                return callback(null, {status: "N", error: "Invalid Bid"});
            }
        },
        getBids: (_, callback) => 
        {            
            return callback(null, {bids: bids});
        }
    });
      
    server.bindAsync(
        "localhost:" + PORT,
        grpc.ServerCredentials.createInsecure(),
        (error, port) => 
        {
            console.log("Server running at http://localhost:" + PORT);
            server.start();
        }
    );

    function validateBuyer(buyer)
    {
        if(buyers.find(b => b.name == buyer.name) != undefined)
            return false;

        return true;
    }

    function validateNewBid (newBid)
    {
        var bid = bids.find(b => b.id == newBid.id);

        if( bid == undefined || bid.price >= newBid.price)
            return false;

        return true;
    }
}