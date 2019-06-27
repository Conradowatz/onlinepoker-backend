import {Player} from "../Player";
import {Card} from "../Card";
import {THPlayer as ApiTHPlayer} from "../../pokerapi/messages/ApiObjects";

export class THPlayer extends Player {

  cards: Card[];
  money: number;
  bet: number;
  allIn: boolean;
  folded: boolean;
  availableOptions : string[];

  constructor(id: number, name:string, money=0) {
    super(id, name);
    this.cards = [];
    this.money = money;
    this.bet = 0;
    this.allIn = false;
    this.folded = false;
  }

  public static OPTION_CHECK = "check";
  public static OPTION_RAISE = "raise";
  public static OPTION_CALL = "call";
  public static OPTION_ALLIN = "allin";
  public static OPTION_FOLD = "fold";

  public static ALL_OPTIONS = [THPlayer.OPTION_CHECK, THPlayer.OPTION_RAISE, THPlayer.OPTION_CALL, THPlayer.OPTION_ALLIN, THPlayer.OPTION_FOLD];

  apiTHPlayer(showCards: boolean, index: number): ApiTHPlayer {
    let cards = this.cards.map((c) => c.apiCard());
    return {
      id: this.id,
      name: this.name,
      cards: showCards?cards:[],
      money: this.money,
      bet: this.bet,
      allIn: this.allIn,
      folded: this.folded,
      index: index
    };
  }
}