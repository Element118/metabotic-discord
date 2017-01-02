var fs = require("fs");
/**
This is a module for making a PageRank system for recommendations on Discord.
**/
module.exports = {
    name: "PageRankRecommend", // name of module
    commands: [],
    initialise: null, // or initialize. Might include file I/O
    close: null // to end. Might include file I/O. May return Promise.
};
var getFileName = function(server, category) {
    return "PageRankRecommendFile"+server+""+category+".txt";
};

var dampingFactor = 0.85;
var PageRank = function() {
    this.server = null;
    this.category = null;
    this.userNames = [];
    this.users = [];
    this.userIdMap = null;
    this.ranks = [];
    this.adjList = [];
};
PageRank.prototype.generateUserIdMap = function() {
    this.userIdMap = {};
    for (var i=0;i<this.users.length;i++) {
        this.userIdMap[this.users[i]] = i;
    }
};
PageRank.prototype.iterate = function(iterations) {
    iterations = iterations || 1;
    var N = this.users.length;
    while (iterations-->0) {
        console.log("Iterating... "+iterations+" times left...");
        var newRanks = new Array(N);
        for (var i=0;i<N;i++) {
            newRanks[i] = (1-dampingFactor)/N;
        }
        for (var i=0;i<N;i++) {
            if (this.adjList[i].length) {
                for (var j=0;j<this.adjList[i].length;j++) {
                    newRanks[this.adjList[i][j]] += dampingFactor*this.ranks[i]/this.adjList[i].length;
                }
            } else {
                for (var j=0;j<N;j++) {
                    newRanks[j] += dampingFactor*this.ranks[i]/N;
                }
            }
        }
        this.ranks = newRanks;
    }
};
PageRank.prototype.parseFile = function(server, category) {
    console.log("Getting data for "+server.name+" in category "+category);
    var fileName = getFileName((this.server = server).name, this.category = category);
    this.userNames = [];
    this.users = [];
    this.ranks = [];
    this.adjList = [];
    this.userIdMap = null;
    var _this = this;
    return new Promise(function(resolve, reject) {
        fs.readFile(__dirname + "/" + fileName, "utf8", function(err, data) {
            if (err) {
                if(err.code == "ENOENT") {
                    // file does not exist
                    // get users from server directly
                    var members = _this.server.members;
                    _this.users = Array.from(members.keys());
                    var N = _this.users.length;
                    for (var i=0;i<N;i++) {
                        var user = members.get(_this.users[i]).user;
                        _this.userNames.push(user.username+"#"+user.discriminator);
                        _this.ranks.push(1/N);
                        _this.adjList.push([]);
                    }
                    _this.generateUserIdMap();
                    resolve();
                    return;
                } else {
                    console.log(err);
                    reject();
                    return;
                }
            }
            // check file does not exist, if fail, create file data
            data = data.split("\n");
            var N = data.length;
            var members = _this.server.members;
            for (var i=0;i<N;i++) {
                if (data[i]) {
                    var curUser = data[i].split(" ");
                    _this.users.push(curUser[0]);
                    var user = members.get(curUser[0]).user;
                    _this.userNames.push(user.username+"#"+user.discriminator);
                    _this.ranks.push(+curUser[1]);
                    curUser = curUser.slice(2);
                    console.log(curUser.length);
                    for (var j=0;j<_this.adjList.length;j++) {
                        console.log(curUser[j]);
                        curUser[j] = +curUser[j];
                    }
                    _this.adjList.push(curUser);
                }
            }
            _this.generateUserIdMap();
            resolve();
        });
    });
};
PageRank.prototype.save = function() {
    var fileName = getFileName(this.server.name, this.category);
    var memoryString = "";
    var N = this.users.length;
    for (var i=0;i<N;i++) {
        memoryString += this.users[i]+" "+this.ranks[i];
        for (var j=0;j<this.adjList[i].length;j++) {
            memoryString += " "+this.adjList[i][j];
        }
        memoryString += "\n";
    }
    return new Promise(function(resolve, reject) {
        fs.writeFile(__dirname + "/" + fileName, memoryString, function(err) {
            if (err) {
                console.log(err);
                reject();
                return;
            }
            resolve();
        });
    });
};
var servers = {}; // map from server to data
var pageRanks = {}; // map from (server, category) to PageRank

