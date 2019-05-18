package net.owatz;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.*;
import java.util.concurrent.TimeUnit;

public class Table {
    public ArrayList<Player> players;
    public ArrayList<Spectator> spectators;
    public int hand;
    public int blind;
    public int blindPointer;
    public int blindPlayer;
    public int turn;
    public CCards cCards;
    public CardDeck cardDeck;
    private int minplayermoves;
    private int newSidepotCCard;

    public boolean awaitingOption;

    private Timer timer;
    private int waitingTime;

    public Table() {
        players = new ArrayList<>();
        spectators = new ArrayList<>();
        hand = 0;
        blind = 1;
        cCards = new CCards();
    }

    public JSONArray getPlayerInfo() {

        JSONArray playerInfoArray = new JSONArray();
        for (Player player : players) {
            JSONObject playerObject = new JSONObject();
            playerObject.put("name", player.name);
            playerObject.put("chair", player.chair);
            playerObject.put("money", player.money);
            playerInfoArray.put(playerObject);
        }

        return playerInfoArray;
    }

    public JSONArray getUpdatePlayerInfo() {

        JSONArray playerInfoArray = new JSONArray();
        for (Player player : players) {
            JSONObject playerObject = new JSONObject();
            playerObject.put("name", player.name);
            playerObject.put("chair", player.chair);
            playerObject.put("money", player.money);
            playerObject.put("ante", player.ante);
            playerObject.put("turn", players.indexOf(player)==turn);
            playerObject.put("is_active", player.isActive);
            playerInfoArray.put(playerObject);
        }

        return playerInfoArray;
    }

    public JSONObject getStartGameInfo(Player player) {

        JSONObject startGameInfoObject = new JSONObject();
        JSONArray playerInfoArray = new JSONArray();
        for (Player p : players) {
            JSONObject playerObject = new JSONObject();
            playerObject.put("name", p.name);
            playerObject.put("chair", p.chair);
            playerObject.put("money", p.money);
            playerInfoArray.put(playerObject);
        }
        startGameInfoObject.put("players", playerInfoArray);
        startGameInfoObject.put("yourchair", player.chair);
        startGameInfoObject.put("yourplayer", players.indexOf(player));
        return startGameInfoObject;
    }

    public void newRound() {

        System.out.println("New Round");

        //CCards resetten
        cCards.openCrads = 0;

        //Karten mischen
        cardDeck = new CardDeck();

        //neue Hand, neue Blinds
        hand++;
        if(isHandBlindIncrease(hand)) {
            blind = Options.blindTable[blindPointer];
            blindPointer++;
        }

        //Holecards geben
        for (Player player: players) {

            player.isActive = true;
            player.allin = false;
            player.potnum = 10; //Damit man standartmäßig alle Pots bekommt
            player.cards[0] = cardDeck.getRandomCard();
            player.cards[1] = cardDeck.getRandomCard();
        }

        //Blinds setzen
            //SB
        blindPlayer = getNextPlayer(blindPlayer);
        players.get(blindPlayer).ante = blind<players.get(blindPlayer).money ? blind : players.get(blindPlayer).money;
        players.get(blindPlayer).money = players.get(blindPlayer).money-players.get(blindPlayer).ante;
            //BB
        int bblindPlayer = getNextPlayer(blindPlayer);
        players.get(bblindPlayer).ante = blind*2<players.get(bblindPlayer).money ? blind*2 : players.get(bblindPlayer).money;
        players.get(bblindPlayer).money = players.get(bblindPlayer).money-players.get(bblindPlayer).ante;

        //Werte setzen
        cCards.highestAnte=2*blind;
        cCards.highestRaise=2*blind;
        cCards.pot = 0;
        //Sidepot resetten
        cCards.sidepots = new ArrayList<>();
        cCards.sidepots.add(0);
        newSidepotCCard = -1;

        //Clients Bescheid geben
        for (Player player : players) {

            player.send(PokerServer.parseResponse("new_round", getNewRoundInfo(player)));
        }
        for (Spectator spectator : spectators) {

            spectator.send(PokerServer.parseResponse("new_round", getNewRoundInfo(null)));
        }

        //Bietrunde starten
        turn = getNextPlayer(getNextPlayer(blindPlayer));
        minplayermoves = players.size();
        nextPlayer();
    }

