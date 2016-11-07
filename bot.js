var Discord = require("discord.js");
var fs = require("fs");
var request = require("request");
var zeroWidthSpace = "\u200b"; // at front of safe bot things
var token = "";
var Command, commands;
// get token from other file
fs.readFile(__dirname + "/token.txt", "utf8", function(err, data) {
    if (err) {
        return console.log(err);
    }
    token = data;
    console.log("Obtained token!");
    bot.login(token).then(function() {
        console.log("Logged in!");
        bot.on("message", function(message) {
            detectCommand(message);
        });
        bot.user.setStatus("online", "with GitHub", function(err) {
            console.log("Failed to play on GitHub.");
        });
    }).catch(function(err) {
        console.log("Cannot log in!");
        console.log(err);
    });
});

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

/** Github interaction **/
var githubToken = "";
var modules = [];
var checkModules = [];
var apiString = function(user, repo, file) {
    return "https://api.github.com/repos/"+user+"/"+repo+"/contents/"+file+"?access_token="+gitHubToken;
};
var getFileName = function(user, repo, file) {
    if (!file.endsWith(".js")) file += ".js"; // slightly safer
    return "module "+user+" "+repo+" "+file;
};
var runModule = function(fileName, message) {
    try {
        var module = require("./"+fileName.slice(0, -3)); // remove.js
        console.log(module);
        modules.push(module);
        for (var i in module) {
            console.log("Found "+i);
        }
        if (module.initialise) {
            module.initialise(bot);
        } else if (module.initialize) {
            module.initialize(bot);
        }
        if (module.commands) {
            for (var i=0;i<module.commands.length;i++) {
                console.log("New command: " + module.commands[i].word);
                commands.push(new Command(module.commands[i]));
            }
        }
        commands.sort(function(a, b) {
            if (a.word < b.word) return -1;
            if (a.word > b.word) return 1;
            return 0;
        });
        if (message) {
            send(message, "Loaded module!");
        } else {
            console.log("Loaded module!");
        }
    } catch (error) {
        console.log(error);
        if (message) {
            send(message, "The module seems to have a problem.");
        } else {
            console.log("The module seems to have a problem.");
        }
    }
};

// get list of modules to load on startup
fs.readFile(__dirname + "/autoload.txt", "utf8", function(err, data) {
    if (err) {
        return console.log(err);
    }
    var tokens = data.split("\n");
    for (var i=0;i<tokens.length;i++) {
        if (tokens[i] !== "") {
            runModule(tokens[i]);
        }
    }
});

var loadModule = function(message, user, repo, file) {
    fileName = getFileName(user, repo, file);
    apiCall = apiString(user, repo, file);
    request({
        url: apiCall,
        headers: {
            "User-Agent": "Element118"
        }
    }, function(error, response, body) {
        if (error) {
            console.log("API call error!");
            console.log(error);
            return;
        }
        if (response.statusCode === 200) {
            var info = JSON.parse(body);
            var program = new Buffer(info.content, "base64");
            fs.writeFile(__dirname + "/" + fileName, program, function(error) {
                if (error) {
                    console.log(error);
                    return;
                }
                checkModules.push({
                    fileName: fileName,
                    message: message,
                    content: program.toString("ascii")
                });
                console.log("New module!");
            });
        }
    });
};
var currentModule = -1;
process.stdin.on("data", function(data) {
    data = (data+"").trim();
    if (data == "exit" || data == "logout") {
        console.log("Trying to save data...");
        var modulesDone = 0;
        for (var i=0;i<modules.length;i++) {
            if (modules[i].close) {
                var p = modules[i].close(); // expect Promise
                if (p) {
                    p.then(function() {
                        modulesDone++;
                        if (modulesDone === modules.length) {
                            console.log("All modules completed!");
                            process.exit();
                        }
                    }).catch(function(err) {
                        console.log(err);
                        modulesDone++;
                        if (modulesDone === modules.length) {
                            console.log("All modules completed!");
                            process.exit();
                        }
                    });
                } else {
                    modulesDone++;
                }
            } else {
                modulesDone++;
            }
        }
        if (modulesDone === modules.length) {
            console.log("All modules completed!");
            process.exit();
        }
    } else if (data.startsWith("checkmodules ")) {
        var num = data.substr("checkmodules ".length)%checkModules.length;
        if (0 <= num && num < checkModules.length) {
            currentModule = num;
            console.log(checkModules[currentModule].content);
        } else {
            currentModule = -1;
            console.log("Cannot parse number, or no modules found.");
        }
    } else if (data === "verify") {
        runModule(checkModules[currentModule].fileName, checkModules[currentModule].message);
        checkModules.splice(currentModule, 1);
        currentModule = -1;
    } else if (data === "disapprove") {
        checkModules.splice(currentModule, 1);
        currentModule = -1;
    } else if (data === "allmodules") {
        console.log("Here are all the modules:");
        for (var i=0;i<modules.length;i++) {
            console.log(modules[i].name);
        }
    } else {
        console.log("Noted "+data.length+" characters: \""+data+"\".");
    }
});

