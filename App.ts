import "reflect-metadata";
import {PokerServer} from "./pokerapi/PokerServer";
import * as Game from "./src/Game"

const version = "v1.0";

console.log("=== Owatz Poker Server " + version + " ===");
console.log("===============================\n");

let port: number;
if (typeof process.env.PORT === "undefined") {
  console.log("Port not set. Using 8080 as default. Use env PORT to set!");
  port = 8080;
} else {
  port = Number.parseInt(process.env.PORT);
}
let allowedHost: string;
if (typeof process.env.ALLOWED_HOST === "undefined") {
  console.log("No allowed hosts set. Allowing all hosts. This is not advised. Please use env ALLOWED_HOST to set!");
  allowedHost = "";
} else {
  allowedHost = process.env.ALLOWED_HOST;
}
let maxConnections:number;
if (typeof process.env.PORT === "undefined") {
  console.log("Max. connections not set. Using 1000 as default. Use env MAX_CONNECTIONS to set!");
  maxConnections = 1000;
} else {
  maxConnections = Number.parseInt(process.env.MAX_CONNECTIONS);
}

Game.startGame(new PokerServer(port, maxConnections));

process.on('SIGTERM', function() {
  console.log("Received SIGTERM. Stopping server...");
  Game.stopGame();
});