    public int getNextPlayer(int player) {

        int nextPlayer = player>=players.size()-1 ? 0 : player+1;
        if (!players.get(nextPlayer).isActive) nextPlayer=getNextPlayer(nextPlayer);
        return nextPlayer;
    }

    public void nextPlayer() {

        System.out.println("Next Player");
        Player aPlayer = players.get(turn);

        //Nur weiter Bieten wenn noch min. ein Spieler unter dem highestAnte liegt (der aktiv und nicht allin ist)
        boolean goOn = false;
        for (Player player : players) if (player.ante<cCards.highestAnte && player.isActive && !player.allin) goOn = true;
        int activeplayers = 0;
        for (Player player : players) if (player.isActive && !player.allin) activeplayers++;
        if (((activeplayers<=1) && (aPlayer.ante>=cCards.highestAnte)) || ((minplayermoves<=0) && (!goOn))) {
            nextCCard();
            return;
        }
        minplayermoves--;

        //Wenn Spieler nicht aktiv oder allin nächster Spieler
        if (!aPlayer.isActive || aPlayer.allin) {
            turn = getNextPlayer(turn);
            nextPlayer();
            return;
        }

        //Allen Spielern sagen wer dran ist
        for (Player player: players) {
            player.send(PokerServer.parseResponse("turn", String.valueOf(aPlayer.chair)));
        }
        for (Spectator spectator : spectators) {
            spectator.send(PokerServer.parseResponse("turn", String.valueOf(aPlayer.chair)));
        }

        //Optionen des Spielers
        aPlayer.options[0] = aPlayer.ante>=cCards.highestAnte; //check
        aPlayer.options[1] = aPlayer.money>cCards.highestAnte-aPlayer.ante+cCards.highestRaise; //raise
        aPlayer.options[2] = aPlayer.money>=cCards.highestAnte && !aPlayer.options[0]; //call
        aPlayer.options[3] = true; //allin
        aPlayer.options[4] = true; //pass

        JSONArray optionsArray = new JSONArray();
        for (boolean o : aPlayer.options)
            optionsArray.put(o);
        JSONObject optionsObject = new JSONObject();
        optionsObject.put("options", optionsArray);
        optionsObject.put("min_raise", cCards.highestAnte-aPlayer.ante+cCards.highestRaise);
        if (aPlayer.options[2]) optionsObject.put("call_value", cCards.highestAnte-aPlayer.ante);

        aPlayer.send(PokerServer.parseResponse("options", optionsObject));
        awaitingOption = true;

        timer = new Timer();
        if (Options.maxTurnTime>0) {
            waitingTime = 0;
            timer.scheduleAtFixedRate(new TimerTask() {
                @Override
                public void run() {
                    waitingTime++;
                    aPlayer.send(PokerServer.parseResponse("timer", String.valueOf(Options.maxTurnTime-waitingTime)));
                    if (waitingTime>=Options.maxTurnTime) {
                        tookOption(4, 0); //Spieler folded nach der Zeit
                        timer.cancel();
                        timer.purge();
                    }
                }
            }, 0, 1000);
        }

    }

