var fs = require("fs");
module.exports = {
    name: "friendly", // name of module
    commands: [],
    initialise: null, // or initialize. Might include file I/O
    close: null // to end. Might include file I/O. May return Promise.
};
var Client = null;
var send = function(message, toSend) {
    message.channel.sendMessage(toSend).then(function() {
        console.log("Message sent.");
    }).catch(function() {
        console.log("Failed to send message.");
    });
};
var sendDM = function(message, toSend) {
    message.author.sendMessage(toSend).then(function() {
        console.log("DM sent.");
    }).catch(function() {
        console.log("Failed to send DM.");
    });
};
module.exports.commands.push({
    word: "sayhi", // command word
    description: "Say hi from another module!", // description when the help command is used on it
    execute: function(message, parsedMessage) {
        send(message, "Hi! I'm from another module!");
    }
});
/**
Client: Your standard Discord Client.
*/
module.exports.initialise = function(client) {
    Client = client;
    console.log("Initialised!");
};
module.exports.close = function(client) {
    console.log("Goodbye!");
};
