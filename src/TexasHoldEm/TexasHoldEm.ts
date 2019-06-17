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

export class TexasHoldEm extends GameMode {

  //meta
  options: TexasHoldEmOptions;
  running: boolean;
  //table attributes
  thPlayers: THPlayer[];
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
          if (this.thPlayers[i].id == id) {
            this.removePlayer(i, "disconnected");
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
      let playerIndex;
      for (let i=0; i<this.thPlayers.length; i++) {
        if (this.thPlayers[i].id == id) {
          playerIndex = i;
          break;
        }
      }
      if (message.action == "giveup") {
            this.removePlayer(playerIndex, "giveup");
      } else {
        //check for permission
        if (this.turn != playerIndex) return;
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
      m.players = this.thPlayers.map((p) => p.apiTHPlayer(false));
      m.settings = this.apiSettings();
      this.broadcastPlayers("th_start", m);
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
      m.smallBlind = this.smallBlind * 2;
      m.bigBlind = this.smallBlind * 2;
      m.smallBlindPlayer = this.smallBlindPlayer;
      m.bigBlindPlayer = bigBlindPlayer;
      m.hand = this.hand;
      m.players = this.thPlayers.map((p) => p.apiTHPlayer(false));
      for (let player of this.thPlayers) {
        m.yourCards = player.apiTHPlayer(true).cards;
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
    for (let p of this.thPlayers) {
      if (!p.folded && !p.allIn && p.bet<this.highestBet) playersToBet++;
    }
    if (playersToBet==0 || this.playersToAsk==0) {
      this.nextCommunityCard();
    }

    this.playersToAsk--;
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
      m.value = this.thPlayers[this.turn].apiTHPlayer(false);
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

    //check if player can do this action
    if (!this.thPlayers[this.turn].availableOptions.includes(action)) {
      return;
    }

    switch (action) {
      case THPlayer.OPTION_CHECK:
        break;
      case THPlayer.OPTION_RAISE:
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

    this.turn = this.getNextPlayer((this.turn));
    this.nextPlayer();
  }

  private setPlayerOptions(player: THPlayer) {
    player.availableOptions = [THPlayer.OPTION_ALLIN, THPlayer.OPTION_FOLD];
    if (player.bet>=this.highestBet) {
      player.availableOptions.push(THPlayer.OPTION_CHECK);
    }
    if (player.money>this.highestBet-player.bet+this.smallBlind) {
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
    if (this.communityCards.length==5 || activePlayers<=1) {
      this.endRound();
      return;
    }

    //new community cards
    if (this.communityCards.length==0) {
      this.communityCards.push(this.deck.getRandomCard());
      this.communityCards.push(this.deck.getRandomCard());
    }
    this.communityCards.push(this.deck.getRandomCard());

    //send cards
    {
      let m = new THCommunityCard();
      m.communityCards = this.communityCards.map((c) => c.apiCard());
      this.broadcastPlayers("th_community_card", m);
      this.broadcastSpectators("th_community_card", m);
    }

    //initialize next betting phase
    this.turn = this.getNextPlayer(this.smallBlindPlayer-1);
    this.playersToAsk = 0;
    for (let p of this.thPlayers) if (!p.folded && !p.allIn) this.playersToAsk++;
    this.highestBet = 2*this.smallBlind;
    //start betting phase
    this.nextPlayer();
  }

  private getNextPlayer(playerIndex: number):number {
    let nextPlayer = (playerIndex+1) & this.thPlayers.length;
    let player = this.thPlayers[playerIndex];
    if (player.folded || player.allIn) return this.getNextPlayer(playerIndex);
    return nextPlayer;
  }

  private endRound() {

    //determine winner
    let hands = [];
    let communityCardsString = this.communityCards.map((c) => c.getSolverString());
    for (let i=0; i<this.thPlayers.length; i++) {
      if (!this.thPlayers[i].folded) {
        let cardStrings = communityCardsString.slice();
        cardStrings.push(this.thPlayers[i].cards[0].getSolverString(), this.thPlayers[i].cards[1].getSolverString());
        let hand = Hand.solve(cardStrings, "standard", false);
        hands.push(hand);
      }
    }
    let winnerHands = Hand.winners(hands);
    let winningPlayers = [];
    let winningsCards:Card[] = [];
    for (let wh of winnerHands) {
      winningPlayers.push(hands.indexOf(wh));
      winningsCards = winningsCards.concat(wh.cards.map((c) => Card.fromString(c.toString())));
    }

    //give winners their money
    for (let i of winningPlayers) {
      this.thPlayers[i].money += Math.floor(this.pot/winningPlayers.length);
    }

    //notify players
    {
      let m = new THEndRound();
      let activePlayers = 0;
      this.thPlayers.forEach((p) => {if(!p.folded) activePlayers++});
      m.winners = winningPlayers.map((p) => this.thPlayers[p].apiTHPlayer(activePlayers>1));
      m.winningCards = winningsCards.map((c) => c.apiCard());
      m.players = this.thPlayers.map((p) => p.apiTHPlayer(!p.folded && activePlayers>1));
      m.reason = winnerHands[0].name;
      this.broadcastPlayers("th_end_round", m);
      this.broadcastSpectators("th_end_round", m);
    }

    //determine players with no money left
    for (let i=0; i<this.thPlayers.length; i++) {
      if (this.thPlayers[i].money==0) {
        this.removePlayer(i, "lost");
        i--;
      }
    }

    setTimeout(() => {
      //check if only one player is left
      if (this.thPlayers.length==1) {
        this.endOfGame();
      } else {
        this.newRound();
      }
    }, 10*1000);

  }

  private removePlayer(playerIndex: number, reason: string) {
    //add to spectators
    let thPlayer = this.thPlayers[playerIndex];
    this.thSpectators.set(thPlayer.id, this.lobby.players.get(thPlayer.id));
    //remove from players
    this.thPlayers.splice(playerIndex, 1);

    {
      let m = new THPlayerAction();
      m.action = "giveup";
      this.broadcastPlayers("th_player_action", m);
      this.broadcastSpectators("th_player_action", m);
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
      this.broadcastPlayers("th_end_game", this.thPlayers[0].apiTHPlayer(false));
      this.broadcastSpectators("th_end_game", this.thPlayers[0].apiTHPlayer(false));
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
    player.allIn = player.money == 0;
    if (player.bet>this.highestBet) this.highestBet = player.bet;
  }

  private actionCall(playerIndex: number) {
    let player = this.thPlayers[playerIndex];
    this.actionBet(playerIndex, this.pot-player.bet);
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