    public void tookOption(int option, int value) {

        Player aPlayer = players.get(turn);

        //Wenn Option gar nicht zur Auswahl steht (cheater!) nochmal senden
        if ((!aPlayer.options[option]) || ((option==1) && ((value>aPlayer.money) || (value<cCards.highestAnte-aPlayer.ante)))) {
            System.out.println(aPlayer.name+" versucht zu cheaten!");
            JSONArray optionsArray = new JSONArray();
            for (boolean o : aPlayer.options)
                optionsArray.put(o);
            JSONObject optionsObject = new JSONObject();
            optionsObject.put("options", optionsArray);
            optionsObject.put("min_raise", cCards.highestAnte-aPlayer.ante+blind);

            aPlayer.send(PokerServer.parseResponse("options", optionsObject));
            return;
        }

        if (Options.maxTurnTime>0) {
            timer.cancel();
            timer.purge();
        }

        //Ansonsten Option gewählt
        switch (option) {
            case 0: //check
                break;
            case 1: //raise
                aPlayer.ante += value;
                aPlayer.money -= value;
                if (aPlayer.ante>cCards.highestAnte) cCards.highestAnte=aPlayer.ante;
                if (value>cCards.highestRaise) cCards.highestRaise = value;
                break;
            case 2: //call
                aPlayer.money = aPlayer.money-(cCards.highestAnte-aPlayer.ante);
                aPlayer.ante = cCards.highestAnte;
                break;
            case 3: //allin
                aPlayer.ante = aPlayer.ante+aPlayer.money;
                aPlayer.money = 0;
                aPlayer.allin = true;
                newSidepotCCard = cCards.openCrads==0?3:cCards.openCrads+1;
                if (aPlayer.ante>cCards.highestAnte) cCards.highestAnte=aPlayer.ante;

                //Sidepot öffnen
                aPlayer.potnum = cCards.sidepots.size()-1;
                break;
            case 4: //pass
                aPlayer.isActive = false;
                break;
        }
        turn = getNextPlayer(turn);

        for (Player player : players) {

            player.send(PokerServer.parseResponse("update_players", getUpdatePlayerInfo()));
        }
        for (Spectator spectator : spectators) {

            spectator.send(PokerServer.parseResponse("update_players", getUpdatePlayerInfo()));
        }

        nextPlayer();
    }

    public void nextCCard() {

        System.out.println("Next CCard");

        int sidepot = 0;
        boolean nowNewSidepot = ((Options.useSidePot) && (newSidepotCCard==cCards.openCrads));
        //Ante einsammeln
        for (Player player:players) {
            sidepot += player.ante;
            player.ante = 0;
        }
        int sidepotnum = cCards.sidepots.size()-1;
        int sidepotvalue = cCards.sidepots.get(sidepotnum);
        if (nowNewSidepot) {
            cCards.sidepots.add(sidepot);
            System.out.println("New Sidepot: "+String.valueOf(sidepotnum)+1);
        }
        else {
            cCards.sidepots.set(sidepotnum,sidepotvalue+sidepot);
            System.out.println("Sidepot updated to: "+cCards.sidepots.get(sidepotnum));
        }
        cCards.pot += sidepot;

        cCards.highestAnte = 0;

        //Nach letzter Karte Runde beenden
        if (cCards.openCrads==5) {
            endRound();
            return;
        }

        //Karte(n) aufdecken
        if (cCards.openCrads==0) {
            cCards.openCrads = 3;
            cCards.cards[0] = cardDeck.getRandomCard();
            cCards.cards[1] = cardDeck.getRandomCard();
            cCards.cards[2] = cardDeck.getRandomCard();

            //Flop an Spieler senden
            JSONObject ccardObject = new JSONObject();
            JSONArray flopArray = new JSONArray();
            for (int i=0; i<3; i++) {
                JSONObject cardObject = new JSONObject();
                cardObject.put("color", cCards.cards[i].color);
                cardObject.put("value", cCards.cards[i].value);
                flopArray.put(cardObject);
            }
            ccardObject.put("ccards", flopArray);
            ccardObject.put("pot", cCards.pot);
            for (Player player : players)
                player.send(PokerServer.parseResponse("flop", ccardObject));
            for (Spectator spectator : spectators)
                spectator.send(PokerServer.parseResponse("flop", ccardObject));

        } else {
            cCards.cards[cCards.openCrads] = cardDeck.getRandomCard();

            //neue CCard an Spieler senden
            JSONObject cardObject = new JSONObject();
            cardObject.put("color", cCards.cards[cCards.openCrads].color);
            cardObject.put("value", cCards.cards[cCards.openCrads].value);
            cardObject.put("pot", cCards.pot);
            for (Player player : players)
                player.send(PokerServer.parseResponse("ccard", cardObject));
            for (Spectator spectator : spectators)
                spectator.send(PokerServer.parseResponse("ccard", cardObject));

            cCards.openCrads++;
        }

        turn = players.get(blindPlayer).isActive ? blindPlayer : getNextPlayer(blindPlayer);
        cCards.highestRaise=2*blind;

        minplayermoves = 0;
        for (Player p : players) if (p.isActive) minplayermoves++;
        nextPlayer();

    }

