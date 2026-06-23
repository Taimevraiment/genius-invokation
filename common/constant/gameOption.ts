
export const MAX_GAME_ROUND = 15; // 最大游戏回合

export const MAX_DICE_COUNT = 16; // 最大骰子数

export const INIT_DICE_COUNT = 8; // 每回合初始骰子数

export const MAX_HANDCARDS_COUNT = 10; // 最大手牌数

export const INIT_HANDCARDS_COUNT = 5; // 初始手牌数

export const INIT_PILE_COUNT = 30; // 初始牌库数

export const MAX_SUMMON_COUNT = 4; // 召唤物区最大数量

export const MAX_SUPPORT_COUNT = 4; // 支援物区最大数量

export const PLAYER_COUNT = 2; // 玩家数量

export const INIT_SWITCH_HERO_DICE = 1; // 初始切换角色所需骰子

export const INIT_ROLL_COUNT = 1; // 初始可重投次数

export const MIN_DECK_COUNT = 16; // 最小可组卡组数

export const MAX_DECK_COUNT = 200; // 最大可组卡组数

export const DECK_CARD_COUNT = 30; // 卡组所需行动牌数量

export const DECK_HERO_COUNT = 3; // 卡组所需角色数量

export const MAX_USE_COUNT = 2 ** 32 - 1; // 最大使用次数

export const MAX_STATUS_COUNT = 20; // 最大状态数量

export const BLOCK_WORDS = [
    /1s/i, // 国服
    /2c8/i, // 亚服
    /2g1c/i,
    /4jg/i, // 亚服
    /4jk/i, // 亚服
    /5l3/i, // 亚服
    /64/i, // 国服，似乎存在正则
    /6four/i, // 国服
    /6iv/i, // 国服
    /6si/i, // 国服
    /89/i, // might be removed
    /8jiu/i,
    /92f/i, // 国服
    /99bb/i, // 亚服
    /a55/i, // 亚服
    /anal/i,
    /anus/i,
    /ass/i, // 国服
    /ash0le/i,
    /b00b/i, // 亚服
    /b1tch/i,
    /b17ch/i,
    /ba9/i, // 国服
    /bb1/i, // 亚服
    /bbw/i, // 国服
    /bdsm/i,
    /beaner/i,
    /bi7ch/i,
    /bimbos/i,
    /bitch/i,
    /boob/i,
    /boner/i,
    /c0cks/i,
    /c0n/i, // 亚服
    /c4/i, // might be removed
    /cag/i, // might be removed
    /ccp/i,
    /chink/i,
    /clit/i,
    /cnm/i, // 国服
    /cnn/i, // 国服
    /cock/i,
    /coons/i,
    /cum/i, // 国服
    /cunt/i,
    /cuum/i, // 亚服
    /cv0/i, // 国服
    /darkie/i,
    /dick/i,
    /dildo/i,
    /dilld0/i,
    /dommes/i,
    /dpp/i,
    /dvda/i,
    /ecchi/i,
    /erotic/i,
    /f4k/i, // 亚服
    /fag1t/i,
    /fagg1t/i,
    /faggot/i,
    /fck/i, // 国服
    /fdp/i, // 亚服
    /fecal/i,
    /felch/i,
    /feltch/i,
    /femdom/i,
    /flg/i, // 国服
    /fm2/i, // 亚服
    /fuck/i,
    /gay/i, // 国服
    /gcd/i, // 国服
    /gdm/i, // 亚服
    /ggc/i, // 亚服
    /girlon/i,
    /goatcx/i,
    /goatse/i,
    /gokkun/i,
    /grope/i,
    /guro/i,
    /gwg/i, // 国服
    /hentai/i,
    /hitler/i,
    /hjt/i, // 国服
    /honkey/i,
    /hooker/i,
    /incest/i,
    /j8/i,
    /jba/i, // 国服
    /ji8/i, // 国服
    /jiba/i,
    /jiz/i, // 亚服 国服jizz
    /juggs/i,
    /jzm/i,
    /k7/i, // 亚服，似乎存在正则
    /kike/i,
    /kinky/i,
    /kmt/i,
    /kock/i, // 亚服
    /liu4/i,
    /liusi/i,
    /lolita/i,
    /lsp/i, // 国服
    /m0m/i, // 亚服
    /m2f/i, // 国服
    /mh0/i, // 亚服
    /milf/i,
    /mof0/i,
    /nambla/i,
    /negro/i,
    /nignog/i,
    /nigga/i,
    /nigger/i,
    /nipple/i,
    /njink/i, // 亚服
    /nmd/i, // 国服
    /ntd/i, // 国服
    /ntr/i, // 国服
    /nympho/i,
    /orgasm/i,
    /orgy/i,
    /p0rn/i,
    /p2np/i,
    /p3t/i, // 亚服
    /paki/i,
    /panty/i,
    /pcp/i, // might be removed
    /penis/i,
    /phuq/i, // 亚服
    /pig/i, // 疑似美服
    /poof/i,
    /poon/i,
    /porn/i,
    /pqp/i, // 亚服
    /prr/i, // 亚服
    /pthc/i,
    /pu55i/i,
    /pu55y/i,
    /pubes/i,
    /puki/i,
    /punany/i,
    /pussy/i,
    /queaf/i,
    /queef/i,
    /queer/i,
    /quim/i,
    /rape/i,
    /raping/i,
    /rapist/i,
    /rbq/i, // 国服
    /rectum/i,
    /rimjob/i,
    /s2x/i, // 亚服
    /s3x/i, // 亚服
    /sadism/i,
    /scat/i,
    /semen/i,
    /sex/i,
    /sh7t/i, // 亚服
    /shit/i,
    /shota/i,
    /six4/i,
    /skeet/i,
    /slut/i,
    /slvt/i, // 亚服
    /smut/i,
    /sodomy/i,
    /spic/i,
    /spooge/i,
    /spunk/i,
    /suck/i,
    /t3k/i, // 亚服
    /t41/i, // 亚服
    /t43/i, // 亚服
    /t4e/i, // 亚服
    /t4i/i, // 亚服
    /tits/i,
    /tiedup/i,
    /titty/i,
    /tmd/i, // 亚服
    /tosser/i,
    /tranny/i,
    /tushy/i,
    /twat/i,
    /twink/i,
    /vagina/i,
    /vi4/i, // 国服
    /viiv/i,
    /vpn/i,
    /vulva/i,
    /waf/i, // 国服
    /wank/i,
    /whore/i,
    /wh0re/i,
    /wtf/i, // 亚服
    /x3r/i,
    /xdd/i, // 国服
    /xjp/i, // 国服
    /yaoi/i,
    /yiffy/i,
]

export const IS_USE_OFFICIAL_SRC = true; // 是否使用官方图标

export const IS_DEVELOPING = true; // 是否上了开发版

// -------- 特殊标记常量 -------------

export const AI_ID = 2; // ai的id

export const STATUS_DESTROY_ID = 3; // 将该状态的entityId标记为已弃置

export const NOT_FOUND_PLAYER_ID = 4; // 未找到玩家的id