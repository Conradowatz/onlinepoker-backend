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
    for (let [lid, lobby] of lobbies) {
      if (!lobby.hidden) response.lobbies.push(lobby.apiLobbyPreview());
    }
    api.sendMessage(id, "get_lobbies", response);
  });

  api.on("join_lobby", (id, req: JoinLobbyRequest) => {

    let response = new JoinLobbyResponse();
    response.success = false;
    //check if lobby exists
    if (!lobbies.has(req.id)) {
      response.reason = "unknown_id";
    } else {
      let lobby = lobbies.get(req.id);
      //perform join
      let success = api.moveUserToLobby(id, lobby.id);
      if (success) {
        if (req.spectate) {
          response.success = true;
          lobby.spectate(id);
        } else {
          //check if it has free slots
          if (lobby.players.size == lobby.gameMode.getMaxPlayers()) {
            response.reason = "full";
          } else if (!lobby.gameMode.isJoinable()) {
            response.reason = "not_joinable";
          } else {
            response.success = true;
            lobby.join(id, req.playerName);
          }
        }
      } else {
        response.reason = "in_other_lobby";
      }

      //respond
      response.lobby = lobby.apiLobby(id);

    }
    api.sendMessage(id, "join_lobby", response);
  });

  api.on("create_lobby", (id, req: CreateLobbyRequest) => {
    let lobby = new Lobby(getRandomLobbyId(), {id: id}, req.name, req.hidden);
    let success = api.moveUserToLobby(id, lobby.id);
    if (!success) return; //TODO make error message
    lobby.join(id, req.playerName);
    lobbies.set(lobby.id, lobby);
    api.sendMessage(id, "create_lobby", lobby.apiLobby(id));
  });

}

export function deleteLobby(id: string) {
  //remove spectators
  lobbies.get(id).spectators.forEach((s) => api.removeUserFromLobby(id, s.id)); //TODO notify them they got kicked
  //delete lobby
  lobbies.delete(id);
  api.unregisterLobby(id);
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