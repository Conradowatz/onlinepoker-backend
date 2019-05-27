import {Lobby} from "./Lobby";
import {PokerServer} from "../pokerapi/PokerServer";
import {
  JoinLobbyRequest,
  JoinLobbyResponse,
  GetLobbiesResponse,
  LobbyPreview,
  CreateLobbyRequest, DisconnectEvent
} from "../pokerapi/messages/ApiObjects";

export let lobbies = new Map<string, Lobby>();
export let api: PokerServer;

export function startGame(pokerServer: PokerServer) {
  api = pokerServer;

  console.log("Registering listeners...");
  registerListeners();
  console.log("Server application ready!")

}

function registerListeners() {

  api.on("get_lobbies", (id) => {

    let response = new GetLobbiesResponse();
    response.lobbies = new Array<LobbyPreview>();
    console.log(lobbies);
    for (let [lid, lobby] of lobbies) {
      if (!lobby.hidden) response.lobbies.push(lobby.apiLobbyPreview());
    }
    api.sendMessage(id, "get_lobbies", response);
  });

  api.on("join_lobby", (id, req: JoinLobbyRequest) => {

    let response = new JoinLobbyResponse();
    //check if lobby exists
    if (!lobbies.has(req.id)) {
      response.success = false;
      response.reason = "unknown_id";
    } else {
      //check if it has free slots
      let lobby = lobbies.get(req.id);
      if (lobby.players.size == lobby.maxPlayers) {
        response.success = false;
        response.reason = "full";
      } else {
        //perform join
        if (req.spectate) {
          lobby.spectate(id);
        } else {
          lobby.join(id, req.playerName);
        }

        //respond
        response.success = true;
        response.lobby = lobby.apiLobby(id);
      }
    }
    api.sendMessage(id, "join_lobby", response);
  });

  api.on("create_lobby", (id, req: CreateLobbyRequest) => {
    let lobby = new Lobby(getRandomLobbyId(), {id: id}, req.name, req.hidden);
    lobby.join(id, req.playerName);
    lobbies.set(lobby.id, lobby);
    api.sendMessage(id, "create_lobby", lobby.apiLobby(id));
  });

}

function deleteLobby(id: string) {
  lobbies.delete(id);
}

function getRandomLobbyId():string {
  let result: string;
  do {
    result = "";
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 10; i++) {
      result += characters.charAt(Math.floor(Math.random() * 62));
    }
  } while (lobbies.has(result));
  return result;
}

export function stopGame() {
  let e = new DisconnectEvent();
  e.reason = "Server shutting down.";
  api.broadcastMessage("disconnect", e);
}