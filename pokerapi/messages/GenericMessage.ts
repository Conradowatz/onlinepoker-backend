namespace PokerMessages {
  export interface GenericMessage {
    command: string;
    data: Message;
  }

  export let commands = [
      "join_lobby"
  ]
}