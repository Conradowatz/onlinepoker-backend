import {GameMode} from "../GameMode";
import {
  THAction, THCommunityCard, THEndRound,
  THNewRound,
  THPlayerAction,
  THSettings,
  THStartGame, THYourTurn,
} from "../../pokerapi/messages/ApiObjects";
import {Lobby} from "../Lobby";
import {api} from "../Game";
import {THPlayer} from "./THPlayer";
import {Card} from "../Card";
import {CardDeck} from "../CardDeck";
import {Hand} from "pokersolver";
import Timeout = NodeJS.Timeout;
import {Player} from "../Player";
import {Command, PokerMessage, ServerCommand} from "../../pokerapi/messages/PokerMessage";
import {clearTimeout} from "timers";

export class TexasHoldEm extends GameMode {

  //meta
  options: TexasHoldEmOptions;
  running: boolean;
  //table attributes
  thPlayers: THPlayer[];
  ghostPlayers: number[]; // players (indices) that aren't in the game but still in a round
  thSpectators: Map<number, Player>;
  hand: number; //round number
  smallBlind: number; //value of the small blind, bigBlind = 2*smallBlind
  //round attributes
  pot: number; //amount of chips in the pot
  communityCards: Card[];
  deck: CardDeck;
  turn: number; //who's turn is it, index from thPlayer
  highestBet: number;
  smallBlindPlayer: number; //which player has the small blind, big is next
  playersToAsk: number; //the amount of players that can still take action
  turnTimer: Timeout;
  newRoundTimer: Timeout;
  startTime: Date;

  constructor(public lobby: Lobby) {
    super();

    this.running = false;
    this.options = {
      blindsTimeInsteadOfHand: false,
      blindRate: 10,
      maxPlayers: 10,
      startMoney: 1000,
      turnTime: 60,
      useSidepots: true

    };
    this.thPlayers = [];
    this.thSpectators = new Map<number, Player>();
    this.registerListeners();
  }

  private registerListeners() {

    api.onLobby(this.lobby.id, "drop_user", (id) => {
      if (this.thSpectators !== undefined) {
        let spec = this.thSpectators.get(id);
        if (spec != undefined) {
          this.thSpectators.delete(id);
          return;
        }
      }
      if (this.thPlayers !== undefined) {
        for (let i = 0; i < this.thPlayers.length; i++) {
          if (this.thPlayers[i].id === id) {
            this.removePlayer(i, false);
            return;
          }
        }
      }
    });

    api.onLobby(this.lobby.id, "start_game", (id: number) => {
      //check for permissions
      if (id != this.lobby.leader.id || this.running) return;

      this.startGame();
    });

    api.onLobby(this.lobby.id, "change_settings", (id: number, req: THSettings) => {
      //check for permissions
      if (id != this.lobby.leader.id || this.running) return;
      //change to desired options
      this.options.blindsTimeInsteadOfHand = req.blindsTimeInsteadOfHands;
      this.options.blindRate = req.blindsRate;
      this.options.useSidepots = req.useSidepots;
      this.options.turnTime = req.turnTime;
      this.options.maxPlayers = req.maxPlayers;
      this.options.startMoney = req.startMoney;
      //notify members
      this.lobby.sendLobbyUpdate()
    });

    api.onLobby(this.lobby.id, "th_action", (id, message: THAction) => {
      if (!this.running) return;
      let playerIndex = -1;
      for (let i=0; i<this.thPlayers.length; i++) {
        if (this.thPlayers[i].id === id) {
          playerIndex = i;
          break;
        }
      }
      if (playerIndex === -1) return;
      if (message.action === "giveup") {
            this.removePlayer(playerIndex, true);
      } else {
        //check for permission
        if (this.turn !== playerIndex) return;
        this.playerAction(message.action, message.value);
      }
    });
  }

  getName(): string {
    return "Texas Hold'em";
  }

  getMaxPlayers(): number {
    return this.options.maxPlayers;
  }

  isRunning(): boolean {
    return this.running;
  }

  isJoinable(): boolean {
    return !this.running;
  }

  startGame(): void {

    //set running status
    this.running = true;
    this.lobby.sendLobbyUpdate();

    //initialize players
    this.thPlayers = [];
    this.ghostPlayers = [];
    this.thSpectators = new Map<number, Player>();
    for (let [id, player] of this.lobby.players) {
      this.thPlayers.push(new THPlayer(id, player.name, this.options.startMoney));
    }
    //initialize table
    this.startTime = new Date();
    this.hand = 0;
    this.smallBlindPlayer = this.thPlayers.length - 1;

    //send startGame
    {
      let m = new THStartGame();
      m.players = this.thPlayers.map((p, i) => p.apiTHPlayer(false, i));
      m.settings = this.apiSettings();
      for (let i=0; i<this.thPlayers.length; i++) {
        m.yourIndex = i;
        api.sendMessage(this.thPlayers[i].id, "th_start", m);
      }
      this.broadcastSpectators("th_start", m);
    }

    //start first round
    this.newRound();
  }

