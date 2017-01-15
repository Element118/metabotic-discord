var fs = require("fs");
/**
 * This is a module for making a PageRank system for recommendations on Discord.
 */
module.exports = {
    name: "PageRankRecommend", // name of module
    commands: [],
    initialise: null, // or initialize. Might include file I/O
    close: null // to end. Might include file I/O. May return Promise.
};
/**
 * Standard file name system used for this module.
 */
var getFileName = function(server, category) {
    return "PageRankRecommendFile"+server+""+category+".txt";
};

/*
TODO:
1. Efficiency.
2. Refactoring.
3. Ignore bots.
4. Handle recommendation input in a better way.

Get names from string
split on space
combine data.slice(1)
search for #number
take substrings
*/
/*
var Priority_Queue = function(init, cmpre) {
    this.data = init || [null];
    this.compare = cmpre || function(a, b) {
        return a<b;
    };
};
Priority_Queue.prototype.fixHeapAt(where) {
    if (where<=0 ||)
};
*/


/**
 * Damping factor used for PageRank.
 */
var dampingFactor = 0.85;
/**
 * Uses PageRank to recommend users.
 */
var PageRank = function() {
    this.server = null;
    this.category = "";
    this.userNames = [];
    this.users = [];
    this.userIdMap = null;
    this.ranks = [];
    this.adjList = [];
    this.roleName = "";
    this.role = null;
    this.threshold = function(totalMembers) {
        return 2/totalMembers;
    };
};

/**
 * Generates a map from the Discord User ID to the number used in this object.
 */
PageRank.prototype.generateUserIdMap = function() {
    this.userIdMap = {};
    for (var i=0;i<this.users.length;i++) {
        this.userIdMap[this.users[i]] = i;
    }
};
/**
 * Iterates to improve accuracy of ranks, by default 10 times.
 */
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
/**
 * Adds and removes roles for users, if their rank is above the threshold.
 */
PageRank.prototype.addRoles = function() {
    if (!this.role) return;
    var threshold = this.threshold(this.users.length);
    this.server.members.forEach(function(guildMember) {
        if (this.ranks[this.userIdMap[guildMember.id]]>=threshold) {
            // add role
            var roleExists = guildMember.roles.find("name", this.roleName);
            if (!roleExists) {
                guildMember.addRole(this.role).then(function() {
                    console.log("Added role to user "+guildMember.user.username+".");
                }).catch(function() {
                    console.log("Failed to add role.");
                });
            }
        } else {
            // remove role
            var roleExists = guildMember.roles.find("name", this.roleName);
            if (roleExists) {
                guildMember.removeRole(this.role).then(function() {
                    console.log("Removed role to user "+guildMember.user.username+".");
                }).catch(function() {
                    console.log("Failed to remove role.");
                });
            }
        }
    }, this);
};
/**
 * Removes user from data.
 */
PageRank.prototype.removeUser = function(index) {
    // Replace member with last member
    var removeUser = index;
    var lastMember = this.users.length-1;
    if (removeUser != lastMember) {
        // remove user from adjacency list
        for (var j=0;j<this.adjList.length;j++) {
            var index = this.adjList[j].indexOf(removeUser);
            if (index != -1) {
                this.adjList[j].splice(index, 1);
            }
        }
        // remove user from map
        delete this.userIdMap[this.users[index]];
        // replace user in adjacency list
        for (var j=0;j<this.adjList.length;j++) {
            var index = this.adjList[j].indexOf(lastMember);
            if (index != -1) {
                this.adjList[j][index] = removeUser;
            }
        }
        this.users[removeUser] = this.users[lastMember];
        this.userNames[removeUser] = this.userNames[lastMember];
        this.ranks[removeUser] = this.ranks[lastMember];
        this.adjList[removeUser] = this.adjList[lastMember];
        this.userIdMap[this.users[lastMember]] = removeUser;
    }
    // Pop last member
    this.users.pop();
    this.userNames.pop();
    this.ranks.pop();
    this.adjList.pop();
    this.iterate(10);
    this.addRoles();
};
/**
 * Tries to create a role for this PageRank.
 */