    private void endRound() {

        System.out.println("End Round");

        //Gewinner ermitteln
        ArrayList<Hand> hands = new ArrayList<>();
        for (int i=0; i<players.size(); i++) {
            Player player = players.get(i);
            if (!player.isActive) continue;

            hands.add(new Hand(i, cCards.cards, player.cards));
        }

        Collections.sort(hands, new Comparator<Hand>() {
            @Override
            public int compare(Hand  h1, Hand  h2)
            {
                return  (-h1.compareTo(h2));
            }
        });

        int winnum = 1;
        for (int i=1; i<hands.size(); i++) {

            if ((hands.get(i).compareTo(hands.get(i-1))==0)) winnum++;
            else break;
        }

        //Gewinn verteilen
        int[] winners = new int[winnum];
        for (int i=0; i<winnum; i++) {
            winners[i] = hands.get(i).playerIndex;
            hands.get(i).highlightWinCards();
        }

        for (int i=0; i<cCards.sidepots.size(); i++) {
            int splitnum = 0;
            for (int winerIndex : winners) {
                if (players.get(winerIndex).potnum>=i) splitnum++;
            }
            for (int winerIndex : winners) {
                if (players.get(winerIndex).potnum>=i)
                    players.get(winerIndex).money += cCards.sidepots.get(i) / splitnum;
            }
        }

        //in Konsole printen
        System.out.println("---End Round Hands---");
        for (Hand hand : hands) {
            System.out.println("Player "+hand.playerIndex+" ("+players.get(hand.playerIndex).name+"):\t"+hand.name+"\t|\t"+Card.getValueName(hand.unterwertigkeit[0])+"\t|\t"+Card.getValueName(hand.unterwertigkeit[1])+"\t|\t"+Card.getValueName(hand.unterwertigkeit[2]) +"\t|"+(hands.indexOf(hand)<winnum?"\twinner":""));
        }
        System.out.println("---------------------");


        cCards.pot = 0;

        for (Player player : players) {
            player.send(PokerServer.parseResponse("end_round", getEndRoundInfo(winners, hands.get(0).name)));
        }
        for (Spectator spectator : spectators) {
            spectator.send(PokerServer.parseResponse("end_round", getEndRoundInfo(winners, hands.get(0).name)));
        }

        ArrayList<Player> lostList = new ArrayList<>();
        for (int i=0; i<players.size(); i++) {
            Player player = players.get(i);
            if (player.money<=0) {
                player.send(PokerServer.parseResponse("lost"));
                lostList.add(player);
            }
        }

        for (Player p : lostList) players.remove(p);

        if (players.size()==1) return; //TODO GEWINNER SENDEN

        try {
            TimeUnit.SECONDS.sleep(20);
            newRound();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }

    }

    public static boolean isHandBlindIncrease(int hand) {

        for (int i=0; i<Options.blindTable.length; i++) {
            if (hand==Options.blindPointerTable[i]) return true;
        }
        return false;
    }

    public JSONObject getNewRoundInfo(Player player) {

        JSONObject newRoundInfoObject = new JSONObject();
        JSONArray playerInfoArray = new JSONArray();
        for (Player p : players) {
            JSONObject playerObject = new JSONObject();
            playerObject.put("name", p.name);
            playerObject.put("chair", p.chair);
            playerObject.put("money", p.money);
            playerInfoArray.put(playerObject);
        }
        newRoundInfoObject.put("players", playerInfoArray);
        newRoundInfoObject.put("yourplayer", player==null ? -1 : players.indexOf(player));
        newRoundInfoObject.put("hand", hand);
        newRoundInfoObject.put("blind", blind);
        newRoundInfoObject.put("sblindplayer", blindPlayer);
        newRoundInfoObject.put("bblindplayer", getNextPlayer(blindPlayer));
        newRoundInfoObject.put("sblindplayermoney", players.get(blindPlayer).money);
        newRoundInfoObject.put("bblindplayermoney", players.get(getNextPlayer(blindPlayer)).money);

        if (player!=null) {
            JSONArray yourCardsArray = new JSONArray();
            for (int i = 0; i < 2; i++) {
                JSONObject yourCardObject = new JSONObject();
                yourCardObject.put("value", player.cards[i].value);
                yourCardObject.put("color", player.cards[i].color);
                yourCardsArray.put(yourCardObject);
            }
            newRoundInfoObject.put("yourcards", yourCardsArray);
        }

        return newRoundInfoObject;
    }

