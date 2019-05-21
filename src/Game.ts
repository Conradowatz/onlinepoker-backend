import {Lobby} from "./Lobby";
import {User} from "./User";
import {PokerAPI} from "../pokerapi/PokerAPI";
import {LobbyList, LobbyListItem} from "../pokerapi/messages/ApiObjects";

export let lobbies = new Map<string, Lobby>();
export let users = new Map<number, User>();
export let api: PokerAPI;

export function startGame(pokerserver: PokerAPI) {
    api = pokerserver;
    console.log("Server ready and started.")
}

api.on("new_user", (id: number) => {
  users.set(id, {id: id})
});

api.on("drop_user", (id) => {
  users.delete(id);
});

api.on("get_lobbies", (id) => {
  let response: LobbyList = {
    lobbies: new Array<LobbyListItem>()
  };
  Object.values(lobbies).forEach((lobby: Lobby) => {
    if (!lobby.hidden) response.lobbies.push(lobby.toLobbyListItem());
  });
  api.sendMessage(id, "get_lobbies", response);
});