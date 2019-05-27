import {GameMode} from "./GameMode";
import {GameMode as ApiGameMode} from "../pokerapi/messages/ApiObjects";

export class TexasHoldEm extends GameMode {

  options: TexasHoldEmOptions;

  getName(): string {
    return "Texas Hold'em";
  }

  getMaxPlayers(): number {
    return 6;
  }

  apiGameMode(): ApiGameMode {
    return {
      type: "texasholdem",
      maxPlayers: this.getMaxPlayers()
    };
  }

}

export interface TexasHoldEmOptions {
  startMoney: number,
  turnTime: number,
  useSidepots: boolean,
  maxPlayers: number
}