    public  JSONObject getEndRoundInfo(int[] winners, String handname) {

        JSONArray winnersArray = new JSONArray();
        for (int winner : winners) winnersArray.put(winner);

        int activePlayers = 0;
        for (Player p : players) if (p.isActive) activePlayers++;

        JSONArray playerInfoArray = new JSONArray();
        for (Player p : players) {
            JSONObject playerObject = new JSONObject();
            playerObject.put("name", p.name);
            playerObject.put("chair", p.chair);
            playerObject.put("money", p.money);
            playerObject.put("ante", p.ante);
            playerObject.put("is_active", p.isActive);

            if (p.isActive && (activePlayers>1)) {
                JSONArray cardsArray = new JSONArray();
                for (int i = 0; i < 2; i++) {
                    JSONObject cardObject = new JSONObject();
                    cardObject.put("value", p.cards[i].value);
                    cardObject.put("color", p.cards[i].color);
                    cardObject.put("win", p.cards[i].win);
                    cardsArray.put(cardObject);
                }
                playerObject.put("cards", cardsArray);
            }

            playerInfoArray.put(playerObject);
        }

        JSONArray ccardsArray = new JSONArray();
        for (Card cc : cCards.cards) {
            JSONObject cardObject = new JSONObject();
            cardObject.put("value", cc.value);
            cardObject.put("color", cc.color);
            cardObject.put("win", cc.win);
            ccardsArray.put(cardObject);
        }

        JSONObject endRoundInfoObject = new JSONObject();
        endRoundInfoObject.put("pot", cCards.pot);
        endRoundInfoObject.put("winners", winnersArray);
        endRoundInfoObject.put("show_cards", (activePlayers>1));
        if (activePlayers>1) endRoundInfoObject.put("handname", handname);
        endRoundInfoObject.put("players", playerInfoArray);
        if (activePlayers>1) endRoundInfoObject.put("ccards", ccardsArray);
        return endRoundInfoObject;
    }

    public void sortPlayers() {

        Collections.sort(players, new Comparator<Player>() {
            @Override
            public int compare(Player  p1, Player  p2)
            {

                return  ((Integer)p1.chair).compareTo(p2.chair);
            }
        });

    }

    public void startNewGame() {

        sortPlayers();

        blindPointer = 0;
        hand = 0; //Hand resetten
        blindPlayer = players.size()-1; //blindchair resetten

        for (Player player: players) {
            player.money = Options.startMoney;    //jedem Spieler das Startgeld geben
        }

        for (Player player : players) {

            player.send(PokerServer.parseResponse("start_game", getStartGameInfo(player)));
        }

        newRound(); //erste Runde starten
    }

    public JSONObject getSpectatorInfo() {

        JSONObject spectatorInfoObject = new JSONObject();

        JSONArray playerArray = new JSONArray();
        for (Player player : players) {
            JSONObject playerObject = new JSONObject();
            playerObject.put("name", player.name);
            playerObject.put("chair", player.chair);
            playerObject.put("money", player.money);
            playerObject.put("ante", player.ante);
            playerObject.put("turn", players.indexOf(player)==turn);
            playerObject.put("is_active", player.isActive);
            playerArray.put(playerObject);
        }
        spectatorInfoObject.put("players", playerArray);

        JSONArray ccardArray = new JSONArray();
        for (int i=0; i<cCards.openCrads; i++) {
            JSONObject cardObject = new JSONObject();
            Card cc = cCards.cards[i];
            cardObject.put("value", cc.value);
            cardObject.put("color", cc.color);
            cardObject.put("win", cc.win);
            ccardArray.put(cardObject);
        }
        spectatorInfoObject.put("ccards", ccardArray);
        spectatorInfoObject.put("pot", cCards.pot);
        spectatorInfoObject.put("turnchair", turn>=players.size()?0:players.get(turn).chair);
        spectatorInfoObject.put("blind", blind);
        spectatorInfoObject.put("hand", hand);
        spectatorInfoObject.put("sblindplayer", blindPlayer);
        spectatorInfoObject.put("bblindplayer", getNextPlayer(blindPlayer));

        return spectatorInfoObject;

    }
}
