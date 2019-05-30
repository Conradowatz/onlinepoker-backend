import {GameMode} from "../GameMode";
import {TexasHoldEmSettings} from "../../pokerapi/messages/ApiObjects";
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

  constructor(public lobby: Lobby) {
    super();

    this.running = false;
    this.options = {
      blinds: new Map<number, number>([[1, 1], [3, 5], [5, 10], [8, 25], [12, 30], [15, 50], [19, 75], [22, 100], [28, 150], [35, 200], [50, 300], [70, 400], [90, 500]]),
      maxPlayers: 10,
      startMoney: 1000,
      turnTime: 60,
      useSidepots: true

    };
    this.registerListeners();
  }

  private registerListeners() {

    api.onLobby(this.lobby.id, "drop_user", (id) => {

    });

    api.onLobby(this.lobby.id, "start_game", (id: number) => {
      //check for permissions
      if (id != this.lobby.leader.id || this.running) return;

      this.startGame();
    });

    api.onLobby(this.lobby.id, "change_settings", (id: number, req: TexasHoldEmSettings) => {
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
    this.hand = 0;
    this.smallBlindPlayer = this.thPlayers.length-1;

    //send startGame
    //TODO

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
    //reset players
    for (let p of this.thPlayers) {
      p.folded = false;
      p.allIn = false;
      p.bet = 0;
      p.cards = [this.deck.getRandomCard(), this.deck.getRandomCard()];
    }
    //let SB and BB set their bet
    this.actionBet(this.smallBlindPlayer, this.smallBlind);
    this.actionBet((this.smallBlindPlayer+1) % this.thPlayers.length, this.smallBlind*2);

    this.playersToAsk = this.thPlayers.length;
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

    //TODO tell whos turn it is

    //set options
    this.setPlayerOptions(player);
    //TODO send options

    //set timeout
    if (this.options.turnTime>0) {
      this.turnTimer = setTimeout(() => {
        //fold if waiting time is too long
        this.playerAction(THPlayer.OPTION_FOLD);
      }, this.options.turnTime*1000)
    }

  }

  private playerAction(action: string, value?: number) {

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

    //collect bets
    for (let p of this.thPlayers) {
      this.pot += p.bet;
      p.bet = 0;
    }
    this.highestBet = 0;

    //end round if all community cards are open
    if (this.communityCards.length==5) {
      this.endRound();
      return;
    }

    //new community cards
    if (this.communityCards.length==0) {
      this.communityCards.push(this.deck.getRandomCard());
      this.communityCards.push(this.deck.getRandomCard());
    }
    this.communityCards.push(this.deck.getRandomCard());

    //TODO send players cards

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
    let communityCardsString = [];
    for (let card of this.communityCards) {
      communityCardsString.push(card.getSolverString());
    }
    for (let i=0; i<this.thPlayers.length; i++) {
      if (!this.thPlayers[i].folded) {
        let cardStrings = [];
        cardStrings.concat(communityCardsString);
        cardStrings.push(this.thPlayers[i].cards[0], this.thPlayers[i].cards[1]);
        let hand = Hand.solve(cardStrings, "standard", false);
        hands.push(hand);
      }
    }
    let winnerHands = Hand.winners(hands);
    let winningPlayers = [];
    for (let wh of winnerHands) {
      winningPlayers.push(hands.indexOf(wh));
    }

    //give winners their money
    for (let i of winningPlayers) {
      this.thPlayers[i].money += Math.floor(this.pot/winningPlayers.length);
    }
    //TODO notify end

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
    //TODO notify players
  }

  private broadcastSpectators(command: Command | ServerCommand, message: PokerMessage) {

    for (let [id, spectator] of this.thSpectators) {
      api.sendMessage(id, command, message);
    }
    this.lobby.broadcastSpectators(command, message);
  }

  private endOfGame() {
    //TODO send endOfGame
    this.running = false;
  }

  private setBlinds() {
    if (this.options.blinds.has(this.hand)) {
      this.smallBlind = this.options.blinds.get(this.hand);
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