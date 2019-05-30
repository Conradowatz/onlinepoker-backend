import {EventEmitter} from "events";
import {Server as HttpServer} from "http";
import {connection, request, server as WebSocketServer} from "websocket";
import * as http from "http";
import * as PokerMessage from "./messages/PokerMessage";
import {plainToClass, serialize} from "class-transformer";
import {
  Command,
  ServerMessage,
  ClientMessage,
  ServerCommand,
  ClientCommand
} from "./messages/PokerMessage";
import {validateSync, ValidatorOptions} from "class-validator";
import {
  ChangeGameModeRequest, ChatOut,
  CreateLobbyRequest,
  JoinLobbyRequest,
  Settings, THAction,
  THSettings
} from "./messages/ApiObjects";

export class PokerServer extends EventEmitter {

  static protocol = "poker1";

  httpServer: HttpServer;
  wsServer: WebSocketServer;
  idConnectionMap = new Map<number, connection>();
  connectionIdMap = new Map<connection, number>();
  playerLobbyMap = new Map<number, string>();
  lobbyEmitterMap = new Map<string, EventEmitter>();

  constructor(public port: number, public maxConnections = 1000) {
    super();
    //create https backend server
    this.httpServer = http.createServer(((req, res) => {
      res.writeHead(404);
      res.end();
    }));
    this.httpServer.listen(port, () =>
        console.log('Server is listening on port ' + port));

    //create underlying ws server
    this.wsServer = new WebSocketServer({
      httpServer: this.httpServer,
      autoAcceptConnections: false
    });
    this.wsServer.on("request", (request => this.onRequest(request)))
  }

  /**
   * Accepts or rejects incoming connections.
   * Sets them up to emit events to the corresponding functions.
   * @param request
   */
  private onRequest(request: request) {
    //don't allow all connections
    if (!PokerServer.originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log('Connection from origin ' + request.origin + ' rejected.');
      return;
    }

    //check for maximum connections
    if (this.wsServer.connections.length >= this.maxConnections) {
      request.reject();
      console.log('Connection rejected. Too many active connections.');
      return;
    }

    //accept with protocol number
    if (!request.requestedProtocols.includes(PokerServer.protocol)) {
      request.reject();
      console.log('Connection with unknown protocol rejected.');
      return;
    }
    let connection = request.accept(PokerServer.protocol, request.origin);
    console.log((new Date()) + ' New connection accepted from: ' + connection.socket.localAddress);
    this.onNewConnection(connection);

    //listen to incoming messages
    connection.on("message", (message => {
      if (message.type === "utf8") {
        this.onMessage(connection, message.utf8Data);
      }
      //ignore other messages
    }));

    //handle closing
    connection.on("close", (code, desc) => this.onClose(connection, code, desc));
  }

  /**
   * Checks whether connection is allowed from the specified url.
   * @param origin a url of the form "http://server.tdl/"
   */
  private static originIsAllowed(origin: string): boolean {
    return true;
  }

  /**
   * Assigns a unique id to every connection and calls listeners of the
   * event "new_user" with it.
   * @param connection
   */
  private onNewConnection(connection: connection) {
    //determine unique id
    let id = Math.floor(Math.random() * this.maxConnections);
    while (this.idConnectionMap.has(id)) {
      id = (id + 1) % this.maxConnections;
    }
    //add to map
    this.idConnectionMap.set(id, connection);
    this.connectionIdMap.set(connection, id);
    //emit event
    this.emit("new_user", id);
  }

  /**
   * Handles incoming messages, passing them to listeners if correctly formatted.
   * @param connection
   * @param message
   */
  private onMessage(connection: connection, message: string) {
    let plainMessageObject;
    try {
      plainMessageObject = JSON.parse(message);
    } catch (e) {
      console.log(e);
      console.log("Received non-JSON message.");
      return;
    }
    let clientMessage = plainToClass(ClientMessage, plainMessageObject);
    //check if its a valid message
    if (PokerServer.validateObject(clientMessage)
        && PokerServer.validateMessage(clientMessage.command, clientMessage.data)) {

      let playerId = this.connectionIdMap.get(connection);
      //send out global api call
      this.emit(clientMessage.command, playerId, clientMessage.data);
      //send out lobby calls
      this.emitLobby(clientMessage.command, playerId, clientMessage.data);

    } else {
      console.log("Received malformed message, ignoring.");
    }
  }