var bot = new Discord.Client();
Command = function(config) {
    this.word = config.word;
    this.execute = config.execute || function(message, parsedMessage) { send(message, "Not implemented yet."); };
    this.description = config.description || "No description available."
};
Command.prefix = "~M~";
Command.check = function(command) {
    return command.startsWith(Command.prefix);
};
var parseTime = function(milliseconds) {
    var seconds = Math.floor(milliseconds/1000); milliseconds %= 1000;
    var minutes = Math.floor(seconds/60); seconds %= 60;
    var hours = Math.floor(minutes/60); minutes %= 60;
    var days = Math.floor(hours/24); hours %= 24;
    var written = false;
    return (days?(written=true,days+" days"):"")+(written?", ":"")
        +(hours?(written=true,hours+" hours"):"")+(written?", ":"")
        +(minutes?(written=true,minutes+" minutes"):"")+(written?", ":"")
        +(seconds?(written=true,seconds+" seconds"):"")+(written?", ":"")
        +(milliseconds?milliseconds+" milliseconds":"");
};

fs.readFile(__dirname + "/githubtoken.txt", "utf8", function(err, data) {
    if (err) {
        return console.log(err);
    }
    gitHubToken = data;
    console.log("Obtained GitHub token!");
});

commands = [
    new Command({
        word: "help",
        description: "Need help?",
        execute: function(message, parsedMessage) {
            if (parsedMessage === "") {
                var helpText = "Here are the commands you can use:\n```";
                helpText += Command.prefix + commands[0].word;
                for (var i=1;i<commands.length;i++) {
                    helpText += ", " + Command.prefix + commands[i].word;
                }
                helpText += "```\nSay `"+Command.prefix+"help command` to get help about a specific command.";
                sendDM(message, helpText); // send help as DM
            } else {
                for (var i=0;i<commands.length;i++) {
                    if (parsedMessage === commands[i].word) {
                        sendDM(message, Command.prefix + commands[i].word + ": " + commands[i].description);
                        return; // done
                    }
                }
                // command not found
                sendDM(message, "Sorry. I do not know that command.");
            }
        }
    }), new Command({
        word: "uptime",
        description: "I'm just waiting...",
        execute: function(message, parsedMessage) {
            send(message, "I have existed here continually for "+parseTime(bot.uptime));
        }
    }), new Command({
        word: "author",
        description: "Of course Element118 programmed me.",
        execute: function(message, parsedMessage) {
            sendDM(message, "Visit their profile here: https://www.khanacademy.org/profile/Element118"
                +"\nAlso, you can subscribe here: https://www.khanacademy.org/computer-programming/-/4642089130393600");
        }
    }), new Command({
        word: "github",
        description: "Oh, you want to know more about me? I'm flattered...",
        execute: function(message, parsedMessage) {
            sendDM(message, "Visit me on GitHub: https://github.com/Element118/metabotic-discord");
        }
    }), new Command({
        word: "addmodule",
        description: "Design a bot!",
        execute: function(message, parsedMessage) {
            var tokens = parsedMessage.split(" ");
            if (tokens.length >= 3) {
                var user = tokens[0], repo = tokens[1], file = tokens.slice(2).join(" ");
                loadModule(message, user, repo, file);
            } else {
                send(message, "The command expects 3 arguments, GitHub username, name of repository, file name.");
            }
        }
    })
];
commands.sort(function(a, b) {
    if (a.word < b.word) return -1;
    if (a.word > b.word) return 1;
    return 0;
});

var detectCommand = function(message) {
    var tokens = message.content.split(" ");
    var commandSpaces = Command.prefix.length - Command.prefix.replace(" ", "").length;
    var instruction = tokens.slice(0, commandSpaces+1).join(" ");
    if (!Command.check(instruction)) return;
    var restOfMessage = tokens.slice(commandSpaces+1).join(" ");
    for (var i=0;i<commands.length;i++) {
        if (instruction === Command.prefix + commands[i].word) {
            commands[i].execute(message, restOfMessage);
            return true;
        }
    }
    send(message, "Sorry, that was not a valid command.");
    return false;
};