  private newRound() {

    //initialize round
    this.hand++;
    this.setBlinds();
    this.highestBet = 2*this.smallBlind;
    this.pot = 0;
    this.communityCards = [];
    this.deck = new CardDeck();
    this.smallBlindPlayer = (this.smallBlindPlayer+1) % this.thPlayers.length;
    this.turn = (this.smallBlindPlayer+2) % this.thPlayers.length;
    this.playersToAsk = this.thPlayers.length;
    //reset players
    for (let p of this.thPlayers) {
      p.folded = false;
      p.allIn = false;
      p.bet = 0;
      p.cards = [this.deck.getRandomCard(), this.deck.getRandomCard()];
    }
    //let SB and BB set their bet
    this.actionBet(this.smallBlindPlayer, this.smallBlind);
    let bigBlindPlayer = (this.smallBlindPlayer+1) % this.thPlayers.length;
    this.actionBet(bigBlindPlayer, this.smallBlind*2);

    //notify players of round start
    {
      let m = new THNewRound();
      m.smallBlind = this.smallBlind;
      m.bigBlind = this.smallBlind * 2;
      m.smallBlindPlayer = this.thPlayers[this.smallBlindPlayer].id;
      m.bigBlindPlayer = this.thPlayers[bigBlindPlayer].id;
      m.hand = this.hand;
      m.players = this.thPlayers.map((p, i) => p.apiTHPlayer(false, i));
      for (let i=0; i<this.thPlayers.length; i++) {
        let player = this.thPlayers[i];
        m.yourCards = player.apiTHPlayer(true, i).cards;
        m.yourIndex = i;
        api.sendMessage(player.id, "th_new_round", m);
      }
      this.broadcastSpectators("th_new_round", m);
    }

    //enter betting phase
    this.nextPlayer();
  }

  private nextPlayer() {

    //check if betting phase is over
    let playersToBet = 0; //players that still need to bet
    let activePlayers = 0; //players that are able to bet
    for (let p of this.thPlayers) {
      if (!p.folded && !p.allIn) {
        activePlayers++;
        if (p.bet<this.highestBet) {
          playersToBet++;
        }
      }
    }
    if ((playersToBet===0 && this.playersToAsk<=0) || activePlayers==1) {
      this.nextCommunityCard();
      return;
    }

    let player = this.thPlayers[this.turn];

    //check if player is active
    if (player.folded || player.allIn) {
      this.turn = this.getNextPlayer(this.turn);
      this.nextPlayer();
      return;
    }

    //let players know whose turn it is
    {
      let m = new THPlayerAction();
      m.action = "turn";
      m.value = this.thPlayers[this.turn].id;
      m.player = this.thPlayers[this.turn].apiTHPlayer(false, this.turn);
      this.broadcastPlayers("th_player_action", m);
      this.broadcastSpectators("th_player_action", m);
    }

    //set options
    this.setPlayerOptions(player);
    //send options to player
    {
      let m = new THYourTurn();
      m.options = player.availableOptions;
      m.timeout = this.options.turnTime;
      m.minRaise = this.highestBet-player.bet+this.smallBlind;
      m.maxRaise = player.money;
      m.firstBet = this.highestBet===0;
      api.sendMessage(player.id, "th_your_turn", m);
    }

    //set timeout
    if (this.options.turnTime>0) {
      this.turnTimer = setTimeout(() => {
        //fold if waiting time is too long
        this.playerAction(THPlayer.OPTION_FOLD);
      }, this.options.turnTime*1000)
    }

  }

  private playerAction(action: string, value?: number) {

    //check if turn is set
    if (this.turn<0 || this.turn>=this.thPlayers.length) {
      console.log("Error in playerAction: this.turn: " + this.turn);
      return;
    }
    //check if player can do this action
    if (!this.thPlayers[this.turn].availableOptions.includes(action)) {
      return;
    }

    switch (action) {
      case THPlayer.OPTION_CHECK:
        break;
      case THPlayer.OPTION_RAISE:
        //check if valid amount
        if (value<this.highestBet-this.thPlayers[this.turn].bet+this.smallBlind) return;
        this.actionBet(this.turn, value);
        break;
      case THPlayer.OPTION_CALL:
        this.actionCall(this.turn);
        break;
      case THPlayer.OPTION_ALLIN:
        this.actionAllIn(this.turn);
        break;
      case THPlayer.OPTION_FOLD:
        this.actionFold(this.turn);
    }

    clearTimeout(this.turnTimer);
    this.playersToAsk--;

    //broadcast action
    {
      let message:THPlayerAction = {
        player: this.thPlayers[this.turn].apiTHPlayer(false, this.turn),
        // @ts-ignore
        action: action,
        value: value
      };
      this.broadcastPlayers("th_player_action", message);
      this.broadcastSpectators("th_player_action", message);
    }

    this.turn = this.getNextPlayer(this.turn);
    this.nextPlayer();
  }

