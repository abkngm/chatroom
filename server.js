//A bunch of modules

var http = require('http');
var path = require('path');
var async = require('async');
var socketio = require('socket.io');
var express = require('express');
var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);

//the nice way of serving up a folder without needing to do anything too nutty
router.use(express.static(path.resolve(__dirname, 'client')));

//a list of standard rooms although nothing here prevents the creation of more rooms on the client side
var rooms = ["misc", "trivia", "coding"];


//Was unable to get this to work, because the trivia game did not update
//the player array like the example did that the professor made with the roster.

//The idea was to creaete a central trivia game that clients can sign up for.
//Then the server would send out questions from a question bank and give a time limit.
//The clients would send answers during the answering phase and the server would check who got the answer first and score appropriately
//Quesytoins would be stored in the format, QuestionID, question and answers, where answers in an array. Thus, multiple answers like "california" and "CA" could both be accepted
//Unfortunately I did not have enough time to debug why this was not working as planned.So I had to leave it.
var TriviaGame = function(){
    var game = this;
    this.status = "inactive";// change later, for testing only
    this.players = [];
    this.questionsAsked =[];
    this.winpoints = 10;
    var henry = new Player();
    henry.name = "henry";
    this.players.push(henry);
    
    var inactive = "inactive";
    var answeringphase = "answeringphase";
    var inprogress = "inprogress";
    
    this.addPlayer = function(newname){
        var aPlayer = new Player();
        aPlayer.name = newname;//checking for already added players is done elswhere for emitting
        game.players.push()
    };
    
    this.isNotPlayer = function(name2){
        for(var i = 0; i < game.players.length; i++){
            if(name2 === game.players[i].name)return false;
        }
        return true;
    };
    
    this.getScoreOf = function(givename){
        for(var i =0; i < game.players.length;i++)
            if(game.players[i].name === givename)return givename + " has " + game.players[i].score + " points.";
        return givename + " not in this trivia game.";
    };
    
    this.isWinner = function(){
        for(var i = 0; i < game.players.length;i++)
            if(game.players[i].score === game.winpoints)return true;
        return false;
    };
    
    this.declareWinners = function(){
        var winners = [];
        var highestscore = 0;
        for(var i = 0; i < game.players.length; i++)
            if(game.players[i].score>highestscore)highestscore = game.players[i].score;
        
        for(var i =0; i<game.players.length;i++)
            if(game.players[i].score === highestscore)winners.push(game.players[i].name);
            
        if(winners.length === 0)return "No winners for this game!";
        else if(winners.length===1)return "The winner is " + winners.toString() + " with " + highestscore + "points! Congratulations!";
        else return "The winners " + winners.toString() + " tied with " + highestscore + "points! Congratulations!";
    };
};

var Player = function(){
    var player = this;
    player.name = "";
    player.score = 0;
    
    this.updateScore = function(addscore){
        player.score+=addscore;
    };
};


function getWeather(zipcode, unit, callback, data2, name, room, command){//very messy way to do this, but it works
    
    //CREDIT Based on: http://www.onextrapixel.com/2011/08/22/adding-weather-to-your-site-with-jquery-and-yql/
    
    var loc = zipcode; // or e.g. SPXX0050
    var u = unit.toLowerCase();
    var query = "SELECT item.condition FROM weather.forecast WHERE location='" + loc + "' AND u='" + u + "'";
    var cacheBuster = Math.floor((new Date().getTime()) / 1200 / 1000);
    var host = 'query.yahooapis.com';
    var path = '/v1/public/yql?q='  + encodeURIComponent(query) + '&format=json&_nocache=' + cacheBuster;
    var http = require("http");
    var options = {
        host: host,
        path: path,
        method: "GET",
        port: 80
    }
    http.get(options, function(resp){
        resp.on('data', function(data){
            var obj= (JSON.parse(data)).query.results.channel.item.condition;
            data2.text = (command + ": " + obj.date + " - In area " + zipcode + " it is " + obj.text + ", temperature of " + obj.temp + " degrees " + unit.toUpperCase() +". Courtesty of yahoo");
            data2.name = name;
            data2.room = room;
            console.log("Here in weather function: data = ", data2.text);
            callback(data2);
        });
    }).on('error', function(e){
        console.log("Error in weather:", e.message);
        data2.text = command + "Unexpected error: " + e.message;
        data2.room = room;
        data2.name = name;
        callback(data2);
    });
};


function weathercallback(data){
    data.broadcast = true;
    io.sockets.in(data.room).emit('message', data);
}



var MasterTriviaGame = new TriviaGame();

var broadcast_commands = ["!pick", "!dice"];
var private_commands = ["/help", "/time", "/clear", "/trivia", "/triviahelp", "/weather"];
var trivia_commands = ["!triviastart", "/join", "/ta", "/score", "/getplayers"];

function parse_private_command(data){
    data.broadcast = "false";
    var wordArray = data.text.split(" ");
    var command = wordArray[0];
    console.log("reached private parse function with command:" , command);
     if(private_commands.indexOf(command)!= -1){
       if(command === "/help")data.text = "You may execute some built in commands. / are visible only to you, while ! is to brodcast to everyone. Private commands: " + private_commands.toString() + ". Broadcast commands: " + broadcast_commands.toString();
       else if(command === "/trivia")data.text = command + ": You can play trivia games in the trivia room! Use !triviastart to start a new game which shall check if a game is active or not. /triviajoin is to join an active trivia game or check if one is active! Use /triviahelp for more information!";
       else if(command === "/triviahelp")data.text = command + ": Full list of trivia commands: /trivia, /triviahelp," + trivia_commands.toString() +". Note that some of these may only be used in the trivia room";
       else data.text = command;//for /time and /clea
    }
    else{
       data.text = command + ": Invalid Command - Use /help for command help, and /triviahelp for trivia commands.";
    }
    return data;
}

