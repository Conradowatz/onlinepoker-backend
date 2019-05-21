export interface LobbyList {
  lobbies: LobbyListItem[]
}
export interface LobbyListItem {
  name: string,
  id: string,
  currentPlayers: number,
  maxPlayers: number
}