// http://stackoverflow.com/questions/9229645/remove-duplicates-from-javascript-array
var unique = function(a) {
    var seen = {};
    return a.filter(function(item) {
        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
    });
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
    word: "recommend", // command word
    description: "Recommend someone in a category. Use: ~M~recommend some_category username0#discriminator0 username1#discriminator1 username2#discriminator2 ...",
    execute: function(message, parsedMessage) {
        var guild = message.guild;
        var tokens = parsedMessage.split(/ "/g);
        var category = tokens[0];
        var user = message.author.id;
        // check if the pageRank has already existed
        var pageRank = pageRanks[getFileName(guild.name, category)];
        if (!pageRank) {
            pageRank = pageRanks[getFileName(guild.name, category)] = new PageRank();
            pageRank.parseFile(guild, category).then(function() {
                // do the update
                user = pageRank.userIdMap[user];
                for (var i=1;i<tokens.length;i++) {
                    var index = pageRank.userNames.indexOf(tokens[i].replace(/\\"/g, "\""));
                    if (index !== -1) pageRank.adjList[user].push(index);
                }
                pageRank.adjList[user] = unique(pageRank.adjList[user]);
                pageRank.iterate(10);
                console.log("Done iterations.");
                console.log(pageRank.adjList[user]);
                sendDM(message, "Updated recommendations.");
                console.log(pageRank.adjList[user]);
            }).catch(function() {
                console.log("Failed to recommend.");
            });
        } else {
            // do the update
            user = pageRank.userIdMap[user];
            for (var i=1;i<tokens.length;i++) {
                var index = pageRank.userNames.indexOf(tokens[i].replace(/\\"/g, "\""));
                if (index !== -1) pageRank.adjList[user].push(index);
            }
            pageRank.adjList[user] = unique(pageRank.adjList[user]);
            pageRank.iterate(10);
            console.log("Done iterations.");
            console.log(pageRank.adjList[user]);
            sendDM(message, "Updated recommendations.");
            console.log(pageRank.adjList[user]);
        }
    }
}, {
    word: "unrecommend", // command word
    description: "Unrecommend someone in a category. Use: ~M~unrecommend some_category username0#discriminator0 username1#discriminator1 username2#discriminator2 ...",
    execute: function(message, parsedMessage) {
        var guild = message.guild;
        var tokens = parsedMessage.split(" ");
        var category = tokens[0];
        var user = message.author.id;
        // check if the pageRank has already existed
        var pageRank = pageRanks[getFileName(guild.name, category)];
        if (!pageRank) {
            pageRank = pageRanks[getFileName(guild.name, category)] = new PageRank();
            pageRank.parseFile(guild, category).then(function() {
                // do the update
                user = pageRank.userIdMap[user];
                for (var i=1;i<tokens.length;i++) {
                    var index = pageRank.userNames.indexOf(tokens[i]);
                    if (index !== -1) index = pageRank.adjList[user].indexOf(tokens[i]);
                    if (index !== -1) pageRank.adjList[user].splice(index, 1);
                }
                pageRank.iterate(10);
                sendDM(message, "Updated recommendations.");
            }).catch(function() {
                console.log("Failed to unrecommend.");
            });
        } else {
            // do the update
            user = pageRank.userIdMap[user];
            for (var i=1;i<tokens.length;i++) {
                var index = pageRank.userNames.indexOf(tokens[i]);
                if (index !== -1) index = pageRank.adjList[user].indexOf(tokens[i]);
                if (index !== -1) pageRank.adjList[user].splice(index, 1);
            }
            pageRank.iterate(10);
            sendDM(message, "Updated recommendations.");
        }
    }
}, {
    word: "viewrecommends", // command word
    description: "View your recommendations in a category. Use: ~M~viewrecommends some_category",
    execute: function(message, parsedMessage) {
        var guild = message.guild;
        var tokens = parsedMessage.split(" ");
        var category = tokens[0];
        var user = message.author.id;
        // check if the pageRank has already existed
        var pageRank = pageRanks[getFileName(guild.name, category)];
        if (!pageRank) {
            pageRank = pageRanks[getFileName(guild.name, category)] = new PageRank();
            pageRank.parseFile(guild, category).then(function() {
                user = pageRank.userIdMap[user];
                var recommendations = "";
                for (var i=0;i<pageRank.adjList[user].length;i++) {
                    console.log(pageRank.adjList[user][i]);
                    recommendations += pageRank.userNames[pageRank.adjList[user][i]]+"\n";
                }
                sendDM(message, "Here are your recommendations:\n"+recommendations);
            }).catch(function() {
                console.log("Failed to view recommendations.");
            });
        } else {
            user = pageRank.userIdMap[user];
            var recommendations = "";
            for (var i=0;i<pageRank.adjList[user].length;i++) {
                recommendations += pageRank.userNames[pageRank.adjList[user][i]]+"\n";
            }
            sendDM(message, "Here are your recommendations:\n"+recommendations);
        }
    }
}, {
    word: "addcategory", // command word
    description: "[MODERATOR] Add a category. Use: ~M~addcategory some_category",
    execute: function(message, parsedMessage) {
        var roles = message.member.roles;
        if (roles.find("name", "Moderator")) { // if I can find a moderator role
            var guild = message.guild;
            var pageRank = pageRanks[getFileName(guild.name, parsedMessage)];
            if (!pageRank) {
                pageRank = pageRanks[getFileName(guild.name, parsedMessage)] = new PageRank();
                pageRank.parseFile(guild, parsedMessage);
            }
            sendDM(message, "Created category.");
        } else {
            sendDM(message, "Sorry, you are not a moderator.");
        }
    }
}, {
    word: "deletecategory", // command word
    description: "[MODERATOR] Delete a category. Use: ~M~deletecategory some_category",
    execute: function(message, parsedMessage) {
        var roles = message.member.roles;
        if (roles.find("name", "Moderator")) { // if I can find a moderator role
            sendDM(message, "Sorry, this does not work yet. You can contact Element118 to delete the category for now.");
        }
    }
}/*, {
    word: "viewcategories", // command word
    description: "View all categories on the current server. Use: ~M~viewcategories",
    execute: function(message, parsedMessage) {
        //
        send(message, "Hi! I'm from another module!");
    }
}, {
    word: "viewcategory", // command word
    description: "View the top users in a particular category. Use: ~M~viewcategory some_category",
    execute: function(message, parsedMessage) {
        //
        send(message, "Hi! I'm from another module!");
    }
}*/);
/**
Client: Your standard Discord Client.
*/
module.exports.initialise = function(client) {
    Client = client;
    console.log("Initialised!");
};
module.exports.close = function(client) {
    // save all the PageRank objects in files
    var promises = [];
    for (var i in pageRanks) {
        promises.push(pageRanks[i].save());
    }
    return Promise.all(promises);
};