PageRank.prototype.getRole = function() {
    this.roleName = this.category.replace(/_/g, " ");
    this.role = this.server.roles.find("name", this.roleName);
    if (!this.role) {
        var _this = this;
        this.server.createRole({
            name: this.roleName
        }).then(function() {
            console.log("Role \""+_this.roleName+"\" created!");
            _this.addRoles();
        }).catch(function() {
            console.log("Role \""+_this.roleName+"\" not created!");
        });
    }
};
/**
 * Tries to find a file corresponding with the server and category.
 * On failure to find file, create data.
 * @return Promise
 */
PageRank.prototype.parseFile = function(server, category) {
    console.log("Getting data for "+server.name+" in category "+category);
    if (!category.match(/^[0-9a-zA-Z_]+$/)) return new Promise(function(resolve, reject) { reject(); });
    var fileName = getFileName((this.server = server).id, this.category = category);
    this.getRole();
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
                }
                console.log(err);
                reject();
                return;
            }
            // check file does not exist, if fail, create file data
            data = data.split("\n");
            var N = data.length;
            var members = _this.server.members;
            for (var i=0;i<N;i++) {
                if (data[i]) {
                    var curUser = data[i].split(" ");
                    _this.users.push(curUser[0]);
                    var guildMember = members.get(curUser[0]);
                    if (guildMember) {
                        var user = guildMember.user;
                        _this.userNames.push(user.username+"#"+user.discriminator);
                    } else {
                        _this.userNames.push("");
                    }
                    _this.ranks.push(+curUser[1]);
                    curUser = curUser.slice(2);
                    for (var j=0;j<curUser.length;j++) {
                        curUser[j] = +curUser[j];
                    }
                    _this.adjList.push(curUser);
                }
            }
            _this.generateUserIdMap();
            var existUsersChange = false;
            // delete users
            for (var i=_this.users.length-1;i>=0;i--) {
                if (_this.userNames[i] == "") {
                    _this.removeUser(i);
                    existUsersChange = true;
                }
            }
            members.forEach(function(value) {
                if (!value.id) {
                    existUsersChange = true;
                    _this.users.push(value.id);
                    _this.userNames.push(user.username+"#"+user.discriminator);
                    _this.ranks.push(0);
                    _this.adjList.push([]);
                }
            });
            if (existUsersChange) {
                _this.iterate(10);
            }
            _this.generateUserIdMap();
            _this.addRoles();
            resolve();
        });
    });
};
/**
 * Tries to find a file corresponding with the server and category.
 * On failure to find file, fail.
 * @return Promise
 */
PageRank.prototype.parseFileSafe = function(server, category) {
    console.log("Getting data for "+server.name+" in category "+category);
    if (!category.match(/^[0-9a-zA-Z_]+$/)) return new Promise(function(resolve, reject) { reject(); });
    var fileName = getFileName((this.server = server).id, this.category = category);
    this.userNames = [];
    this.users = [];
    this.ranks = [];
    this.adjList = [];
    this.userIdMap = null;
    var _this = this;
    return new Promise(function(resolve, reject) {
        fs.readFile(__dirname + "/" + fileName, "utf8", function(err, data) {
            if (err) {
                reject();
                return;
            }
            data = data.split("\n");
            var N = data.length;
            var members = _this.server.members;
            _this.getRole();
            for (var i=0;i<N;i++) {
                if (data[i]) {
                    var curUser = data[i].split(" ");
                    _this.users.push(curUser[0]);
                    var guildMember = members.get(curUser[0]);
                    if (guildMember) {
                        var user = guildMember.user;
                        _this.userNames.push(user.username+"#"+user.discriminator);
                    } else {
                        _this.userNames.push("");
                    }
                    _this.ranks.push(+curUser[1]);
                    curUser = curUser.slice(2);
                    for (var j=0;j<curUser.length;j++) {
                        curUser[j] = +curUser[j];
                    }
                    _this.adjList.push(curUser);
                }
            }
            _this.generateUserIdMap();
            var existUsersChange = false;
            // delete users
            for (var i=_this.users.length-1;i>=0;i--) {
                if (_this.userNames[i] == "") {
                    _this.removeUser(i);
                    existUsersChange = true;
                }
            }
            members.forEach(function(value) {
                if (!value.id) {
                    existUsersChange = true;
                    _this.users.push(value.id);
                    _this.userNames.push(user.username+"#"+user.discriminator);
                    _this.ranks.push(0);
                    _this.adjList.push([]);
                }
            });
            if (existUsersChange) {
                _this.iterate(10);
            }
            _this.generateUserIdMap();
            _this.addRoles();
            resolve();
        });
    });
};
/**
 * Tries to save file.
 * @return Promise
 */
