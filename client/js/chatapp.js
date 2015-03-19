//took me a while to realize I needed "ngRoute", that is an update from angular 1.* to 1.*+1 (1.1 to 1.2 perhaps?)
var theapp = angular.module("chatapp", ['ngRoute']);

//the .config command sets up the main routes, I have a single age app repo for you to explore precisely this
theapp.config(["$routeProvider", "$locationProvider", 
//I will say which templates to use and which controllers for the various "screens" I want you to see.
	function($routeProvider, $locationProvider){
	    $routeProvider.when("/room/:topic", {
		    templateUrl : "/chatroom.html",
		    controller  : "RoomController"
	    }).when("/lobby", {
	      templateUrl : "/lobby.html",
	      controller : "LobbyController"
	    }).otherwise({
		    redirectTo : "/lobby"
	    });
	    $locationProvider.html5Mode(true);
}]);

//I decided to start the socket connection here, before anything has been hooked up anywhere
//The reason was so that I could use the socket in either controller.  
// If I were better at angular I would introduce a factory which would fire up the socket, and I could pass it around to 
// the controllers that needed it.  I'm not trying to get too fancy here, just show you enough to get you running, 
// we'll get more modular as we go.  If you want to improve the code then please do so...
var socket = io.connect();
var rooms = [];
var myroom = "";
//Some duplication here, I listen for a welcome and update the rooms variable.
socket.on("welcome", function(data){
  rooms = data.rooms;
  console.log("fresh rooms in");
});

theapp.factory("namespace", function(){
  var o = {
    name : "default name"
  };
  return o;
});

theapp.controller("LobbyController", ["$scope",  
  function($scope, namespace){
    $scope.rooms = rooms;
//when you head to the lobby I will log you off of your previous room
    socket.emit("unsubscribe", myroom);
//I will ask the server for the current rooms list
    socket.emit("rooms");
//I will update my rooms list in the scope (so the template has some rooms to work with)
    socket.on("welcome", function(data){
      $scope.rooms = data.rooms;
      $scope.$apply();
    });
  }
]);

theapp.controller("RoomController", ["$scope","$routeParams", 
//$routeParams lets me use the URL routes as a variable, a lot like we did with our API work using .htaccess
      function($scope, $routeParams, namespace) {
//in the route config up top I made a :topic variable in the url, here is where I read that.
        $scope.roomTopic = $routeParams.topic;
//my server will let me subscribe to that room topic (or any room topic for that matter)
        socket.emit("subscribe", $scope.roomTopic);
        myroom = $scope.roomTopic;
        $scope.messages = [];
        $scope.name = '';
        $scope.text = '';
//useless listener here...
        socket.on('connect', function () {
          $scope.setName();
        });

//when a new message shows up I will push it into the "scope's" message array, the template will deal with how to display it
        socket.on('message', function (msg) {
          console.log("new message", msg.text);
          if(msg.broadcast === "true"){
            $scope.messages.push(msg);
          }
          else if(msg.name === $scope.name){
            if(msg.text ==="/clear")$scope.messages.length = 0;
            else {
              if(msg.text === "/time")msg.text += ": " + timeStamp();
              console.log("Here:", msg.text);
              $scope.messages.push(msg);
            }
          }
          $scope.$apply();
        });

//when the send function is called I will use the current name, roomTopic, and text value to decide what 
//everyone should read
        $scope.send = function send() {
          console.log('Sending message:', $scope.text);
          if($scope.name ==='')alert("You must select a name to chat");
          else socket.emit('send', {text: $scope.text, room: $scope.roomTopic, name: $scope.name});
          $scope.text = '';
//Also I'll clear the text so you can chat like you expect to chat.
        };
        

//leftover code from previous version, the server gets a "identify" event with my current name, this helps 
//if you want everyone to get a list of current users (for instance knowing who is still in the room might be a nice feature)
        $scope.setName = function setName() {
          socket.emit('identify', $scope.name);
        };
  }]);



function timeStamp() {
  
  //CREDIT: https://gist.github.com/hurjas/2660489
  
  
// Create a date object with the current time
  var now = new Date();
 
// Create an array with the current month, day and time
  var date = [ now.getMonth() + 1, now.getDate(), now.getFullYear() ];
 
// Create an array with the current hour, minute and second
  var time = [ now.getHours(), now.getMinutes(), now.getSeconds() ];
 
// Determine AM or PM suffix based on the hour
  var suffix = ( time[0] < 12 ) ? "AM" : "PM";
 
// Convert hour from military time
  time[0] = ( time[0] < 12 ) ? time[0] : time[0] - 12;
 
// If hour is 0, set it to 12
  time[0] = time[0] || 12;
 
// If seconds and minutes are less than 10, add a zero
  for ( var i = 1; i < 3; i++ ) {
    if ( time[i] < 10 ) {
      time[i] = "0" + time[i];
    }
  }
 
// Return the formatted string
return (date.join("/") + " " + time.join(":") + " " + suffix).toString();
 
}