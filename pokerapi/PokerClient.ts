import {client as WebSocketClient, connection} from "websocket";
import {EventEmitter} from "events";
import {deserialize, serialize} from "class-transformer";
import {
  ClientCommand,
  ClientMessage,
  Command,
  PokerMessage,
  ServerMessage
} from "./messages/PokerMessage";

export class PokerClient extends EventEmitter {

  wsClient: WebSocketClient;
  private connection: connection;

  constructor(public address: string, public autoReconnect=false) {
    super();
    this.wsClient = new WebSocketClient();

    this.registerListeners();
    this.wsClient.connect(address, "poker1");
  }

  private registerListeners() {

    this.wsClient.on("connect", (connection) => {

      this.connection = connection;
      this.emit("ready");

      //pipe incoming messages trough
      connection.on("message", (data) => {
        let message = deserialize(ServerMessage, data.utf8Data);
        this.emit(message.command, message.data);
      });

      connection.on("error", (err) => {
        this.emit("error", err);
      });

      connection.on("close", () => {
        this.emit("close");
        if (this.autoReconnect) {
          setTimeout(() => this.wsClient.connect(this.address, "poker1"), 3000);
        }
      });
    });

    this.wsClient.on("connectFailed", (err) => {
      this.emit("failed", err);
      if (this.autoReconnect) {
        setTimeout(() => this.wsClient.connect(this.address, "poker1"), 3000);
      }
    });
  }

  public sendMessage(command: ClientCommand | Command, message?: PokerMessage) {

    let cm:ClientMessage = {
      command: command,
      data:message
    };
    this.connection.sendUTF(serialize(cm));
  }

  public sendMessageCall(command: ClientCommand | Command, callback: (message?: PokerMessage) => void, message?: PokerMessage) {
    this.sendMessage(command, message);
    this.once(command, (response: PokerMessage) => {
      callback(response);
    })
  }
}