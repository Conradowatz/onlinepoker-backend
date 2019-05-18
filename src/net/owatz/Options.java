package net.owatz;

import com.sun.deploy.util.ArrayUtil;

import java.io.*;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Scanner;

public class Options {

    public static int maxConnections = 20;
    public static int maxSpectators = 14;
    public static boolean allowSameIp = true;

    public static int startMoney = 1000;
    public static int maxTurnTime = 120;
    public static boolean useSidePot = true;

    public static Integer[] blindPointerTable = {1, 3,  5,  8, 12, 15, 19,  22,  28,  35,  50,  70,  90};
    public static Integer[] blindTable =        {1, 5, 10, 25, 30, 50, 75, 100, 150, 200, 300, 400, 500};

    public static void readOptionsFile(File optionsFile) throws Exception {

        try {
            Scanner in = new Scanner(new FileReader(optionsFile));

            while (in.hasNextLine()) {
                String line = in.nextLine();
                if (line.startsWith("//") || line.startsWith("#") || !line.contains("=")) continue;
                String[] l = line.split("=");
                switch (l[0]) {
                    case "max_connections":
                        maxConnections = Integer.valueOf(l[1]);
                        break;
                    case "max_spectators":
                        maxSpectators = Integer.valueOf(l[1]);
                        break;
                    case "allow_same_ip":
                        allowSameIp = Boolean.valueOf(l[1]);
                        break;
                    case "start_money":
                        startMoney = Integer.valueOf(l[1]);
                        break;
                    case "max_turn_time":
                        maxTurnTime = Integer.valueOf(l[1]);
                        break;
                    case "use_sidepots":
                        useSidePot = Boolean.valueOf(l[1]);
                        break;
                }

            }
        } catch (Exception e) {
            e.printStackTrace();
            throw new Exception("options file corrupted");
        }
    }

    public static void readBlindsFile(File blindsFile) throws Exception {

        try {
            Scanner in = new Scanner(new FileReader(blindsFile));

            ArrayList<Integer> blindPointerList = new ArrayList<>();
            ArrayList<Integer> blindList = new ArrayList<>();
            while (in.hasNextLine()) {
                String line = in.nextLine();
                if (line.startsWith("//") || line.startsWith("#") || !line.contains(" ")) continue;
                String[] l = line.split(" ");
                int blindPointer = Integer.valueOf(l[0]);
                if ((blindPointerList.size()>0) && (blindPointer<=blindPointerList.get(blindPointerList.size()-1))) throw new Exception("blinds not ordered");
                int blind = Integer.valueOf(l[1]);
                if (blindPointer<0 || blind<0) throw new Exception("invalid blind values");
                blindPointerList.add(blindPointer);
                blindList.add(blind);
            }

            blindPointerTable = new Integer[blindPointerList.size()];
            blindPointerTable = blindPointerList.toArray(blindPointerTable);

            blindTable = new Integer[blindList.size()];
            blindTable = blindList.toArray(blindTable);

        } catch (Exception e) {
            e.printStackTrace();
            throw new Exception("blind file corrupted");
        }
    }

    public static void createNewOptionsFile() {

        System.out.println("Creating new options.txt");
        PrintWriter writer = null;
        try {
            writer = new PrintWriter("options.txt", "UTF-8");
            writer.print("##General##\n" +
                    "\n" +
                    "max_connections=20\n" +
                    "max_spectators=14\n" +
                    "allow_same_ip=true\n" +
                    "\n" +
                    "##Poker Rules##\n" +
                    "start_money=1000\n" +
                    "max_turn_time=120\n" +
                    "//in seconds, 0 for unlimited\n" +
                    "use_sidepots=true");
            writer.close();
        } catch (FileNotFoundException | UnsupportedEncodingException e) {
            e.printStackTrace();
        }
    }

    public static void createNewBlindsFile() {

        System.out.println("Creating new blinds.txt");
        PrintWriter writer = null;
        try {
            writer = new PrintWriter("blinds.txt", "UTF-8");
            writer.print("##Round Smallblind##\n" +
                    "1 1\n" +
                    "3 5\n" +
                    "5 10\n" +
                    "8 25\n" +
                    "12 30\n" +
                    "15 50\n" +
                    "19 75\n" +
                    "22 100\n" +
                    "28 150\n" +
                    "35 200\n" +
                    "50 300\n" +
                    "70 400\n" +
                    "90 500");
            writer.close();
        } catch (FileNotFoundException | UnsupportedEncodingException e) {
            e.printStackTrace();
        }
    }
}
