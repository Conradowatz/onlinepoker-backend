package net.owatz;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;

public class Hand {

    public ArrayList<Card> cards;
    public ArrayList<Card> kickers;
    private Card[] holecards = new Card[2];
    private Card[] ccards = new Card[5];
    public int wertigkeit;
    public int[] unterwertigkeit = new int[5];
    public int playerIndex;
    public String name;
    private ArrayList<Integer> winnerCards;

    public Hand(int playerIndex, Card[] ccards, Card[] holecards) {

        this.ccards = ccards.clone();
        this.holecards = holecards.clone();
        this.playerIndex = playerIndex;
        winnerCards = new ArrayList<>();
        cards = new ArrayList<>();
        kickers = new ArrayList<>();
        for (Card c: ccards) {
            cards.add(c);
            kickers.add(c);
        }
        for (Card c: holecards) {
            cards.add(c);
            kickers.add(c);
        }
        sort();
        calculateWertigkeit();
        setName();
    }

    private void setName() {

        switch (wertigkeit) {
            case 0:
                name = "High Card";
                break;
            case 1:
                name = "Pair";
                break;
            case 2:
                name = "Two Pair";
                break;
            case 3:
                name = "Trips";
                break;
            case 4:
                name = "Straight";
                break;
            case 5:
                name = "Flush";
                break;
            case 6:
                name = "Full House";
                break;
            case 7:
                name = "Quads";
                break;
            case 8:
                name = "Straight Flush";
                break;
            case 9:
                name = "Royal Flush";
        }
    }

    public void highlightWinCards() {

        for (int i=0; i<cards.size(); i++) {
            if (winnerCards.contains(i)) cards.get(i).win = true;
        }
    }

    private void sort() {

        Collections.sort(cards, new Comparator<Card>() {
            @Override
            public int compare(Card  c1, Card  c2)
            {
                return  ((Integer)c1.value).compareTo(c2.value);
            }
        });

        Collections.sort(kickers, new Comparator<Card>() {
            @Override
            public int compare(Card  c1, Card  c2)
            {
                return  ((Integer)c1.getValue()).compareTo(c2.getValue());
            }
        });

        Arrays.sort(holecards, new Comparator<Card>() {
            @Override
            public int compare(Card c1, Card c2) {
                return ((Integer)c1.getValue()).compareTo(c2.getValue());
            }
        });

        Arrays.sort(ccards, new Comparator<Card>() {
            @Override
            public int compare(Card c1, Card c2) {
                return ((Integer)c1.getValue()).compareTo(c2.getValue());
            }
        });

    }

    public int compareTo(Hand h2) {

        if (this.wertigkeit==h2.wertigkeit) {
            for (int i=0; i<unterwertigkeit.length; i++) {
                if (this.unterwertigkeit[i]!=h2.unterwertigkeit[i]) {
                    return ((Integer)this.unterwertigkeit[i]).compareTo(h2.unterwertigkeit[i]);
                }
            }
            return 0;
        } else return ((Integer) this.wertigkeit).compareTo(h2.wertigkeit);
    }

