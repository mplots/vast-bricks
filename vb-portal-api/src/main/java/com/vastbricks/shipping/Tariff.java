package com.vastbricks.shipping;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Tariff {

    private Type type;
    private Group group;
    private Mode mode;
    private Country country;
    private BigDecimal weight;
    private BigDecimal insuredAmount;
    private boolean mansPasts;

    private Result result;

    @Data
    @Getter
    public static class Result {
        @JsonProperty("lp_tariffs_id")
        private Integer id;

        @JsonProperty("lp_tariffs_types_id")
        private Integer typeId;

        @JsonProperty("lp_tariffs_types_title")
        private String  typeTitle;

        @JsonProperty("lp_tariffs_groups_id")
        private Integer groupId;

        @JsonProperty("lp_tariffs_groups_title")
        private String groupTitle;

        @JsonProperty("lp_tariffs_countries_id")
        private Integer countryId;

        @JsonProperty("lp_tariffs_countries_title")
        private String countryTitle;

        @JsonProperty("lp_tariffs_classes_id")
        private Integer classId;

        @JsonProperty("lp_tariffs_classes_title")
        private String classTitle;

        @JsonProperty("lp_tariffs_modes_id")
        private Integer modeId;

        @JsonProperty("lp_tariffs_modes_title")
        private String modeTitle;

        @JsonProperty("lp_tariffs_weight_from")
        private BigDecimal weightFrom;

        @JsonProperty("lp_tariffs_weight_to")
        private BigDecimal weightTo;

        @JsonProperty("lp_tariffs_amount")
        private BigDecimal amount;

        @JsonProperty("lp_tariffs_vat")
        private BigDecimal vat;

        @JsonProperty("lp_tariffs_ins_max")
        private BigDecimal insuranceMax;

        @JsonProperty("lp_tariffs_ins_min")
        private BigDecimal insuranceMin;

        @JsonProperty("lp_tariffs_ins_price")
        private BigDecimal insurancePrice;

        @JsonProperty("lp_tariffs_ins_vat")
        private BigDecimal insuranceVat;

        @JsonProperty("lp_tariffs_notice")
        private BigDecimal notice;

        @JsonProperty("lp_tariffs_notice_vat")
        private BigDecimal noticeVat;

        @JsonProperty("lp_tariffs_personally")
        private BigDecimal personally;

        @JsonProperty("lp_tariffs_personally_vat")
        private BigDecimal personallyVat;

        @JsonProperty("lp_tariffs_content")
        private BigDecimal content;

        @JsonProperty("lp_tariffs_content_vat")
        private BigDecimal contentVat;

        @JsonProperty("lp_tariffs_delivery")
        private BigDecimal delivery;

        @JsonProperty("lp_tariffs_delivery_vat")
        private BigDecimal deliveryVat;

        @JsonProperty("lp_tariffs_big")
        private BigDecimal big;

        @JsonProperty("lp_tariffs_big_vat")
        private BigDecimal bigVat;

        @JsonProperty("lp_tariffs_fragile")
        private BigDecimal fragile;

        @JsonProperty("lp_tariffs_fragile_vat")
        private BigDecimal fragileVat;

        @JsonProperty("lp_tariffs_tracking")
        private BigDecimal tracking;

        @JsonProperty("lp_tariffs_trackable")
        private BigDecimal trackable;

        @JsonProperty("lp_tariffs_trackable_vat")
        private BigDecimal trackableVat;

        @JsonProperty("lp_tariffs_mp")
        private BigDecimal mansPasts;

        @JsonProperty("lp_tariffs_ax")
        private String  ax;

        @JsonProperty("lp_tariffs_group")
        private Integer group;
  }

    @AllArgsConstructor(access = AccessLevel.PRIVATE)
    @Getter
    public enum Group {
        LATVIA(1),
        FOREIGN_COUNTRIES(2)
        ;

        private Integer id;
    }

    @AllArgsConstructor(access = AccessLevel.PRIVATE)
    @Getter
    public enum Mode {
        SIMPLE(1, "Simple"),
        RECORDED(2, "Recorded"),
        INSURED(3, "Insured"),
        TRACEABLE(4, "Traceable")
        ;

        private Integer id;
        private String name;
    }

    @AllArgsConstructor(access = AccessLevel.PRIVATE)
    @Getter
    public enum Type {
        DOCUMENT(2),
        SMALL_PACKAGE(4),
        PACKAGE(5)
        ;
        private Integer id;
    }

    @AllArgsConstructor(access = AccessLevel.PRIVATE)
    @Getter
    public enum Country {
        AFGHANISTAN("AFGANISTĀNA","AF",28,false,false),
        ALBANIA("ALBĀNIJA","AL",29,false,false),
        ALGERIA("ALŽĪRIJA","DZ",30,false,false),
        AMERICAN_SAMOA("ASV SAMOA TERITORIJA","AS",279,false,false),
        ANDORRA("ANDORA","AD",31,false,false),
        ANGOLA("ANGOLA","AO",33,false,false),
        ANTIGUA_AND_BARBUDA("ANTIGVA UN BARBUDA","AG",34,false,false),
        ARGENTINA("ARGENTĪNA","AR",37,false,false),
        ARMENIA("ARMĒNIJA","AM",38,false,false),
        ARUBA("ARUBA","AW",39,false,false),
        AUSTRALIA("AUSTRĀLIJA","AU",41,false,false),
        AZERBAIJAN("AZERBAIDŽĀNA","AZ",42,false,false),
        BAHAMAS("BAHAMAS","BS",43,false,false),
        BAHRAIN("BAHREINA","BH",44,false,false),
        BANGLADESH("BANGLADEŠA","BD",46,false,false),
        BARBADOS("BARBADOSA","BB",47,false,false),
        BELARUS("BALTKRIEVIJA","BY",45,false,false),
        BELIZE("BELIZA","BZ",48,false,false),
        BENIN("BENINA","BJ",49,false,false),
        BERMUDA("BERMUDU SALAS","BM",50,false,false),
        BHUTAN("BUTĀNA","BT",59,false,false),
        BOLIVIA("BOLĪVIJA","BO",51,false,false),
        BOSNIA_AND_HERZEGOVINA("BOSNIJA UN HERCEGOVINA","BA",52,false,false),
        BOTSWANA("BOTSVĀNA","BW",53,false,false),
        BRAZIL("BRAZĪLIJA","BR",54,false,false),
        BRUNEI_DARUSSALAM("BRUNEJA","BN",56,false,false),
        BURUNDI("BURUNDI","BI",58,false,false),
        CABO_VERDE("KABOVERDE","CV",107,false,false),
        CAMBODIA("KAMBODŽA","KH",109,false,false),
        CAMEROON("KAMERŪNA","CM",110,false,false),
        CANADA("KANĀDA","CA",111,false,false),
        CAYMAN_ISLANDS("KAIMANU SALAS","KY",108,false,false),
        CENTRAL_AFRICAN_REPUBLIC("CENTRĀLĀFRIKAS REP. (CĀR)","CF",60,false,false),
        CHILE("ČĪLE","CL",62,false,false),
        CHINA("ĶĪNA","CN",128,false,false),
        COLOMBIA("KOLUMBIJA","CO",117,false,false),
        COMOROS("KOMORU SALAS","KM",118,false,false),
        COOK_ISLANDS("KUKA SALAS","CK",265,false,false),
        COSTA_RICA("KOSTARIKA","CR",123,false,false),
        COTE_D_IVOIRE("KOTDIVUĀRA","CI",124,false,false),
        CUBA("KUBA","CU",126,false,false),
        DJIBOUTI("DŽIBUTIJA","DJ",67,false,false),
        DOMINICA("DOMINIKA","DM",65,false,false),
        DOMINICAN_REPUBLIC("DOMINIKĀNA","DO",66,false,false),
        Ecuador("EKVADORA","EC",69,false,false),
        Egypt("ĒĢIPTE","EG",68,false,false),
        EL_SALVADOR("SALVADORA","SV",171,false,false),
        EQUATORIAL_GUINEA("EKVATORIĀLĀ GVINEJA","GQ",70,false,false),
        ESWATINI("SVATINI KARALISTE","SZ",189,false,false),
        FALKLAND_ISLANDS("FOLKLENDA (MALVINU) SALAS","FK",76,false,false),
        FAROE_ISLANDS("FĒRU SALAS","FO",73,false,false),
        FIJI("FIDŽI","FJ",74,false,false),
        FRENCH_GUIANA("FRANČU GVIĀNA","GF",88,false,false),
        FRENCH_POLYNESIA("FRANČU POLINĒZIJA","PF",77,false,false),
        GABON("GABONA","GA",78,false,false),
        GAMBIA("GAMBIJA","GM",80,false,false),
        GEORGIA("GRUZIJA","GE",85,false,false),
        GHANA("GANA","GH",81,false,false),
        GIBRALTAR("GIBRALTĀRS","GI",82,false,false),
        GREENLAND("GRENLANDE","GL",84,false,false),
        GRENADA("GRENĀDA","GD",83,false,false),
        GUADELOUPE("GVADELUPA","GP",86,false,false),
        GUAM("GUAMA","GU",259,false,false),
        GUATEMALA("GVATEMALA","GT",87,false,false),
        GUERNSEY("GĒRNSIJA","GG",263,false,false),
        GUINEA("GVINEJA","GN",89,false,false),
        GUINEA_BISSAU("GVINEJA-BISAVA","GW",90,false,false),
        GUYANA("GAJĀNA","GY",79,false,false),
        HAITI("HAITI","HT",91,false,false),
        HONDURAS("HONDURASA","HN",92,false,false),
        HONG_KONG("HONKONGA","HK",93,false,false),
        INDIA("INDIJA","IN",95,false,false),
        INDONESIA("INDONĒZIJA","ID",96,false,false),
        IRAN("IRĀNA","IR",98,false,false),
        IRAQ("IRĀKA","IQ",97,false,false),
        ISLE_OF_MAN("MENAS SALA","IM",267,false,false),
        ISRAEL("IZRAĒLA","IL",100,false,false),
        JAMAICA("JAMAIKA","JM",101,false,false),
        JAPAN("JAPĀNA","JP",102,false,false),
        JERSEY("DŽĒRSIJA","JE",262,false,false),
        JORDAN("JORDĀNIJA","JO",106,false,false),
        KAZAKHSTAN("KAZAHSTĀNA","KZ",113,false,false),
        KENYA("KENIJA","KE",114,false,false),
        KIRIBATI("KIRIBATI","KI",116,false,false),
        KUWAIT("KUVEITA","KW",127,false,false),
        KYRGYZSTAN("KIRGĪZU REPUBLIKA","KG",115,false,false),
        LAOS("LAOSA","LA",129,false,false),
//        LATVIA("LATVIJA","LV",1,false,false),
        LEBANON("LIBĀNA","LB",131,false,false),
        LESOTHO("LESOTO","LS",130,false,false),
        MACAO("MAKAO","MO",137,false,false),
        MADAGASCAR("MADAGASKARA","MG",135,false,false),
        MALAWI("MALĀVIJA","MW",140,false,false),
        MALAYSIA("MALAIZIJA","MY",139,false,false),
        MALDIVES("MALDĪVIJA","MV",141,false,false),
        MARSHALL_ISLANDS("MĀRŠALA SALAS","MH",266,false,false),
        MARTINIQUE("MARTINIKA","MQ",144,false,false),
        MAURITANIA("MAURITĀNIJA","MR",146,false,false),
        MAURITIUS("MAURĪCIJA","MU",145,false,false),
        MAYOTTE("MAJOTA","YT",136,false,false),
        MEXICO("MEKSIKA","MX",147,false,false),
        MICRONESIA("MIKRONĒZIJA","FM",286,false,false),
        MOLDOVA("MOLDOVA","MD",150,false,false),
        MONACO("MONAKO","MC",151,false,false),
        MONGOLIA("MONGOLIJA","MN",152,false,false),
        MONTENEGRO("MELNKALNE","ME",148,false,false),
        MOROCCO("MAROKA","MA",143,false,false),
        MOZAMBIQUE("MOZAMBIKA","MZ",154,false,false),
        MYANMAR("MJANMA","MM",287,false,false),
        NAMIBIA("NAMĪBIJA","NA",155,false,false),
        NEPAL("NEPĀLA","NP",157,false,false),
        NEW_CALEDONIA("JAUNKALEDONIJA","NC",103,false,false),
        NEW_ZEALAND("JAUNZĒLANDE","NZ",104,false,false),
        NICARAGUA("NIKARAGVA","NI",160,false,false),
        NIGERIA("NIGĒRIJA","NG",159,false,false),
        NORTH_MACEDONIA("ZIEMEĻMAĶEDONIJA","MK",138,false,false),
        NORTHERN_MARIANA_ISLANDS("ZIEMEĻU MARIANAS SALU SADRAUDZĪBA","MP",291,false,false),
        OMAN("OMĀNA","OM",162,false,false),
        PAKISTAN("PAKISTĀNA","PK",163,false,false),
        PALAU("PALAU","PW",270,false,false),
        PALESTINE("PALESTĪNA","PS",271,false,false),
        PANAMA("PANAMA","PA",164,false,false),
        PAPUA_NEW_GUINEA("PAPUA-JAUNGVINEJA","PG",165,false,false),
        PARAGUAY("PARAGVAJA","PY",166,false,false),
        PERU("PERU","PE",167,false,false),
        PHILIPPINES("FILIPĪNAS","PH",75,false,false),
        PUERTO_RICO("PUERTORIKO","PR",272,false,false),
        QATAR("KATARA","QA",112,false,false),
        REUNION("REINJONA","RE",169,false,false),
        RUSSIA("KRIEVIJAS FEDERĀCIJA","RU",125,false,false),
        SAINT_KITTS_AND_NEVIS("SENTKITSA UN NEVISA","KN",178,false,false),
        SAINT_LUCIA("SENTLŪSIJA","LC",179,false,false),
        SAINT_VINCENT_AND_THE_GRENADINES("SENTVINSENTA UN GRENADĪNAS","VC",180,false,false),
        SAMOA("RIETUMSAMOA","WS",172,false,false),
        SAN_MARINO("SANMARĪNO","SM",273,false,false),
        SAO_TOME_AND_PRINCIPE("SANTOME UN PRINSIPI","ST",173,false,false),
        SAUDI_ARABIA("SAŪDA ARĀBIJA","SA",174,false,false),
        SENEGAL("SENEGĀLA","SN",176,false,false),
        SERBIA("SERBIJA","RS",181,false,false),
        SEYCHELLES("SEIŠELU SALAS","SC",175,false,false),
        SINGAPORE("SINGAPŪRA","SG",182,false,false),
        SOLOMON_ISLANDS("ZĀLAMANA SALAS","SB",214,false,false),
        SOUTH_AFRICA("DIENVIDĀFRIKAS REP. (DĀR)","ZA",64,false,false),
        SOUTH_KOREA("KOREJAS REPUBLIKA (DIENVIDKOREJA)","KR",121,false,false),
        SRI_LANKA("ŠRILANKA","LK",190,false,false),
        SUDAN("SUDĀNA","SD",186,false,false),
        SURINAME("SURINAMA","SR",187,false,false),
        SVALBARD_AND_JAN_MAYEN("SVALBĀRA, JANA MAJENA SALA","SJ",297,false,false),
        SWITZERLAND("ŠVEICE","CH",191,false,false),
        TAIWAN("TAIVĀNA","TW",193,false,false),
        TAJIKISTAN("TADŽIKISTĀNA","TJ",192,false,false),
        TANZANIA("TANZĀNIJA","TZ",195,false,false),
        THAILAND("TAIZEME","TH",194,false,false),
        TIMOR_LESTE("AUSTRUMTIMORAS DEMOKRĀTISKĀ REPUBLIKA","TL",281,false,false),
        TOGO("TOGO","TG",197,false,false),
        TONGA("TONGA","TO",198,false,false),
        TRINIDAD_AND_TOBAGO("TRINIDĀDA UN TOBAGO","TT",199,false,false),
        TUNISIA("TUNISIJA","TN",201,false,false),
        TURKEY("TURCIJA","TR",202,false,false),
        TURKMENISTAN("TURKMENISTĀNA","TM",203,false,false),
        TURKS_AND_CAICOS_ISLANDS("TĒRKSAS UN KAIKOSAS SALAS","TC",196,false,false),
        TUVALU("TUVALU","TV",204,false,false),
        UGANDA("UGANDA","UG",205,false,false),
        UKRAINE("UKRAINA","UA",206,false,false),
        UNITED_ARAB_EMIRATES("APV. ARĀBU EMIRĀTI (AAE)","AE",36,false,false),
        UNITED_KINGDOM("LIELBRITĀNIJA","GB",13,false,false),
        UNITED_STATES("ASV","US",40,false,false),
        URUGUAY("URUGVAJA","UY",207,false,false),
        UZBEKISTAN("UZBEKISTĀNA","UZ",208,false,false),
        VANUATU("VANUATU","VU",209,false,false),
        VATICAN_CITY("VATIKĀNS","VA",210,false,false),
        VENEZUELA("VENECUĒLA","VE",211,false,false),
        VIETNAM("VJETNAMA","VN",212,false,false),
        VIRGIN_ISLANDS_BRITISH("BRITU VIRDŽĪNU SALAS","VG",55,false,false),
        VIRGIN_ISLANDS_US("ASV VIRDŽĪNU SALU TERITORIJA","VI",280,false,false),
        WALLIS_AND_FUTUNA("VOLISA UN FUTUNA","WF",213,false,false),
        ZAMBIA("ZAMBIJA","ZM",215,false,false),
        ZIMBABWE("ZIMBABVE","ZW",216,false,false),
        ALAND_ISLANDS("OLANDES SALAS","AX",260,false,false),
        AUSTRIA("AUSTRIJA","AT",2,true,true),
        BELGIUM("BEĻĢIJA","BE",3,true,true),
        BULGARIA("BULGĀRIJA","BG",4,true,true),
        CZECH_REPUBLIC("ČEHIJA","CZ",5,true,true),
        DENMARK("DĀNIJA","DK",6,true,true),
        FRANCE("FRANCIJA","FR",7,true,true),
        GREECE("GRIEĶIJA","GR",8,true,true),
        CROATIA("HORVĀTIJA","HR",94,true,true),
        ESTONIA("IGAUNIJA","EE",9,true,true),
        ITALY("ITĀLIJA","IT",10,true,true),
        IRELAND("ĪRIJA","IE",11,true,true),
        CYPRUS("KIPRA","CY",12,true,true),
        LITHUANIA("LIETUVA","LT",14,true,true),
        MALTA("MALTA","MT",16,true,true),
        NETHERLANDS("NĪDERLANDE","NL",17,true,true),
        POLAND("POLIJA","PL",18,true,true),
        PORTUGAL("PORTUGĀLE","PT",19,true,true),
        ROMANIA("RUMĀNIJA","RO",20,true,true),
        SLOVAKIA("SLOVĀKIJA","SK",21,true,true),
        SLOVENIA("SLOVĒNIJA","SI",22,true,true),
        FINLAND("SOMIJA","FI",23,true,true),
        SPAIN("SPĀNIJA","ES",24,true,true),
        HUNGARY("UNGĀRIJA","HU",25,true,true),
        GERMANY("VĀCIJA","DE",26,true,true),
        SWEDEN("ZVIEDRIJA","SE",27,true,true),
        LUXEMBOURG("LUKSEMBURGA","LU",15,false,true),
        ICELAND("ISLANDE","IS",99,false,true),
        LIECHTENSTEIN("LIHTENŠTEINA","LI",134,false,true),
        NORWAY("NORVĒĢIJA","NO",161,false,true)
        ;


        private String title;
        private String code;
        private Integer id;
        private boolean eu;
        private boolean eez;

    }
}
