import {Lobby} from "./Lobby";
import {User} from "./User";
import {PokerAPI} from "../pokerapi/PokerAPI";
import {
  JoinLobbyRequest,
  JoinLobbyResponse,
  GetLobbiesResponse,
  LobbyPreview,
  CreateLobbyRequest
} from "../pokerapi/messages/ApiObjects";
import {plainToClass} from "class-transformer";

export let lobbies = new Map<string, Lobby>();
export let users = new Map<number, User>();
export let api: PokerAPI;

export function startGame(pokerServer: PokerAPI) {
  api = pokerServer;

  console.log("Registering listeners...");
  registerListeners();
  console.log("Server application ready!")

}

function registerListeners() {

  //internal calls
  api.on("new_user", (id: number) => {
    users.set(id, {id: id})
  });

  api.on("drop_user", (id) => {
    users.delete(id);
  });

  //external PokerMessages
  api.on("get_lobbies", (id) => {

    let response = new GetLobbiesResponse();
    response.lobbies = new Array<LobbyPreview>();
    Object.values(lobbies).forEach((lobby: Lobby) => {
      if (!lobby.hidden) response.lobbies.push(lobby.apiLobbyPreview());
    });
    api.sendMessage(id, "get_lobbies", response);
  });

  api.on("join_lobby", (id, req) => {

    req = plainToClass(JoinLobbyRequest, req);
    if (!PokerAPI.validateObject(req)) return;

    let response = new JoinLobbyResponse();
    if (!lobbies.has(req.id)) {
      response.success = false;
      response.reason = "unknown_id";
    } else {
      let lobby = lobbies.get(req.id);
      if (lobby.players.length == lobby.maxPlayers) {
        response.success = false;
        response.reason = "full";
      } else {
        response.success = true;
        response.lobby = lobby.apiLobby(id);
      }
    }
    api.sendMessage(id, "join_lobby", response);
  });

  api.on("create_lobby", (id, req) => {

    req = plainToClass(CreateLobbyRequest, req);
    if (!PokerAPI.validateObject(req)) return;

  });

}

export function stopGame() {

}