    public void calculateWertigkeit() {

        //***Straight Flush***
        for (int color=1; color<=4; color++) {

            ArrayList<Card> colorCards = new ArrayList<>();
            for (Card c:cards) if (c.color==color) colorCards.add(c);
            ArrayList<Integer> cardValues = new ArrayList<>();
            for (Card c: colorCards) cardValues.add(c.value);
            if (colorCards.size()<5) continue;

            //Royale Flush
            boolean sflush = true;
            if (cardValues.contains(1)) {
                for (int j=10; j<=13; j++) {
                    if (!cardValues.contains(j)) {
                        sflush = false;
                        break;
                    }
                }
            } else sflush = false;
            if (sflush) {
                for (Card c : colorCards) {
                    if (c.getValue() >=10 && c.getValue()<=14) winnerCards.add(cards.indexOf(c));
                }
                wertigkeit = 9;
                return;
            }
            //Straight Flush
            for (int i=9; i>=1; i--) {
                if (!cardValues.contains(i)) continue;
                sflush = true;
                for (int j=i+1; j<i+5; j++) {
                    if (!cardValues.contains(j)) {
                        sflush = false;
                        break;
                    }
                }
                if (sflush) {
                    for (Card c : colorCards) {
                        if (c.value >=i && c.value<=i+4) winnerCards.add(cards.indexOf(c));
                    }
                    wertigkeit = 8;
                    unterwertigkeit[0] = i+4;
                    return;
                }
            }

        }

        //***Four Of A Kind***
        int four = 0;
        for (int i=6; i>0; i--) {
            if (kickers.get(i).value==kickers.get(i-1).value) four++; else four=0;
            if (four==3) {
                wertigkeit = 7;
                unterwertigkeit[0] = kickers.get(i).getValue();
                winnerCards.add(cards.indexOf(kickers.get(i-1)));
                winnerCards.add(cards.indexOf(kickers.get(i)));
                winnerCards.add(cards.indexOf(kickers.get(i+1)));
                winnerCards.add(cards.indexOf(kickers.get(i+2)));
                kickers.remove(cards.get(winnerCards.get(0)));
                kickers.remove(cards.get(winnerCards.get(1)));
                kickers.remove(cards.get(winnerCards.get(2)));
                kickers.remove(cards.get(winnerCards.get(3)));
                unterwertigkeit[1] = kickers.get(kickers.size()-1).getValue();
                return;
            }
        }

        //***Full House***
        int three = 0;
        for (int i=6; i>0; i--) {
            if (kickers.get(i).value==kickers.get(i-1).value) three++; else three=0;
            if (three==2) {
                unterwertigkeit[0] = kickers.get(i).getValue();
                winnerCards.add(cards.indexOf(kickers.get(i-1)));
                winnerCards.add(cards.indexOf(kickers.get(i)));
                winnerCards.add(cards.indexOf(kickers.get(i+1)));
                kickers.remove(cards.get(winnerCards.get(0)));
                kickers.remove(cards.get(winnerCards.get(1)));
                kickers.remove(cards.get(winnerCards.get(2)));
                for (int j=3; j>0; j--) {
                    if (kickers.get(j).value==kickers.get(j-1).value)  {
                        unterwertigkeit[1] = kickers.get(j).getValue();
                        winnerCards.add(cards.indexOf(kickers.get(j)));
                        winnerCards.add(cards.indexOf(kickers.get(j-1)));
                        kickers.remove(cards.get(winnerCards.get(3)));
                        kickers.remove(cards.get(winnerCards.get(4)));
                        wertigkeit = 6;
                        return;
                    }
                }
                break;
            }
        }

        //***Flush***
        for (int color=1; color<=4; color++) {
            ArrayList<Card> colorCards = new ArrayList<>();
            for (Card c : cards) if (c.color == color) colorCards.add(c);
            if (colorCards.size() >= 5) {
                for (Card c : colorCards) {
                    winnerCards.add(cards.indexOf(c));
                }
                wertigkeit = 5;
                if (holecards[1].color==color)
                    unterwertigkeit[0] = holecards[1].getValue();
                int z = unterwertigkeit[0]==0?0:1;
                if (holecards[0].color==color)
                    unterwertigkeit[z] = holecards[0].getValue();
                return;
            }
        }

        //***Straight***
        ArrayList<Integer> cardValues = new ArrayList<>();
        for (Card c : cards) cardValues.add(c.value);

        //Sonderfall höchste Starße
        boolean straight = true;
        if (cardValues.contains(1)) {
            for (int j=10; j<=13; j++) {
                if (!cardValues.contains(j)) {
                    straight = false;
                    break;
                }
            }
        } else straight = false;
        if (straight) {
            for (Card c : cards) {
                if (c.getValue() >=10 && c.getValue()<=14) winnerCards.add(cards.indexOf(c));
            }
            wertigkeit = 4;
            unterwertigkeit[0] = 14;
            return;
        }
        //normale Straße
        for (int i=9; i>=1; i--) {
            if (!cardValues.contains(i)) continue;
            straight = true;
            for (int j=i+1; j<i+5; j++) {
                if (!cardValues.contains(j)) {
                    straight = false;
                    break;
                }
            }
            if (straight) {
                for (Card c : cards) {
                    if (c.value >=i && c.value<=i+4) winnerCards.add(cards.indexOf(c));
                }
                wertigkeit = 4;
                unterwertigkeit[0] = i+4;
                return;
            }
        }

        //***Drilling***
        if (three==2) {
            wertigkeit = 3;
            unterwertigkeit[1] = kickers.get(kickers.size()-1).getValue();
            unterwertigkeit[2] = kickers.get(kickers.size()-2).getValue();
            return;
        }

        //***(Zwei) Paar***
        for (int i=6; i>0; i--) {
            if (kickers.get(i).value==kickers.get(i-1).value) {
                unterwertigkeit[0] = kickers.get(i).getValue();
                winnerCards.add(cards.indexOf(kickers.get(i)));
                winnerCards.add(cards.indexOf(kickers.get(i-1)));
                kickers.remove(cards.get(winnerCards.get(0)));
                kickers.remove(cards.get(winnerCards.get(1)));
                for (int j=4; j>0; j--) {
                    if (kickers.get(j).value==kickers.get(j-1).value) {
                        if (kickers.get(j).getValue()>unterwertigkeit[0]) {
                            unterwertigkeit[1] = unterwertigkeit[0];
                            unterwertigkeit[0] = kickers.get(j).getValue();
                        } else unterwertigkeit[1] = kickers.get(j).getValue();
                        winnerCards.add(cards.indexOf(kickers.get(j)));
                        winnerCards.add(cards.indexOf(kickers.get(j-1)));
                        kickers.remove(cards.get(winnerCards.get(2)));
                        kickers.remove(cards.get(winnerCards.get(3)));
                        unterwertigkeit[2] = kickers.get(kickers.size()-1).getValue();
                        wertigkeit = 2;
                        return;
                    }
                }
                wertigkeit = 1;
                unterwertigkeit[1] = kickers.get(kickers.size()-1).getValue();
                unterwertigkeit[2] = kickers.get(kickers.size()-2).getValue();
                unterwertigkeit[3] = kickers.get(kickers.size()-3).getValue();
                return;
            }
        }

        //***High Card***
        wertigkeit = 0;
        winnerCards.add(cards.indexOf(kickers.get(kickers.size()-1)));
        unterwertigkeit[0] = kickers.get(kickers.size()-1).getValue();
        unterwertigkeit[1] = kickers.get(kickers.size()-2).getValue();
        unterwertigkeit[2] = kickers.get(kickers.size()-3).getValue();
        unterwertigkeit[3] = kickers.get(kickers.size()-4).getValue();
        unterwertigkeit[4] = kickers.get(kickers.size()-5).getValue();

    }
}
