const express = require("express");
var WebSocketServer = require('websocket').server;
var http = require('http');
const path = require("path");

var WebSocketClient = require('websocket').client;

var app = express();

// for parsing the body in POST request
var bodyParser = require('body-parser');

var buyers = [];
var bids = [];

app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());


/* POST /buyers
    {
        "buyer": {
            //generar Id
            "name": "Test User",
            "ip" : "192.180.55.66",
            "tags": ["Inmuebles", "Jueguitos"]
        }
    }
*/
app.post('/buyers', function (req, res) {
    console.log(req.body);
    var buyer = req.body.buyer;
    buyers.push(buyer);

    return res.send('Comprador '+ buyer + ' agregado exitosamente');
});

/* POST /bids
    {
        "bid": {
            "id": 3,
            "tags": ["Inmuebles", "Jueguitos"],
            "price" : 92.5,
            "duration": 50,
            "article": {
                //Detalles del articulo que no sabemos
            }
            //Al inicio es null
            "buyer_ip": null
        }
    }
*/
app.post('/bids', function (req, res) {
    var bid = req.body.bid;
    bids.push(bid);

    return res.send('Subasta numero '+bid.id+' agregada exitosamente');
});

/* POST /bid/:id
    {
        "offer": {
            "buyer_ip": "172.550.25.25"
            "price" : 150,
        }
    }
*/
app.post('/bid/:id', function (req, res) {
    var offer = req.body.offer;
    var id = req.params.id;
    //Manejar que pasa si no es correcto el Id usando CPS
    var bid = bids.find(b => b.id = id);
    if(bid.price < offer.price){
        bid.price = offer.price;
        bid.buyer_ip = offer.buyer_ip;
        //Notificar a todos
        return res.send('La subasta '+bid.id+' tiene un nuevo precio de '+bid.price);
    }
    
    //Notificar al mismo
    return res.send('Tu precio fue demasiado bajo');
});

app.listen('8000', function(){
    console.log('Server listening on port 8000');
});