PageRank.prototype.save = function() {
    var fileName = getFileName(this.server.id, this.category);
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

/**
 * Using an object to store the PageRank objects in.
 */
var pageRanks = {}; // map from (server, category) to PageRank

// http://stackoverflow.com/questions/9229645/remove-duplicates-from-javascript-array
var unique = function(a) {
    var seen = {};
    return a.filter(function(item) {
        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
    });
};

/**
 * Client: Your standard Discord Client.
 */
var Client = null;
/**
 * Standard sending functions.
 */
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
/**
 * New commands
 */
module.exports.commands.push({
    word: "recommend",
    description: "Recommend someone in a category. Use: ~M~recommend some_category \"username0#discriminator0 \"username1#discriminator1 \"username2#discriminator2 ...",
    execute: function(message, parsedMessage) {
        var guild = message.guild;
        var tokens = parsedMessage.split(/ "/g);
        var category = tokens[0];
        var user = message.author.id;
        // check if the pageRank has already existed
        var pageRank = pageRanks[getFileName(guild.id, category)];
        if (!pageRank) {
            pageRank = pageRanks[getFileName(guild.id, category)] = new PageRank();
            pageRank.parseFileSafe(guild, category).then(function() {
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
            pageRank.addRoles();
            console.log("Done iterations.");
            console.log(pageRank.adjList[user]);
            sendDM(message, "Updated recommendations.");
            console.log(pageRank.adjList[user]);
        }
    }
}, {
    word: "unrecommend",
    description: "Unrecommend someone in a category. Use: ~M~unrecommend some_category \"username0#discriminator0 \"username1#discriminator1 \"username2#discriminator2 ...",
    execute: function(message, parsedMessage) {
        var guild = message.guild;
        var tokens = parsedMessage.split(/ "/g);
        var category = tokens[0];
        var user = message.author.id;
        // check if the pageRank has already existed
        var pageRank = pageRanks[getFileName(guild.id, category)];
        if (!pageRank) {
            pageRank = pageRanks[getFileName(guild.id, category)] = new PageRank();
            pageRank.parseFileSafe(guild, category).then(function() {
                // do the update
                user = pageRank.userIdMap[user];
                for (var i=1;i<tokens.length;i++) {
                    var index = pageRank.userNames.indexOf(tokens[i].replace(/\\"/g, "\""));
                    if (index !== -1) index = pageRank.adjList[user].indexOf(index);
                    if (index !== -1) pageRank.adjList[user].splice(index, 1);
                }
                pageRank.iterate(10);
                pageRank.addRoles();
                sendDM(message, "Updated recommendations.");
            }).catch(function() {
                console.log("Failed to unrecommend.");
            });
        } else {
            // do the update
            user = pageRank.userIdMap[user];
            for (var i=1;i<tokens.length;i++) {
                var index = pageRank.userNames.indexOf(tokens[i].replace(/\\"/g, "\""));
                if (index !== -1) index = pageRank.adjList[user].indexOf(index);
                if (index !== -1) pageRank.adjList[user].splice(index, 1);
            }
            pageRank.iterate(10);
            pageRank.addRoles();
            sendDM(message, "Updated recommendations.");
        }
    }
}, {
    word: "viewrecommends",
    description: "View your recommendations in a category. Use: ~M~viewrecommends some_category",
    execute: function(message, parsedMessage) {
        var guild = message.guild;
        var tokens = parsedMessage.split(" ");
        var category = tokens[0];
        var user = message.author.id;
        // check if the pageRank has already existed
        var pageRank = pageRanks[getFileName(guild.id, category)];
        if (!pageRank) {
            pageRank = pageRanks[getFileName(guild.id, category)] = new PageRank();
            pageRank.parseFileSafe(guild, category).then(function() {
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
    word: "addcategory",
    description: "[MODERATOR] Add a category. Use: ~M~addcategory some_category",
    execute: function(message, parsedMessage) {
        var roles = message.member.roles;
        if (roles.find("name", "Moderator")) { // if I can find a moderator role
            var guild = message.guild;
            var pageRank = pageRanks[getFileName(guild.id, parsedMessage)];
            if (!pageRank) {
                pageRank = pageRanks[getFileName(guild.id, parsedMessage)] = new PageRank();
                pageRank.parseFile(guild, parsedMessage).then(function() {
                    sendDM(message, "Created category, or added category to cache.");
                }).catch(function() {
                    console.log("Failed to add category.");
                    delete pageRanks[getFileName(guild.id, parsedMessage)];
                });
            } else {
                sendDM(message, "Category already exists.");
            }
        } else {
            sendDM(message, "Sorry, you are not a moderator.");
        }
    }
}, {
    word: "deletecategory",
    description: "[MODERATOR] Delete a category. Use: ~M~deletecategory some_category",
    execute: function(message, parsedMessage) {
        var roles = message.member.roles;
        if (roles.find("name", "Moderator")) { // if I can find a moderator role
            var guild = message.guild;
            var fileName = getFileName(guild.id, parsedMessage);
            var pageRank = pageRanks[fileName];
            if (!pageRank) {
                pageRank = pageRanks[fileName] = new PageRank();
                pageRank.parseFile(guild, parsedMessage).then(function() {
                    fs.unlink(__dirname + "/" + fileName, function(err) {
                        if (err) {
                            console.log("Failed to delete file.");
                        } else {
                            console.log("Deleted "+fileName);
                            sendDM(message, "Deleted category.");
                        }
                    });
                    pageRank.role.delete();
                    delete pageRanks[fileName];
                }).catch(function() {
                    console.log("Failed to delete category (already deleted).");
                    delete pageRanks[fileName];
                });
            } else {
                fs.unlink(__dirname + "/" + fileName, function(err) {
                    if (err) {
                        console.log("Failed to delete file.");
                    } else {
                        console.log("Deleted "+fileName);
                        sendDM(message, "Deleted category.");
                    }
                });
                pageRank.role.delete();
                delete pageRanks[fileName];
            }
        }
    }
}, {
    word: "viewcategories",
    description: "View all categories on the current server. Use: ~M~viewcategories",
    execute: function(message, parsedMessage) {
        var guildID = message.guild.id;
        fs.readdir(__dirname, function(err, files) {
            if (err) {
                return;
            }
            // files is array of names of files in directory
            var categories = {};
            for (var i=0;i<files.length;i++) {
                if (files[i].startsWith("PageRankRecommendFile"+guildID)) {
                    var category = files[i].slice(("PageRankRecommendFile"+guildID).length, -4);
                    categories[category] = true;
                }
            }
            for (var i in pageRanks) {
                if (pageRanks[i].server.id == guildID) {
                    categories[pageRanks[i].category] = true;
                }
            }
            var result = "Here is the list of categories on "+message.guild.name+":";
            for (var i in categories) {
                result += "\n" + i;
            }
            sendDM(message, result);
        });
    }
}, {
    word: "viewcategory",
    description: "View the top users in a particular category. Use: ~M~viewcategory some_category num_users",
    execute: function(message, parsedMessage) {
        var guild = message.guild;
        var tokens = parsedMessage.split(" ");
        var category = tokens[0];
        var numUsers = tokens[1] || 10; // default: 10
        var user = message.author.id;
        // check if the pageRank has already existed
        var pageRank = pageRanks[getFileName(guild.id, category)];
        if (!pageRank) {
            pageRank = pageRanks[getFileName(guild.id, category)] = new PageRank();
            pageRank.parseFile(guild, category).then(function() {
                pageRank.iterate(10); // to be safe
                pageRank.addRoles();
                console.log("Done iterations.");
                var selectedUsers = [];
                for (var i=0;i<pageRank.users.length;i++) {
                    if (selectedUsers.length < numUsers) {
                        selectedUsers.push(i);
                    } else {
                        // TODO: Increase efficiency later
                        selectedUsers.sort(function(a, b) {
                            return pageRank.ranks[a]-pageRank.ranks[b];
                        });
                        if (pageRank.ranks[selectedUsers[0]] < pageRank.ranks[i]) {
                            selectedUsers[0] = i;
                        }
                    }
                }
                selectedUsers.sort(function(a, b) {
                    return pageRank.ranks[a]-pageRank.ranks[b];
                });
                result = "Here are the top "+numUsers+" in category \""+category+"\" in the server \""+guild.name+"\"";
                for (var i=selectedUsers.length-1;i>=0;i--) {
                    result += "\n" + pageRank.ranks[selectedUsers[i]].toFixed(3) + "\t" + pageRank.userNames[selectedUsers[i]] 
                }
                sendDM(message, result);
            }).catch(function() {
                console.log("Failed to view top users.");
            });
        } else {
            pageRank.iterate(10); // to be safe
            pageRank.addRoles();
            console.log("Done iterations.");
            var selectedUsers = [];
            for (var i=0;i<pageRank.users.length;i++) {
                if (selectedUsers.length < numUsers) {
                    selectedUsers.push(i);
                } else {
                    // TODO: Increase efficiency later
                    selectedUsers.sort(function(a, b) {
                        return pageRank.ranks[a]-pageRank.ranks[b];
                    });
                    if (pageRank.ranks[selectedUsers[0]] < pageRank.ranks[i]) {
                        selectedUsers[0] = i;
                    }
                }
            }
            selectedUsers.sort(function(a, b) {
                return pageRank.ranks[a]-pageRank.ranks[b];
            });
            result = "Here are the top "+numUsers+" in category \""+category+"\" in the server \""+guild.name+"\"";
            for (var i=selectedUsers.length-1;i>=0;i--) {
                result += "\n" + pageRank.ranks[selectedUsers[i]].toFixed(3) + "\t" + pageRank.userNames[selectedUsers[i]] 
            }
            sendDM(message, result);
        }
    }
});

module.exports.initialise = function(client) {
    Client = client;
    Client.on("guildMemberRemove", function(guildMember) {
        // Loop through all the guilds
        var user = guildMember.user;
        for (var i in pageRanks) {
            if (pageRanks[i].server.id == guildMember.guild.id) {
                // Replace member with last member
                var removeUser = pageRanks[i].userIdMap[user.id];
                pageRanks[i].removeUser(removeUser);
            }
        }
    });
    Client.on("guildMemberAdd", function(guildMember) {
        // Loop through all the guilds
        var user = guildMember.user;
        for (var i in pageRanks) {
            if (pageRanks[i].server.id == guildMember.guild.id) {
                // Add member
                pageRanks[i].users.push(user.id);
                pageRanks[i].userNames.push(user.username+"#"+user.discriminator);
                pageRanks[i].ranks.push(0);
                pageRanks[i].adjList.push([]);
                pageRanks[i].userIdMap[user.id] = pageRanks[i].users.length-1;
                pageRanks[i].iterate(10);
                pageRank.addRoles();
            }
        }
    });
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
