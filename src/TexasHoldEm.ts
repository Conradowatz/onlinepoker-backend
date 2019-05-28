import {GameMode} from "./GameMode";
import {TexasHoldEmSettings} from "../pokerapi/messages/ApiObjects";
import {Lobby} from "./Lobby";
import {api} from "./Game";

export class TexasHoldEm extends GameMode {

  options: TexasHoldEmOptions;
  running: boolean;

  constructor(public lobby: Lobby) {
    super();

    this.running = false;
    this.registerListeners();
  }

  getName(): string {
    return "Texas Hold'em";
  }

  getMaxPlayers(): number {
    return 6;
  }

  isRunning(): boolean {
    return this.running;
  }

  isJoinable(): boolean {
    return !this.running;
  }

  startGame(): void {

  }

  private registerListeners() {

    api.on("start_game"+this.lobby.id, (id: number) => {
      //check for permissions
      if (id != this.lobby.leader.id || this.running) return;

      this.startGame();
    });

    api.on("change_settings", (id: number, req: TexasHoldEmSettings) => {
      //check for permissions
      if (id != this.lobby.leader.id || this.running) return;
      //change to desired options
      this.options.blinds = req.blinds;
      this.options.useSidepots = req.useSidepots;
      this.options.turnTime = req.turnTime;
      this.options.maxPlayers = req.maxPlayers;
      this.options.startMoney = req.startMoney;
      //notify members
      this.lobby.sendLobbyUpdate()
    });
  }

  apiSettings(): TexasHoldEmSettings {
    return {
      gameMode: "texasholdem",
      maxPlayers: this.getMaxPlayers(),
      startMoney: this.options.startMoney,
      turnTime: this.options.turnTime,
      useSidepots: this.options.useSidepots,
      blinds: this.options.blinds
    };
  }
}

export interface TexasHoldEmOptions {
  startMoney: number,
  turnTime: number,
  useSidepots: boolean,
  maxPlayers: number,
  blinds: Map<number, number>
}