  private setPlayerOptions(player: THPlayer) {
    player.availableOptions = [THPlayer.OPTION_ALLIN, THPlayer.OPTION_FOLD];
    if (player.bet>=this.highestBet) {
      player.availableOptions.push(THPlayer.OPTION_CHECK);
    }
    if (player.money>=this.highestBet-player.bet+this.smallBlind) {
      player.availableOptions.push(THPlayer.OPTION_RAISE);
    }
    if (player.money>=this.highestBet && player.bet<this.highestBet) {
      player.availableOptions.push(THPlayer.OPTION_CALL);
    }
  }

  private nextCommunityCard() {

    let activePlayers = 0;
    //collect bets
    for (let p of this.thPlayers) {
      this.pot += p.bet;
      p.bet = 0;
      if (!p.folded) activePlayers++;
    }
    this.highestBet = 0;

    //end round if all community cards are open or only one player left
    if (this.communityCards.length===5 || activePlayers<=1) {
      this.turn = -1;
      this.endRound();
      return;
    }

    //new community cards
    if (this.communityCards.length===0) {
      this.communityCards.push(this.deck.getRandomCard());
      this.communityCards.push(this.deck.getRandomCard());
    }
    this.communityCards.push(this.deck.getRandomCard());

    //send cards
    {
      let m = new THCommunityCard();
      m.communityCards = this.communityCards.map((c) => c.apiCard());
      m.players = this.thPlayers.map((p, i) => p.apiTHPlayer(false, i));
      m.pot = this.pot;
      this.broadcastPlayers("th_community_card", m);
      this.broadcastSpectators("th_community_card", m);
    }

    //initialize next betting phase
    this.turn = this.getNextPlayer(this.smallBlindPlayer-1);
    this.playersToAsk = 0;
    for (let p of this.thPlayers) if (!p.folded && !p.allIn) this.playersToAsk++;
    //start betting phase
    this.nextPlayer();
  }

  private getNextPlayer(playerIndex: number):number {
    let nextPlayer = (playerIndex+1) % this.thPlayers.length;
    let player = this.thPlayers[nextPlayer];
    if (player.folded || player.allIn) return this.getNextPlayer(nextPlayer);
    return nextPlayer;
  }

  private endRound() {

    //==determine winner===
    let winningPlayers = []; //index of winning players
    let winningsCards: Card[] = [];
    let winnerHand = ""; //the reason for winning
    let activePlayers = 0;
    this.thPlayers.forEach((p) => {if(!p.folded) activePlayers++});
    if (activePlayers>1) {
      //compare cards
      let hands = [];
      let communityCardsString = this.communityCards.map((c) => c.getSolverString());
      for (let i = 0; i < this.thPlayers.length; i++) {
        if (!this.thPlayers[i].folded) {
          let cardStrings = communityCardsString.slice();
          cardStrings.push(this.thPlayers[i].cards[0].getSolverString(), this.thPlayers[i].cards[1].getSolverString());
          let hand = Hand.solve(cardStrings, "standard", false);
          hands.push(hand);
        }
      }
      let winnerHands = Hand.winners(hands);
      winnerHand = winnerHands[0].name;
      for (let wh of winnerHands) {
        winningPlayers.push(hands.indexOf(wh));
        winningsCards = winningsCards.concat(wh.cards.map((c) => Card.fromString(c.toString())));
      }
    } else {
      //only one player left
      let winner:number;
      for (let i=0; i<this.thPlayers.length; i++) {
        if (!this.thPlayers[i].folded) {
          winner = i;
          break;
        }
      }
      winningPlayers = [winner];
      winnerHand = "One Left";
      winningsCards = [];
    }

    //give winners their money
    for (let i of winningPlayers) {
      this.thPlayers[i].money += Math.floor(this.pot/winningPlayers.length);
    }

    //notify players
    {
      let m = new THEndRound();
      m.winners = winningPlayers.map((p, i) => this.thPlayers[p].apiTHPlayer(activePlayers>1, i));
      m.winningCards = winningsCards.map((c) => c.apiCard());
      m.players = this.thPlayers.map((p, i) => p.apiTHPlayer(!p.folded && activePlayers>1, i));
      m.reason = winnerHand;
      this.broadcastPlayers("th_end_round", m);
      this.broadcastSpectators("th_end_round", m);
    }

    //determine players with no money left
    for (let i=0; i<this.thPlayers.length; i++) {
      let player = this.thPlayers[i];
      if (player.money===0) {
        this.thSpectators.set(player.id, this.lobby.players.get(player.id));
        //notify them
        api.sendMessage(player.id, "th_lost");
        this.thPlayers.splice(i, 1);
        i--;
      }
    }
    //remove ghost players
    for (let index of this.ghostPlayers) {
      this.thPlayers.splice(index, 1);
    }
    this.ghostPlayers = [];

    //give 10 seconds delay before new round
    this.newRoundTimer = setTimeout(() => {
      if (this === undefined) return;
      //check if only one player is left
      switch (this.thPlayers.length) {
        case 0: this.stopGame(); break;
        case 1: this.endOfGame(); break;
        default: this.newRound();
      }
    }, 10*1000);

  }