function parse_broadcast_command(data){
    var wordArray = data.text.split(" ");
    var command = wordArray[0];
    console.log("reached broadcast parse function with command:" , command);
    if(broadcast_commands.indexOf(command)!= -1){
        data.broadcast = "true";
        if(command==="!pick"){
            var itemstring = data.text.substring(command.length);
            var items = itemstring.split(",");
            console.log("!pick: item list", items.toString());
            if(items.length <2){
                data.text = command + ": There must be at least two options. e.g. !pick what's your name, 2";
                data.broadcast = "false";
            }
            else{
                data.text = data.text + ": Randomly picked: " + items[Math.floor(Math.random() * items.length)];
            }
        }
        else if(command ==="!dice"){
            if(wordArray.length===1){
                data.text = command + ": You rolled a " + (Math.floor((Math.random() * 6) + 1)) + "!";
            }
            else if(wordArray.length > 2 || isNaN(wordArray[1])){
                data.broadcast = "false";
                data.text = command + ": Use !dice, or !dice N, where N is a number, to roll a number between 1 and N";
            }
            else data.text = command + " " + wordArray[1] + ": You rolled a " + (Math.floor((Math.random() * parseInt(wordArray[1]))+1)) + "!";
        }
    }
    else{
        data.text = command + ": Invalid Command - Your message was not broadcast";
        data.broadcast = "false";
    }
    
    return data;
}


function parse_trivia_command(data){
       var wordArray = data.text.split(" ");
       var command = wordArray[0];
       //No command checking done here because it is assumed that it is a trivia command to come to this point.
       console.log("Reached trivia parser with:", command);
       if(data.room!= "trivia"){
           data.text = command + ": can only be used in the trivia room.";
           data.broadcast = false;
           io.sockets.in(data.room).emit('message', data);
       }
       else{
           //Real meat of the trivia game
           if(command === "/join"){
               if(MasterTriviaGame.status === "inactive")data.text = command + ": No games are active at this time.";
               else if(MasterTriviaGame.status ==="started")data.text = command + ": Game was already started. Try next game."
               else{
                   if(MasterTriviaGame.isNotPlayer(data.text)){
                       MasterTriviaGame.addPlayer(data.text);
                       data.text = command + ": You were successfully added into the trivia game.";
                       console.log("Playerlist:",MasterTriviaGame.players.toString())
                   }
                   else data.text = command + ": Someone with this name is already in the game.";
               }
              data.broadcast = false;
              io.sockets.in(data.room).emit('message', data);
           }
           else if(command === "/getplayers"){
            data.broadcast = false;
            data.text = command + ": The list of players playing the trivia game are:" + MasterTriviaGame.players.toString();
            io.sockets.in(data.room).emit('message', data);
           }
           else{
            data.text = command + ": Hey you are in the trivia room! Good job.";
            data.broadcast = false;
            io.sockets.in(data.room).emit('message', data);
           }
       }
}


//connection is the main event
io.sockets.on('connection', function(socket){
//socket is the interface for one session

//socket.on makes an "event listener" which will trigger the function.
    socket.on("rooms", function(){
//socket.emit fires a message to the client and a payload of a JSON object
//The main philosophy of this setup is to make events and payloads of data, done.

//my choice was to have some fixed topic rooms which a user can request using "rooms"
//I respond with the event "welcome", again not the best choice, make better choices in your code
      socket.emit('welcome', {
        "rooms" : rooms  
      });
    });

//a little code duplication here, so sue me
    socket.emit('welcome', {
      "rooms" : rooms
    });
    
//this is how a session can "join" a side channel (that is socket.join("string"))
//it is up to the server code (this code) to decide if that is meaningful
    socket.on('subscribe', function(room) { 
        console.log('joining room', room);
        socket.join(room);
    })

    socket.on('unsubscribe', function(room) {  
        console.log('leaving room', room);
//leaving channel "string" or room in this case.
        socket.leave(room); 
    })

//this choice (copied from stack overflow) is to let each message send a room in the JSON data
    socket.on('send', function(data) {
        ///Trivia section! Had to add it here because did not plan this originally.
        var command = data.text.split(" ")[0];
        if(trivia_commands.indexOf(command)!=-1)parse_trivia_command(data);
        else if(command === "/weather"){//Messed up having to put this here because of different callback.
            var string = data.text.substring(command.length);
            var args = string.split(",");
            if(args.length != 2){
                data.text = command + ": To find weather, use /weather zipcode, F/C depending on which units you need.";
                data.broadcast = "false";
                io.sockets.in(data.room).emit('message', data);
            }
            else{
               getWeather(args[0], args[1], weathercallback, data, data.name,data.room,command);//this is really bad but it works
            }
        }
        ///
        else{
            console.log('sending message',data.room);
            //this part takes the message and only emits it to people in the same room.
            if(data.text.charAt(0)==="!"){
                data = parse_broadcast_command(data);
                console.log("broadcast command");
            }
            else if(data.text.charAt(0)==="/"){
                console.log("private command");
                 data = parse_private_command(data);
            }
            else{
                console.log("not a command");
                data.broadcast = "true";
            }
            io.sockets.in(data.room).emit('message', data);
        }
    });

});


//This is taken from the cloud9 hello world for node since it's sure to work fine
server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});

