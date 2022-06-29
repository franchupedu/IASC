const express = require('express');
var cluster = require('cluster');

const grpc = require("@grpc/grpc-js");
const PROTO_PATH = "./auction.proto";
var protoLoader = require("@grpc/proto-loader");


const PORT = 3000;

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
   
    console.log('Master cluster setting up ' + numWorkers + ' workers...');
   
    for(var i = 0; i < numWorkers; i++) 
    {
        var worker = cluster.fork();
        workers.push(worker);
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

    var packageDefinition = protoLoader.loadSync(PROTO_PATH, options);
    const auctionProto = grpc.loadPackageDefinition(packageDefinition);

    const server = new grpc.Server();

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
            console.log(bid)
            return callback(null, {status: "S", error: null})
        },
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
        console.log(buyers.find(b => b.name == buyer.name))
        if(buyers.find(b => b.name == buyer.name) != undefined)
            return false;

        return true;
    }
}