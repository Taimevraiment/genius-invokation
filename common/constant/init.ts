import { CustomVersionConfig, InfoVO, Player } from '../../typing';
import { GICard } from '../data/builder/cardBuilder.js';
import { GIHero } from '../data/builder/heroBuilder.js';
import { GISkill } from '../data/builder/skillBuilder.js';
import { GIStatus } from '../data/builder/statusBuilder.js';
import { CARD_TYPE, DICE_TYPE, ELEMENT_TYPE, PHASE, PLAYER_STATUS, SKILL_TYPE, VERSION, WEAPON_TYPE } from './enum.js';
import { INIT_ROLL_COUNT, INIT_SWITCH_HERO_DICE, MAX_SUMMON_COUNT, MAX_SUPPORT_COUNT, PLAYER_COUNT } from './gameOption.js';

export const INIT_PLAYER: () => Player = () => ({
    id: -1,
    name: '',
    rid: -1,
    handCards: [],
    heros: [],
    pile: [],
    supports: [],
    summons: [],
    combatStatus: [],
    dice: [],
    rollCnt: INIT_ROLL_COUNT,
    status: PLAYER_STATUS.WAITING,
    phase: PHASE.NOT_READY,
    pidx: -1,
    hidx: -1,
    deckIdx: -1,
    isFallAtk: false,
    canAction: false,
    isOffline: false,
    playerInfo: {
        isUsedLegend: false,
        relicCnt: 0,
        relicTypeCnt: 0,
        weaponCnt: 0,
        weaponTypeCnt: 0,
        talentCnt: 0,
        talentTypeCnt: 0,
        usedCardIds: [],
        destroyedSupport: 0,
        oppoGetElDmgType: 0,
        discardCnt: 0,
        reconcileCnt: 0,
        discardIds: [],
        initCardIds: [],
        isUsedCardPerRound: false,
        usedVehcileCnt: 0,
    },
    UI: {
        info: '',
        heroSwitchDice: INIT_SWITCH_HERO_DICE,
        showRerollBtn: false,
        atkhidx: -1,
        tarhidx: -1,
        willGetCard: {
            cards: [],
            isFromPile: true,
            isNotPublic: false,
        },
        willAddCard: {
            cards: [],
            scope: 0,
            isRandom: true,
            isNotPublic: false,
        },
        willDiscard: {
            hcards: [],
            pile: [],
            isNotPublic: false,
        },
    },
});

export const NULL_SKILL = () => new GISkill('无', '', SKILL_TYPE.Passive, 0, 0, DICE_TYPE.Same);

export const NULL_HERO = () => new GIHero(0, -1, '无', 'v3.3.0', [], 0, ELEMENT_TYPE.Physical, WEAPON_TYPE.Other, '', '');

export const NULL_CARD = () => new GICard(0, -1, '无', 'v3.3.0', '', '', 0, DICE_TYPE.Same, CARD_TYPE.Event);

export const NULL_STATUS = () => new GIStatus(0, '无', '', '', 0, [], 1, 1, 1);

export const NULL_MODAL = (): InfoVO => ({
    version: VERSION[0],
    isShow: false,
    type: null,
    info: null,
});

export const NULL_CUSTOM_VERSION_CONFIG = (): CustomVersionConfig => ({ name: '无', baseVersion: VERSION[0], diff: {} });

export const INIT_SUMMONCNT = (): number[][] => Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUMMON_COUNT).fill(0));

export const INIT_SUPPORTCNT = (): number[][] => Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUPPORT_COUNT).fill(0));

