package net.owatz;

public class Card {

    public int color;
    public int value;
    public boolean win;
    public int index;

    public Card(int color, int value, int index) {
        this.color = color;
        this.value = value;
        this.index = index;
        win = false;
    }

    public int getValue() {
        return value==1?14:value;
    }

    public String getValueName() {

        return getValueName(value);
    }

    public static String getValueName(int value) {

        switch (value) {
            case 1: return "A";
            case 11: return "J";
            case 12: return "Q";
            case 13: return "K";
            case 14: return "A";
            default: return String.valueOf(value);
        }
    }
}
