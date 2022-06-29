const grpc = require("@grpc/grpc-js");
var protoLoader = require("@grpc/proto-loader");
const PROTO_PATH = "./auction.proto";

const options = {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
};

var packageDefinition = protoLoader.loadSync(PROTO_PATH, options);

const AuctionService = grpc.loadPackageDefinition(packageDefinition).AuctionService;

const client = new AuctionService(
    "localhost:3000",
    grpc.credentials.createInsecure()
);

module.exports = client;