  private emitLobby(command: Command | ClientCommand | "drop_user", playerId: number, message?: PokerMessage.PokerMessage) {
    let lobbyId = this.playerLobbyMap.get(playerId);
    if (lobbyId != undefined) {
      let emitter = this.lobbyEmitterMap.get(lobbyId);
      if (emitter != undefined) {
        emitter.emit(command, playerId, message);
      }
    }
  }

  public moveUserToLobby(playerId: number, lobbyId: string) {
    this.playerLobbyMap.set(playerId, lobbyId);
  }

  public onLobby(lobbyId: string, command: Command | ClientCommand | "drop_user", callback: (id: number, message?: PokerMessage.PokerMessage) => void) {
    let emitter = this.lobbyEmitterMap.get(lobbyId);
    if (emitter == undefined) {
      emitter = new EventEmitter();
      this.lobbyEmitterMap.set(lobbyId, emitter);
    }
    emitter.on(command, callback);
  }

  public unregisterLobby(lobbyId: string) {
    this.lobbyEmitterMap.delete(lobbyId);
  }

  public removePlayerFromLobby(lobbyId: string, playerId: number) {
    this.playerLobbyMap.delete(playerId);
  }

  private onClose(connection: connection, reasonCode: number, description: string) {
    //get user id
    let id = this.connectionIdMap.get(connection);
    //emit global event
    this.emit("drop_user", id);
    //emit lobby event
    this.emitLobby("drop_user", id);
    this.connectionIdMap.delete(connection);
    this.idConnectionMap.delete(id);
    this.playerLobbyMap.delete(id);

    console.log("User disconnected. Code: " + reasonCode + " Desc: " + description);
  }

  public sendMessage(id: number, command: Command | ServerCommand, message: PokerMessage.PokerMessage) {
    let m = new ServerMessage();
    m.command = command;
    m.data = message;
    this.idConnectionMap.get(id).sendUTF(serialize(m));
  }

  public sendMessageCall(id: number, command: Command | ServerCommand, message: PokerMessage.PokerMessage,
                         callback: (data: PokerMessage.PokerMessage) => void) {
    this.sendMessage(id, command, message);
    //wait for response with the same command from the same user and pass it to callback
    let pokerAPI = this;
    let listener = function(r_id: number, ...r_args) {
      if (r_id === id) {
        callback(r_args);
        //deregister once its fired
        pokerAPI.off(command, this);
      }
    };
    this.on(command, listener);
  }

  public broadcastMessage(command: Command | ServerCommand, message: PokerMessage.PokerMessage) {
    let m = new ServerMessage();
    m.command = command;
    m.data = message;
    this.wsServer.connections.forEach((c) => {
      c.sendUTF(serialize(m));
    })
  }

  private static validatorOptions: ValidatorOptions = {
    forbidUnknownValues: true,
    skipMissingProperties: false
  };

  private static validateObject(o) {
    let errors = validateSync(o, this.validatorOptions);
    if (errors.length>0) {
      console.log(errors);
      return false;
    } else {
      return true;
    }
  }

  private static validateMessage(command: Command | ClientCommand, message: PokerMessage.PokerMessage):boolean {
    switch (command) {
      case "get_lobbies":
      case "start_game":
      case "leave_lobby":
        return message == undefined;
      case "join_lobby": return PokerServer.validateObject(plainToClass(JoinLobbyRequest, message));
      case "create_lobby": return PokerServer.validateObject(plainToClass(CreateLobbyRequest, message));
      case "change_gamemode": return PokerServer.validateObject(plainToClass(ChangeGameModeRequest, message));
      case "change_settings":
        let s = plainToClass(Settings, message);
        if (PokerServer.validateObject(s)) {
          switch (s.gameMode) {
            case "texasholdem":
              return PokerServer.validateObject(plainToClass(THSettings, message))
            default:
              return false
          }
        } else return false;
      case "chat_out": return PokerServer.validateObject(plainToClass(ChatOut, message));
      case "th_action": return PokerServer.validateObject(plainToClass(THAction, message));
      default: return false;
    }

  }

}