  private removePlayer(playerIndex: number, giveUp: boolean) {
    //add to spectators
    let thPlayer = this.thPlayers[playerIndex];

    if (giveUp) {
      this.thSpectators.set(thPlayer.id, this.lobby.players.get(thPlayer.id));
      //notify players
      let m = new THPlayerAction();
      m.action = "giveup";
      m.value = this.thPlayers[playerIndex].id;
      m.player = this.thPlayers[playerIndex].apiTHPlayer(false, playerIndex);
      this.broadcastPlayers("th_player_action", m);
      this.broadcastSpectators("th_player_action", m);
    }

    //mark for removing on round end
    this.ghostPlayers.push(playerIndex);

    //look if only one player is left
    let activePlayers = 0;
    for (let p of this.thPlayers) {
      if (thPlayer === p) continue;
      if (!p.folded && !p.allIn) activePlayers++;
    }
    if (activePlayers === 1) {
      clearTimeout(this.turnTimer);
      this.endRound();
    } else if (this.turn === playerIndex) { //if player is choosing
      clearTimeout(this.turnTimer);
      this.playerAction(THPlayer.OPTION_FOLD);
    }
  }

  private broadcastSpectators(command: Command | ServerCommand, message: PokerMessage) {

    for (let [id, spectator] of this.thSpectators) {
      api.sendMessage(id, command, message);
    }
    this.lobby.broadcastSpectators(command, message);
  }

  private broadcastPlayers(command: Command | ServerCommand, message: PokerMessage) {
    for (let player of this.thPlayers) {
      api.sendMessage(player.id, command, message);
    }
  }

  private endOfGame() {

    //notify players
    {
      this.broadcastPlayers("th_end_game", this.thPlayers[0].apiTHPlayer(false, 0));
      this.broadcastSpectators("th_end_game", this.thPlayers[0].apiTHPlayer(false, 0));
    }

    this.running = false;
  }

  private setBlinds() {

    if (this.options.blindRate > 0) {
      if (this.options.blindsTimeInsteadOfHand) {
        //time since start in 5*minutes
        let time = (Date.now() - this.startTime.getTime()) / 300000;
        let smallBlind = (this.options.startMoney * this.options.blindRate * Math.pow(time, 1.5)) / 1500;
        this.smallBlind = Math.round(smallBlind + 1) * 5;
      } else {
        let smallBlind = (this.options.startMoney * this.options.blindRate * Math.pow(this.hand, 1.5)) / 4000;
        this.smallBlind = Math.round(smallBlind + 1) * 5;
      }
    } else {
      this.smallBlind = 0;
    }
  }

  private actionBet(playerIndex: number, amount: number) {
    let player = this.thPlayers[playerIndex];
    player.bet += amount;
    player.money -= amount;
    player.allIn = player.money === 0;
    if (player.bet>this.highestBet) this.highestBet = player.bet;
  }

  private actionCall(playerIndex: number) {
    let player = this.thPlayers[playerIndex];
    this.actionBet(playerIndex, this.highestBet-player.bet);
  }

  private actionFold(playerIndex: number) {
    let player = this.thPlayers[playerIndex];
    player.folded = true;
  }

  private actionAllIn(playerIndex: number) {
    let player = this.thPlayers[playerIndex];
    player.bet += player.money;
    player.money = 0;
    player.allIn = true;
    if (player.bet>this.highestBet) this.highestBet = player.bet;
  }

  public stopGame() {
    this.running = false;
    clearTimeout(this.newRoundTimer);
    clearTimeout(this.turnTimer);
  }

  apiSettings(): THSettings {
    return {
      gameMode: "texasholdem",
      maxPlayers: this.getMaxPlayers(),
      startMoney: this.options.startMoney,
      turnTime: this.options.turnTime,
      useSidepots: this.options.useSidepots,
      blindsTimeInsteadOfHands: this.options.blindsTimeInsteadOfHand,
      blindsRate: this.options.blindRate
    };
  }
}

export interface TexasHoldEmOptions {
  startMoney: number,
  turnTime: number,
  useSidepots: boolean,
  maxPlayers: number,
  blindsTimeInsteadOfHand: boolean,
  blindRate: number
}
