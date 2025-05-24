<template>
  <div class="info-outer-container">
    <!-- <img class="info-img" v-if="type != 'skill' && (info?.UI.src.length ?? 0) > 0" :src="info?.UI.src" :alt="info?.name"> -->
    <div class="info-container" :class="{ 'mobile-font': isMobile, 'not-transparent': isBot }" v-if="isShow"
      @click.stop="">
      <div v-if="type == INFO_TYPE.Card || type == INFO_TYPE.Support"
        @click.stop="showRule((info as Card).UI.description, ...skillExplain.flat(2))">
        <div class="info-base">
          <img v-if="isBot" class="info-base-img" :src="getPngIcon(info?.UI.src, true)" :alt="info?.name">
          <div>
            <div class="name">{{ (info as Card).name }}</div>
            <div>
              <div class="info-card-cost">
                <img class="cost-img" :src="getDiceIcon(ELEMENT_ICON[(info as Card).costType])" />
                <span>{{ (info as Card).cost }}</span>
              </div>
              <div class="info-card-anydice" v-if="(info as Card).anydice > 0">
                <img class="cost-img" :src="getDiceIcon(ELEMENT_ICON[DICE_TYPE.Any])" />
                <span>{{ (info as Card).anydice }}</span>
              </div>
              <div class="info-card-energy" v-if="(info as Card).energy != 0">
                <img class="cost-img"
                  :src="getDiceIcon(ELEMENT_ICON[(info as Card).energy > 0 ? COST_TYPE.Energy : COST_TYPE.SpEnergy])" />
                <span>{{ (info as Card).energy }}</span>
              </div>
              <div class="info-card-legend" v-if="(info as Card).hasSubtype(CARD_SUBTYPE.Legend)">
                <img class="cost-img" :src="getDiceIcon(ELEMENT_ICON[CARD_SUBTYPE.Legend])" />
              </div>
            </div>
            <div class="info-card-type">{{ CARD_TYPE_NAME[(info as Card).type] }}</div>
            <div class="info-card-type sub" v-for="(subtype, suidx) in (info as Card).subType" :key="suidx">
              {{ CARD_SUBTYPE_NAME[subtype] }}
            </div>
            <div v-if="(info as Card).hasSubtype(CARD_SUBTYPE.Weapon)" class="info-card-type sub">
              {{ WEAPON_TYPE_NAME[(info as Card).userType as WeaponType] }}
            </div>
          </div>
        </div>
        <div class="info-card-desc" v-for="(desc, didx) in (info as Card).UI.descriptions" :key="didx" v-html="desc">
        </div>
        <div class="info-card-explain"
          v-for="(expl, eidx) in skillExplain.filter(() => !(info as Card).hasSubtype(CARD_SUBTYPE.Vehicle))"
          :key="eidx" style="margin-top: 5px">
          <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
        </div>
      </div>
      <div v-if="type == INFO_TYPE.Hero || type == INFO_TYPE.Skill ||
        (type == INFO_TYPE.Card && (info as Card).hasSubtype(CARD_SUBTYPE.Vehicle))">
        <div class="info-base">
          <div class="info-hero-hp" v-if="isBot && type == INFO_TYPE.Hero">
            <img class="hero-hp-bg" src="@@/image/hero-hp-bg.png" />
            <div class="hero-hp-cnt">{{ (info as Hero).maxHp }}</div>
          </div>
          <img v-if="isBot && type == INFO_TYPE.Hero" class="info-base-img info-hero-base-img"
            :src="getPngIcon(info?.UI.src, true)" :alt="info?.name">
          <div>
            <div v-if="type == INFO_TYPE.Hero" class="name">{{ (info as Hero).name }}</div>
            <div v-if="type == INFO_TYPE.Hero" class="info-hero-tag">
              <span>{{ ELEMENT_NAME[(info as Hero).element] }}</span>
              <span>{{ WEAPON_TYPE_NAME[(info as Hero).weaponType] }}</span>
              <span v-for="(tag, tidx) in (info as Hero).tags" :key="tidx">
                {{ HERO_TAG_NAME[tag] }}
              </span>
            </div>
          </div>
        </div>
        <div class="info-hero-skill" v-for="(skill, sidx) in skills.filter(
          (sk, i) => type == INFO_TYPE.Card ||
            type == INFO_TYPE.Hero && sk.type != SKILL_TYPE.PassiveHidden && (sk.type != SKILL_TYPE.Vehicle || i > 0) ||
            type == INFO_TYPE.Skill && i == skidx)" :key="sidx">
          <div class="info-hero-skill-title" @click.stop="showDesc(isShowSkill, sidx)">
            <div style="display: flex; flex-direction: row; align-items: center">
              <img class="skill-img" :src="skill.UI.src" v-if="skill.UI.src.length > 0"
                :alt="SKILL_TYPE_ABBR[skill.type]" />
              <span v-else class="skill-img"
                style=" border-radius: 50%; text-align: center; line-height: 35px; border: 1px solid black; ">
                {{ SKILL_TYPE_ABBR[skill.type] }}
              </span>
              <span class="info-skill-costs">
                <div>{{ skill.name }}</div>
                <div>
                  <div class="skill-cost"
                    v-for="(cost, cidx) in skill.type != SKILL_TYPE.Passive && skill.cost.every(c => c.cnt <= 0) ? skill.cost.slice(0, 1) : skill.cost.filter(c => c.cnt > 0)"
                    :key="cidx" :style="{
                      color: type == INFO_TYPE.Skill && cidx < 2 && (skill.costChange[cidx] as number) > 0 ?
                        CHANGE_GOOD_COLOR : type == INFO_TYPE.Skill && cidx < 2 && (skill.costChange[cidx] as number) < 0 ?
                          CHANGE_BAD_COLOR : 'white'
                    }">
                    <img class="cost-img" :src="getDiceIcon(ELEMENT_ICON[cost.type])" />
                    <span>{{ Math.max(Math.abs(cost.cnt) - (type == INFO_TYPE.Skill && cidx < 2 ?
                      (skill.costChange[cidx] as number) : 0), 0) }}</span>
                  </div>
                </div>
              </span>
            </div>
            <span>{{ isShowSkill[sidx] ? "▲" : "▼" }}</span>
          </div>
          <div class="info-hero-skill-desc" v-if="isShowSkill[sidx]"
            @click.stop="showRule(skill.UI.description, ...skillExplain[type == INFO_TYPE.Skill ? skidx : sidx].flat(2))">
            <div class="skill-type">{{ SKILL_TYPE_NAME[skill.type] }}</div>
            <div v-for="(desc, didx) in skill.UI.descriptions" :key="didx" v-html="desc"></div>
          </div>
          <div v-if="isShowSkill[sidx]"
            @click.stop="showRule(skill.UI.description, ...skillExplain[type == INFO_TYPE.Skill ? skidx : sidx].flat(2))">
            <div class="info-hero-skill-explain"
              v-for="(expl, eidx) in skillExplain[type == INFO_TYPE.Skill ? skidx : sidx + +(type != INFO_TYPE.Card && skills[0].type == SKILL_TYPE.Vehicle)]"
              :key="eidx">
              <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
            </div>
          </div>
        </div>
        <div v-if="type == INFO_TYPE.Skill && skills[skidx].type != SKILL_TYPE.Vehicle">
          <div class="info-equipment" v-if="(info as Hero).equipments.length > 0">
            <div class="title">—— 角色装备 ——</div>
            <div class="equipment" v-for="(slot, slidx) in (info as Hero).equipments" :key="slidx">
              <div class="equipment-title" @click.stop="showDesc(isEquipment, slidx)">
                <span class="equipment-title-left">
                  <div class="equipment-icon">
                    <img class="equipment-icon-img" :src="getEquipmentIcon((slot as Card).subType[0])" />
                  </div>
                  <div class="status-cnt" v-if="(slot as Card).useCnt > -1">
                    {{ Math.floor((slot as Card).useCnt) }}
                  </div>
                  <span>{{ (slot as Card).name }}</span>
                </span>
                <span>{{ isEquipment[slidx] ? "▲" : "▼" }}</span>
              </div>
              <div v-if="isEquipment[slidx]"
                @click.stop="showRule((slot as Card).UI.description, ...slotExplain[slidx].flat(2))">
                <div class="equipment-desc" v-for="(desc, didx) in (slot as Card).UI.descriptions" :key="didx"
                  v-html="desc">
                </div>
                <div class="info-card-explain" v-for="(expl, eidx) in slotExplain[slidx]" :key="eidx">
                  <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="(info as Hero).heroStatus.length > 0" class="info-status">
            <div class="title">—— 角色状态 ——</div>
            <div v-for="(ist, idx) in (info as Hero).heroStatus.filter(sts => !sts.hasType(STATUS_TYPE.Hide))"
              :key="ist.id" class="status">
              <div class="status-title" @click.stop="showDesc(isHeroStatus, idx)">
                <span class="status-title-left">
                  <div class="status-icon">
                    <div class="status-bg" :style="{ background: ist.UI.iconBg }"></div>
                    <img v-if="getPngIcon(ist.UI.icon) != ''" :src="getPngIcon(ist.UI.icon)" :style="{
                      filter: (getPngIcon(ist.UI.icon).startsWith('https') ||
                        ist.UI.icon.startsWith('buff') ||
                        ist.UI.icon.endsWith('dice')) && !getPngIcon(ist.UI.icon).includes('guyutongxue')
                        ? getSvgFilter(ist.UI.iconBg) : ''
                    }" />
                    <div v-else style="color: white;">{{ ist.name[0] }}</div>
                    <div class="status-cnt"
                      v-if="!ist.hasType(STATUS_TYPE.Sign) && (ist.useCnt >= 0 || ist.roundCnt >= 0)">
                      {{ ist.useCnt < 0 ? ist.roundCnt : ist.useCnt }} </div>
                    </div>
                    <span>{{ ist.name }}</span>
                </span>
                <span>{{ isHeroStatus[idx] ? "▲" : "▼" }}</span>
              </div>
              <div v-if="isHeroStatus[idx]"
                @click.stop=" showRule(ist.UI.description, ...heroStatusExplain[idx].flat(2))">
                <div class="status-desc" v-for="(desc, didx) in ist.UI.descriptions" :key="didx" v-html="desc"></div>
                <div v-if="heroStatusExplain[idx].length > 0">
                  <div class="info-hero-status-explain" v-for="(expl, eidx) in heroStatusExplain[idx]" :key="eidx">
                    <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="combatStatus.length > 0" class="info-status">
            <div class="title">—— 阵营出战状态 ——</div>
            <div v-for="(ost, idx) in combatStatus.filter(sts => !sts.hasType(STATUS_TYPE.Hide))" :key="ost.id"
              class="status">
              <div class="status-title" @click.stop="showDesc(isCombatStatus, idx)">
                <span class="status-title-left">
                  <div class="status-icon">
                    <div class="status-bg" :style="{ background: ost.UI.iconBg }"></div>
                    <img v-if="getPngIcon(ost.UI.icon) != ''" :src="getPngIcon(ost.UI.icon)" :style="{
                      filter: (getPngIcon(ost.UI.icon).startsWith('https') ||
                        ost.UI.icon.startsWith('buff') ||
                        ost.UI.icon.endsWith('dice')) && !getPngIcon(ost.UI.icon).includes('guyutongxue')
                        ? getSvgFilter(ost.UI.iconBg) : ''
                    }" />
                    <div v-else style="color: white;">{{ ost.name[0] }}</div>
                    <div class="status-cnt"
                      v-if="!ost.hasType(STATUS_TYPE.Sign) && (ost.useCnt >= 0 || ost.roundCnt >= 0)">
                      {{ ost.useCnt < 0 ? ost.roundCnt : ost.useCnt }} </div>
                    </div>
                    <span>{{ ost.name }}</span>
                </span>
                <span>{{ isCombatStatus[idx] ? "▲" : "▼" }}</span>
              </div>
              <div v-if="isCombatStatus[idx]"
                @click.stop="showRule(ost.UI.description, ...combatStatusExplain[idx].flat(2))">
                <div class="status-desc" v-for="(desc, didx) in ost.UI.descriptions" :key="didx" v-html="desc"></div>
                <div v-if="combatStatusExplain[idx].length > 0">
                  <div class="info-hero-status-explain" v-for="(expl, eidx) in combatStatusExplain[idx]" :key="eidx">
                    <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="type == INFO_TYPE.Summon" @click.stop="showRule((info as Summon).UI.description)">
        <div class="info-base">
          <img v-if="isBot" class="info-base-img" :src="info?.UI.src" :alt="info?.name">
          <div>
            <div class="name">{{ (info as Summon).name }}</div>
            <div style="font-weight: bolder;color: #afa04b;padding-left: 4px;">召唤物</div>
          </div>
        </div>
        <div class="summon-desc" v-for="(desc, didx) in (info as Summon).UI.descriptions" :key="didx" v-html="desc">
        </div>
        <div class="info-summon-explain" v-for="(expl, eidx) in smnExplain" :key="eidx" style="margin-top: 5px">
          <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
        </div>
      </div>
    </div>
    <div class="info-container" :class="{ 'mobile-font': isMobile }" @click.stop=""
      v-if="isShow && type == INFO_TYPE.Hero && ((info as Hero).equipments.length > 0 || (info as Hero).heroStatus.length > 0 || combatStatus.length > 0)">
      <div class="info-equipment" v-if="(info as Hero).equipments.length > 0">
        <div class="title">—— 角色装备 ——</div>
        <div class="equipment" v-for="(slot, slidx) in (info as Hero).equipments" :key="slidx">
          <div class="equipment-title" @click.stop="showDesc(isEquipment, slidx)">
            <span class="equipment-title-left">
              <div class="equipment-icon">
                <img class="equipment-icon-img" :src="getEquipmentIcon((slot as Card).subType[0])" />
              </div>
              <div class="status-cnt" v-if="(slot as Card).useCnt > -1">
                {{ Math.floor((slot as Card).useCnt) }}
              </div>
              <span>{{ (slot as Card).name }}</span>
            </span>
            <span>{{ isEquipment[slidx] ? "▲" : "▼" }}</span>
          </div>
          <div v-if="isEquipment[slidx]"
            @click.stop="showRule((slot as Card).UI.description, ...slotExplain[slidx].flat(2))">
            <div class="equipment-desc" v-for="(desc, didx) in (slot as Card).UI.descriptions" :key="didx"
              v-html="desc">
            </div>
            <div v-if="slotExplain[slidx].length > 0">
              <div class="info-card-explain" v-for="(expl, eidx) in slotExplain[slidx]" :key="eidx">
                <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="(info as Hero).heroStatus.length > 0" class="info-status">
        <div class="title">—— 角色状态 ——</div>
        <div v-for="(ist, idx) in (info as Hero).heroStatus.filter(sts => !sts.hasType(STATUS_TYPE.Hide))" :key="ist.id"
          class="status">
          <div class="status-title" @click.stop="showDesc(isHeroStatus, idx)">
            <span class="status-title-left">
              <div class="status-icon">
                <div class="status-bg" :style="{ background: ist.UI.iconBg }"></div>
                <img v-if="getPngIcon(ist.UI.icon) != ''" :src="getPngIcon(ist.UI.icon)" :style="{
                  filter: (getPngIcon(ist.UI.icon).startsWith('https') ||
                    ist.UI.icon.startsWith('buff') ||
                    ist.UI.icon.endsWith('dice')) && !getPngIcon(ist.UI.icon).includes('guyutongxue')
                    ? getSvgFilter(ist.UI.iconBg) : ''
                }" />
                <div v-else style="color: white;">{{ ist.name[0] }}</div>
                <div class="status-cnt" v-if="!ist.hasType(STATUS_TYPE.Sign) && (ist.useCnt >= 0 || ist.roundCnt >= 0)">
                  {{ ist.useCnt < 0 ? ist.roundCnt : ist.useCnt }} </div>
                </div>
                <span>{{ ist.name }}</span>
            </span>
            <span>{{ isHeroStatus[idx] ? "▲" : "▼" }}</span>
          </div>
          <div v-if="isHeroStatus[idx]" @click.stop="showRule(ist.UI.description, ...heroStatusExplain[idx].flat(2))">
            <div class="status-desc" v-for="(desc, didx) in ist.UI.descriptions" :key="didx" v-html="desc"></div>
            <div v-if="heroStatusExplain[idx].length > 0">
              <div class="info-hero-status-explain" v-for="(expl, eidx) in heroStatusExplain[idx]" :key="eidx">
                <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="combatStatus.length > 0" class="info-status">
        <div class="title">—— 阵营出战状态 ——</div>
        <div v-for="(ost, idx) in combatStatus.filter(sts => !sts.hasType(STATUS_TYPE.Hide))" :key="ost.id"
          class="status">
          <div class="status-title" @click.stop="showDesc(isCombatStatus, idx)">
            <span class="status-title-left">
              <div class="status-icon">
                <div class="status-bg" :style="{ background: ost.UI.iconBg }"></div>
                <img v-if="getPngIcon(ost.UI.icon) != ''" :src="getPngIcon(ost.UI.icon)" :style="{
                  filter: (getPngIcon(ost.UI.icon).startsWith('https') ||
                    ost.UI.icon.startsWith('buff') ||
                    ost.UI.icon.endsWith('dice')) && !getPngIcon(ost.UI.icon).includes('guyutongxue')
                    ? getSvgFilter(ost.UI.iconBg) : ''
                }" />
                <div v-else style="color: white;">{{ ost.name[0] }}</div>
                <div class="status-cnt" v-if="!ost.hasType(STATUS_TYPE.Sign) && (ost.useCnt >= 0 || ost.roundCnt >= 0)">
                  {{ ost.useCnt < 0 ? ost.roundCnt : ost.useCnt }} </div>
                </div>
                <span>{{ ost.name }}</span>
            </span>
            <span>{{ isCombatStatus[idx] ? "▲" : "▼" }}</span>
          </div>
          <div v-if="isCombatStatus[idx]"
            @click.stop="showRule(ost.UI.description, ...combatStatusExplain[idx].flat(2))">
            <div class="status-desc" v-for="(desc, didx) in ost.UI.descriptions" :key="didx" v-html="desc"></div>
            <div v-if="combatStatusExplain[idx].length > 0">
              <div class="info-hero-status-explain" v-for="(expl, eidx) in combatStatusExplain[idx]" :key="eidx">
                <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="info-container info-rule" :class="{ 'mobile-font': isMobile }"
      v-if="isShow && isShowRule && ruleExplain.length > 0">
      <div class="title">—— 规则解释 ——</div>
      <div class="rule-desc" v-for="(rule, ridx) in ruleExplain" :key="ridx" v-html="rule"></div>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { computed, ref, watchEffect } from 'vue';

import {
  CARD_SUBTYPE_NAME, CARD_SUBTYPE_URL, CARD_TYPE_NAME, CHANGE_BAD_COLOR, CHANGE_GOOD_COLOR, DICE_COLOR, ELEMENT_COLOR, ELEMENT_ICON,
  ELEMENT_NAME, ELEMENT_URL, ElementColorKey, HERO_TAG_NAME, HERO_TAG_URL, RULE_EXPLAIN, SKILL_TYPE_ABBR,
  SKILL_TYPE_NAME, STATUS_BG_COLOR_CODE, STATUS_BG_COLOR_KEY, STATUS_ICON, StatusBgColor, WEAPON_TYPE_NAME, WEAPON_TYPE_URL,
} from '@@@/constant/UIconst';
import {
  CARD_SUBTYPE, CardSubtype, COST_TYPE, DAMAGE_TYPE, DICE_COST_TYPE, DICE_TYPE, ELEMENT_CODE_KEY, ElementCode, ElementType, INFO_TYPE,
  InfoType, SKILL_TYPE, STATUS_TYPE, Version, WeaponType,
} from '@@@/constant/enum';
import { newCard } from '@@@/data/cards';
import { newHero } from '@@@/data/heros';
import { newSkill } from '@@@/data/skills';
import { newStatus } from '@@@/data/statuses';
import { newSummon } from '@@@/data/summons';
import { objToArr } from '@@@/utils/utils';
import { Card, ExplainContent, GameInfo, Hero, InfoVO, Skill, Status, Summon } from '../../../typing';
import { getVehicleIdByCid } from '@@@/utils/gameUtil';

const props = defineProps<{
  info: InfoVO,
  isMobile: boolean,
  isInGame?: boolean,
  round?: number,
  playerInfo?: GameInfo,
  isBot?: boolean,
}>();

const isMobile = computed<boolean>(() => props.isMobile);
const isInGame = computed<boolean>(() => !!props.isInGame); // 是否在游戏中显示(用于一些游戏实时数据的显示)
const round = computed<number>(() => props.round ?? 0); // 当前回合
const playerInfo = computed<GameInfo | undefined>(() => props.playerInfo); // 玩家全局信息
const version = computed<Version>(() => props.info.version); // 版本
const isShow = computed<boolean>(() => props.info.isShow); // 是否显示
const type = computed<InfoType | null>(() => props.info.type); // 显示类型：技能 角色 卡牌 召唤物 支援物
const info = computed<Hero | Card | Summon | null>(() => props.info.info); // 展示信息
const skidx = computed<number>(() => props.info.skidx ?? -1); // 技能序号
const combatStatus = computed<Status[]>(() => props.info.combatStatus ?? []); // 出战状态
const isBot = computed<boolean>(() => props.isBot ?? false); // 是否为bot截图
const skills = ref<Skill[]>([]); // 展示技能
const isShowSkill = ref<boolean[]>([]); // 是否展示技能
const isHeroStatus = ref<boolean[]>([]); // 是否展示角色状态
const isCombatStatus = ref<boolean[]>([]); // 是否展示阵营出战状态
const isEquipment = ref<boolean[]>([]); // 是否展示装备
const skillExplain = ref<(string[][] | string[])[]>([]); // 技能/卡牌解释
const heroStatusExplain = ref<any[]>([]); // 状态技能解释
const combatStatusExplain = ref<any[]>([]); // 状态技能解释
const slotExplain = ref<any[]>([]); // 装备解释
const smnExplain = ref<any[]>([]); // 召唤物解释
const ruleExplain = ref<any[]>([]); // 规则解释
const isShowRule = ref<boolean>(false); // 是否显示规则

const wrapedIcon = (el?: ElementColorKey, isDice: boolean = false) => {
  if (el == undefined || el == DAMAGE_TYPE.Pierce || el == DICE_TYPE.Same || el == 'Heal') return '';
  let url = [...Object.keys(DICE_COLOR), DICE_COST_TYPE.Omni, DAMAGE_TYPE.Physical].some(v => v == el) ?
    isDice ? getPngIcon(ELEMENT_ICON[el] + '-dice-bg') : ELEMENT_URL[el as ElementType] :
    getPngIcon(ELEMENT_ICON[el]);
  if (el == STATUS_TYPE.Shield) url = STATUS_ICON.Shield;
  return `<img style='width:1em;transform:translateY(20%) scale(1.4);margin:0 0.2em' src='${url}'/>`;
}
const wrapExplCtt = (content: string) => {
  const [isMatch, botFlag = 'null', ctt] = content.match(/^(n?bot)?([a-z,0-9]+)$/) ?? [];
  if (!isMatch) return { name: content, default: true }
  const [a1, a2, a3] = ctt.slice(3).split(',').map(v => JSON.parse(v));
  const type = ctt.slice(0, 3);
  const res = type == 'crd' ? newCard(version.value)(a1) :
    type == 'sts' ? newStatus(version.value)(a1, a2, a3) :
      type == 'rsk' ? newSkill(version.value)(a1) :
        type == 'smn' ? newSummon(version.value)(a1, a2, a3) :
          type == 'ski' ? newHero(version.value)(a1).skills[a2] :
            type == 'hro' ? newHero(version.value)(a1) :
              { name: content, default: true };
  if ((botFlag != 'null' && (+isBot.value ^ +(botFlag == 'bot')))) {
    return { name: res.name, default: true }
  }
  return res;
}
type WrapExplainType = 'slot' | 'card' | 'support' | '';
const wrapDesc = (desc: string, options: { isExplain?: boolean, type?: WrapExplainType, obj?: ExplainContent }): string => {
  const wrapName = (_: string, isWhite: string, ctt: string) => `<span${isWhite == '' ? ` style='color:white;'` : ''}>${wrapExplCtt(ctt).name}</span>`;
  const { isExplain, type = '', obj } = options;
  let res = desc.slice()
    .replace(/〔g(.+)〕/g, (_, ctt: string) => isInGame.value ? '' : ctt)
    .replace(/〔(\*?)(\[.+?\])?(.+)〕/g, (_, nnc: string, f: string, ctt: string) => {
      const notNeedColor = !!nnc;
      const flag = (f || '').slice(1, -1);
      if (typeof obj != 'string' && obj != undefined && flag != '' && type != '' && flag != type) return '';
      if ((!isInGame.value && !notNeedColor) || isExplain) return '';
      ctt = ctt
        .replace(/{round}/, `${round.value}`)
        .replace(/{dessptcnt}/, `${playerInfo.value?.destroyedSupport}`)
        .replace(/{eldmgcnt}/, `${playerInfo.value?.oppoGetElDmgType.toString(2).split('').filter(v => +v).length}`)
      if (typeof obj != 'string' && obj != undefined) {
        ctt = ctt.replace(/{pct}/, `${-obj.perCnt}`).replace(/{unt}/, `${obj.useCnt}`);
      }
      return `<span${notNeedColor ? '' : ' style="color:#d5bb49;"'}>${ctt}</span>`
    })
    .replace(/(?<!\\)(\*?)〖(.+?)〗/g, wrapName)
    .replace(/(?<!\\)(\*?)【(.+?)】/g, wrapName)
    .replace(/(?<!\\)(「)(.*?)(」)/g, (_, prefix: string, word: string, suffix: string) => {
      let icon = '';
      const [subtype] = objToArr(CARD_SUBTYPE_NAME).find(([, name]) => name == word) ?? [];
      const [weapon] = objToArr(WEAPON_TYPE_NAME).find(([, name]) => name == word) ?? [];
      const [tag] = objToArr(HERO_TAG_NAME).find(([, name]) => name == word) ?? [];
      const iconUrl = subtype != undefined ? CARD_SUBTYPE_URL[subtype] :
        weapon != undefined ? WEAPON_TYPE_URL[weapon] :
          tag != undefined && !!HERO_TAG_URL[tag] ? HERO_TAG_URL[tag] : '';
      if (iconUrl != '') {
        icon = `<img style='width:18px;transform:translateY(20%);' src='${iconUrl}'/>`;
      }
      return `<span style='color:white;'>${prefix}${icon}${word}${suffix}</span>`;
    })
    .replace(/(?<!\\)‹(\d+)(.*?)›/g, (_, c: string, v: string) => {
      const color = ELEMENT_CODE_KEY[+c as ElementCode];
      return `${wrapedIcon(color)}<span style='color:${ELEMENT_COLOR[color]};'>${v.replace(" style='color:white;'", '')}</span>`;
    })
    .replace(/(?<!\\)‹(#\w{6})(.*?)›/g, (_, c: string, v: string) => `<span style='color:${c};'>${v.replace(" style='color:white;'", '')}</span>`)
    .replace(/(?<!\\)(\*?)\[(.*?)\]/g, (_, isUnderline: string, ctt: string) => {
      const [el] = objToArr(ELEMENT_NAME).find(([, v]) => ['元素', '伤害', '骰'].some(v => ctt.includes(v)) ? ctt.includes(v) : ctt == v) ?? [];
      const color = el == undefined ? 'white' : ELEMENT_COLOR[el];
      let wpicon = wrapedIcon(el, ctt.includes('骰'));
      const elSplit = ctt.indexOf('元素') - 1;
      if (elSplit > 0 && !ctt.includes('骰')) {
        const ctt1 = ctt.slice(0, elSplit);
        const ctt2 = ctt.slice(elSplit);
        ctt = ctt1 + wpicon + ctt2;
        wpicon = '';
      }
      const [subtype] = objToArr(CARD_SUBTYPE_NAME).find(([, name]) => name == ctt) ?? [];
      if (subtype) wpicon ||= `<img style='width:18px;transform:translateY(20%);' src='${CARD_SUBTYPE_URL[subtype]}'/>`;
      const underline = isUnderline == '' ? `border-bottom:2px solid ${color};cursor:pointer;` : '';
      // const underline = isUnderline == '' ? `text-decoration: underline;cursor:pointer;` : '';
      // const marginLeft = el == undefined || el == DAMAGE_TYPE.Pierce || el == DICE_TYPE.Same ? 'margin-left:2px;' : '';
      // return `${wpicon}<span style='color:${color};${underline}margin-right:2px;${marginLeft}'>${ctt}</span>`;
      return `${wpicon}<span style='color:${color};${underline}'>${ctt}</span>`;
    })
    .replace(/\\/g, '');
  if (obj && typeof obj != 'string') {
    if ('dmgChange' in obj) { // Skill
      const isChange = obj.dmgChange > 0;
      const dmg = Number(res.match(/{dmg\+?(\d*)}/)?.[1]) || 0;
      res = res.replace(/{dmg\+?\d*}/g, `${isChange ? `<span style='color:${CHANGE_GOOD_COLOR};'>` : ''}${Math.abs(obj.damage + obj.dmgChange + dmg)}${isChange ? '</span>' : ''}`);
    }
    if ('damage' in obj) { // Summon | Skill
      const dmg = Number(res.match(/{dmg\+?(\d*)}/)?.[1]) || 0;
      res = res.replace(/{dmg\+?\d*}/g, `${Math.abs(obj.damage + dmg)}`);
    }
    if ('useCnt' in obj && 'roundCnt' in obj) res = res.replace('{useCnt}', `${obj.useCnt > -1 ? obj.useCnt : obj.roundCnt}`);
    if ('useCnt' in obj && !('roundCnt' in obj)) res = res.replace('{useCnt}', `${obj.useCnt}`);
    if ('roundCnt' in obj) res = res.replace('{roundCnt}', `${obj.roundCnt}`); // Status
    if ('shieldOrHeal' in obj) { // Summon
      res = res.replace('{shield}', `${Math.abs(obj.shieldOrHeal)}`).replace('{heal}', `${obj.shieldOrHeal}`);
    }
  }
  return res;
}
// 变白色：【】「」
// 下划线（有规则解释，如果可能前面会有图标）：[]
// 解析名字并加入解释：〖〗【】
// 有某些特殊颜色（如 冰/水/火/雷）：‹nxxx› n为1.字体元素颜色+前面的图标 2.直接用颜色#yyyyyy xxx为内容
// 卡牌上一些实时信息：〔〕 [slot]只在装备栏时显示 [card]只在手牌中显示 [support]只在支援物中显示
// 一些参考括号类型「」﹝﹞«»‹›〔〕〖〗『』〈〉《》【】[]

const wrapExpl = (expls: ExplainContent[], memo: string | string[]): string[][] => {
  const container: string[][] = [];
  if (typeof memo == 'string') memo = [memo];
  for (let expl of expls) {
    const explains: string[] = [];
    if (typeof expl == 'string') {
      const nctt = wrapExplCtt(expl);
      if (nctt.name == '' || 'skills' in nctt || 'default' in nctt) continue;
      expl = nctt;
    }
    if (memo.includes(expl.id + expl.name)) continue;
    memo.push(expl.id + expl.name);
    const nameEl = `<span style="font-weight:bold;color:white;">${expl.name}</span>`;
    const cardStyle = 'width:35px;margin-right:5px;margin-bottom:5px;';
    const statusStyle = 'width:25px;margin-right:2px;';
    const skillStyle = 'width:25px;margin-right:5px;';
    const realSrcReg = /^http|tmp/;
    const getSrc = <T extends { name: string, UI: object, id: number }>(obj: T, ...attrs: string[]) => {
      for (const attr of attrs) {
        if (attr in obj.UI && realSrcReg.test(obj.UI[attr])) {
          if ('costType' in obj || 'group' in obj) return getPngIcon(obj.UI[attr]);
          return obj.UI[attr];
        }
      }
      return getPngIcon(obj.id.toString(), true);
    }
    if ('cost' in expl) { // Card | Skill
      const isCard = 'costType' in expl;
      explains.push(
        `<div style="display:flex;align-items:center;">
          ${isBot.value ? `<img src="${getSrc(expl, 'src')}" style="${isCard ? cardStyle : skillStyle}"/>` : ''}
          <div style="display:flex;${isBot.value && isCard ? 'flex-direction:column;gap:3px;' : 'width:87%;'}">
            ${nameEl}
            ${'costType' in expl ?
          `<div class="skill-cost" style="margin-${isBot.value ? 'right' : 'left'}:5px;margin-top:0;" >
              <img class="cost-img" src="${getDiceIcon(ELEMENT_ICON[expl.costType])}"/>
              <span>${expl.cost}</span>
            </div>`: isBot.value ?
            `${(expl.cost.every(c => c.cnt <= 0) ? expl.cost.slice(0, 1) : expl.cost.filter(c => c.cnt > 0)).map(c =>
              `<div class="skill-cost" style="margin-left:5px;margin-top:0;" >
                  <img class="cost-img" src="${getDiceIcon(ELEMENT_ICON[c.type])}"/>
                  <span>${c.cnt}</span>
                </div>`
            ).join('')}` : ''}
            ${isBot.value ?
          `<div style="${isCard ? '' : 'margin-left:auto;'}color:#d0c298;">
              ${'damage' in expl ? SKILL_TYPE_NAME[expl.type] : `${CARD_TYPE_NAME[expl.type]}牌`}
            </div>` : ''}
          </div>
        </div>`
      );
    } else { // Status | Summon
      const isStatus = 'group' in expl;
      explains.push(
        `<div div style="display:flex;align-items:center;">
          ${!isBot.value ? nameEl :
          `<img src="${getSrc(expl, 'src', 'icon')}" style="${isStatus ? statusStyle : cardStyle}"/>
           <div style="display:flex;${'damage' in expl ? 'flex-direction:column;gap:3px;' : 'width:87%;'}" >
            ${nameEl}
            <span style="${isStatus ? 'margin-left:auto;' : ''}color:#d0c298;">
             ${'group' in expl ? `${['角色', '出战'][expl.group]}状态` : '召唤物'}
            </span>
           </div>`
        }
        </div>`
      );
    }
    explains.push(...expl.UI.description.split(/(?<!\\)；/).map(desc => wrapDesc(desc, { isExplain: true, obj: expl })));
    container.push(explains);
    if (expl.UI.explains.length > 0) {
      container.push(...wrapExpl(expl.UI.explains, memo));
    }
  }
  return container;
}

const wrapRule = (...desc: string[]) => {
  ruleExplain.value = [];
  [...new Set(desc.join('').replace(/<img[^<>]+>/g, '').replace(/\>/g, '[').replace(/\</g, ']').match(/(?<=\[).*?(?=\])/g))].forEach(title => {
    if (title in RULE_EXPLAIN) {
      ruleExplain.value.push(`<div div style = 'font-weight:bold;border-top: 2px solid #6f84a0;padding-top:5px;' > ${wrapDesc(`*[${title}]`, { isExplain: true })} </div>`);
      ruleExplain.value.push(...RULE_EXPLAIN[title].split(/(?<!\\)；/).map(desc => wrapDesc(desc, { isExplain: true })));
    }
  });
}

// 获取骰子背景
const getDiceIcon = (name: string) => {
  return `/image/${name}-dice-bg.png`;
}

// 获取png图片
const getPngIcon = (name: string = '', isUseOnlineSrc: boolean = false) => {
  if (name.startsWith('http') || name == '') return name;
  if (isUseOnlineSrc) {
    if (name.includes('tmp')) return `/image/${name}.png`;
    return `https://gi-tcg-assets.guyutongxue.site/api/v2/images/${name}`;
  }
  if (name.endsWith('-dice')) return getSvgIcon(name);
  if (name.startsWith('ski')) {
    if (name.includes(',')) {
      const [hid, skidx] = name.slice(3).split(',').map(v => JSON.parse(v));
      return newHero(version.value)(hid).skills?.[skidx].UI.src ?? '';
    }
    return newSkill(version.value)(+name.slice(3)).UI.src ?? '';
  }
  if (name.includes('energy')) name += '-dice-bg';
  return `/image/${name}.png`;
}

// 获取svg
const getSvgIcon = (name: string) => {
  return `/svg/${name}.svg`;
}

// 获取过滤器
const getSvgFilter = (statusColor: StatusBgColor) => {
  return `url(/svg/filter.svg#status-color-${STATUS_BG_COLOR_CODE[STATUS_BG_COLOR_KEY[statusColor]]})`;
}

// 获取装备图标
const getEquipmentIcon = (subtype: CardSubtype) => {
  if (subtype == CARD_SUBTYPE.Vehicle) return (info.value as Hero).vehicleSlot?.[1].UI.src || CARD_SUBTYPE_URL[subtype];
  return CARD_SUBTYPE_URL[subtype];
}

watchEffect(() => {
  ruleExplain.value = [];
  skills.value = [];
  isShowSkill.value = [];
  skillExplain.value = [];
  if (info.value && 'costType' in info.value) { // 卡牌
    info.value.UI.descriptions = info.value.UI.description
      .split(/(?<!\\)；/)
      .map(desc => wrapDesc(desc, { obj: info.value as Card, type: type.value == INFO_TYPE.Support ? 'support' : 'card' }))
      .filter(v => v != '');
    if (type.value == INFO_TYPE.Support) { // 支援物
      const onceDesc = info.value.UI.descriptions.findIndex(v => v.includes('入场时：'));
      if (onceDesc > -1) info.value.UI.descriptions.splice(onceDesc, 1);
    }
    skillExplain.value = wrapExpl(info.value.UI.explains, info.value.id + info.value.name);
    if (info.value.hasSubtype(CARD_SUBTYPE.Vehicle)) {
      const vehicle = newSkill(version.value)(getVehicleIdByCid(info.value.id));
      vehicle.UI.descriptions = vehicle.UI.description.split(/(?<!\\)；/).map(desc => wrapDesc(desc, { obj: vehicle }));
      skills.value.push(vehicle);
      isShowSkill.value.push(true);
      skillExplain.value = [wrapExpl(vehicle.UI.explains, vehicle.id + vehicle.name)];
    }
  }
  if (info.value && 'maxUse' in info.value) { // 召唤物
    smnExplain.value = wrapExpl(info.value.UI.explains, info.value.id + info.value.name);
    info.value.UI.descriptions = info.value.UI.description.split(/(?<!\\)；/).map(desc => wrapDesc(desc, { obj: info.value as Summon }));
    const onceDesc = info.value.UI.descriptions.findIndex(v => v.includes('入场时：'));
    if (onceDesc > -1) info.value.UI.descriptions.splice(onceDesc, 1);
  }
  if (info.value && 'heroStatus' in info.value) { // 角色
    heroStatusExplain.value = [];
    combatStatusExplain.value = [];
    info.value.heroStatus.forEach(ist => {
      ist.UI.descriptions = ist.UI.description.split(/(?<!\\)；/).map(desc => wrapDesc(desc, { obj: ist }));
      heroStatusExplain.value.push(wrapExpl(ist.UI.explains, ist.id + ist.name));
    });
    combatStatus.value.forEach(ost => {
      ost.UI.descriptions = ost.UI.description.split(/(?<!\\)；/).map(desc => wrapDesc(desc, { obj: ost }));
      combatStatusExplain.value.push(wrapExpl(ost.UI.explains, ost.id + ost.name));
    });
    for (const skill of info.value.skills) {
      skills.value.push(skill);
      isShowSkill.value.push(type.value == INFO_TYPE.Skill);
    }
    slotExplain.value = [];
    info.value.equipments.forEach(slot => {
      const desc = slot.UI.description.split(/(?<!\\)；/).map(desc => wrapDesc(desc, { obj: slot, type: 'slot' })).filter(v => v != '');
      const isActionTalent = [CARD_SUBTYPE.Action, CARD_SUBTYPE.Talent].every(v => slot.hasSubtype(v));
      slot.UI.descriptions = isActionTalent ? desc.slice(1 + +desc[1].includes('立刻使用一次')) : desc;
      const onceDesc = slot.UI.descriptions.findIndex(v => /入场时(?:：|，)|才能打出/.test(v));
      if (onceDesc > -1) slot.UI.descriptions.splice(onceDesc, 1);
      slotExplain.value.push(wrapExpl(slot.UI.explains.slice(+isActionTalent), slot.id + slot.name));
      if (slot.hasSubtype(CARD_SUBTYPE.Vehicle)) {
        skills.value.unshift((info.value as Hero).vehicleSlot![1]);
        skills.value.push((info.value as Hero).vehicleSlot![1]);
        isShowSkill.value.push(type.value == INFO_TYPE.Skill);
      }
    });
    skills.value.forEach(skill => {
      skill.UI.descriptions = skill.UI.description.split(/(?<!\\)；/).map(desc => wrapDesc(desc, { obj: skill }));
      skillExplain.value.push(wrapExpl(skill.UI.explains, skill.id + skill.name));
    });
    isHeroStatus.value = new Array(info.value.heroStatus.length).fill(false);
    isCombatStatus.value = new Array(combatStatus.value.length).fill(false);
    isEquipment.value = new Array(info.value.equipments.length).fill(false);
  }
  if (isBot.value) isShowSkill.value.fill(true);
});

// 是否显示描述
const showDesc = (obj: boolean[], sidx: number) => {
  isShowRule.value = false;
  obj[sidx] = !obj[sidx];
}

// 是否显示规则
const showRule = (...desc: string[]) => {
  isShowRule.value = !isShowRule.value;
  if (isShowRule.value) wrapRule(...desc);
}
</script>

<style scoped>
.info-outer-container {
  position: absolute;
  top: 40px;
  left: 20px;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  user-select: none;
  pointer-events: none;
  gap: 2px;
  font-family: HYWH;
}

[class$="-desc"],
[class$="-explain"] {
  line-height: 140%;
}

.info-img {
  width: 10vw;
  margin-right: 5px;
}

.info-container {
  position: relative;
  width: 25vw;
  max-height: 50vh;
  border: 2px solid #25364d;
  border-radius: 5px;
  background-color: #3e4d69e7;
  padding: 10px 5px;
  overflow: auto;
  pointer-events: all;
}

.not-transparent {
  background-color: #3e4d69;
  max-height: 2000px;
  border-radius: 0;
}

.name {
  font-weight: bolder;
  margin-bottom: 3px;
  color: #93aed4;
  padding-left: 3px;
}

.info-base-img {
  width: 25%;
}

.info-card-cost {
  position: relative;
  width: 20px;
  height: 20px;
  margin-bottom: 5px;
  line-height: 20px;
  color: white;
  font-size: medium;
  display: inline-block;
  -webkit-text-stroke: 1px black;
}

.cost-img {
  position: absolute;
  width: 25px;
  height: 25px;
}

.info-card-cost>span {
  position: absolute;
  width: 25px;
  height: 28px;
  line-height: 28px;
  text-align: center;
  align-content: center;
}

.info-card-energy,
.info-card-anydice,
.info-card-legend {
  position: relative;
  width: 20px;
  height: 20px;
  text-align: center;
  line-height: 20px;
  margin-bottom: 5px;
  margin-left: -5px;
  font-size: medium;
  color: white;
  display: inline-block;
  -webkit-text-stroke: 1px black;
}

.info-card-energy>span,
.info-card-anydice>span {
  position: absolute;
  left: 18px;
  top: 3px;
}

.info-card-type {
  display: inline-block;
  border: 2px solid #25364d;
  border-radius: 5px;
  background-color: #898989dd;
  padding: 0 5px;
  margin-bottom: 3px;
}

.info-card-type.sub {
  background-color: #5787dfdd;
  margin-left: 3px;
}

.info-base {
  display: flex;
  gap: 5px;
}

.info-hero-base-img {
  margin-left: 2px;
  border-radius: 5px;
}

.info-hero-hp {
  position: absolute;
  width: 10%;
  aspect-ratio: 1/1;
  left: 0;
  top: 2px;
}

.hero-hp-bg {
  position: absolute;
  width: 100%;
}

.hero-hp-cnt {
  position: absolute;
  width: 100%;
  height: 100%;
  text-align: center;
  align-content: center;
  color: white;
  -webkit-text-stroke: black 1px;
}

.info-hero-tag {
  margin: 5px 0;
  display: flex;
  flex-wrap: wrap;
}

.info-hero-tag>span {
  border: 2px solid #25364d;
  border-radius: 5px;
  margin: 1px;
  padding: 0 3px;
  background-color: #5786dfdd;
}

.info-hero-skill,
.info-status>.status,
.info-equipment>.equipment {
  border: 2px solid #25364d;
  margin-top: 3px;
  transition: 1s;
  border-radius: 4px;
}

.info-hero-skill-title,
.status-title,
.equipment-title {
  border: 2px solid #25364d;
  margin: 1px;
  padding: 1px 3px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  border-radius: 4px;
  color: #bdd5ff;
  background: #272f3be7;
}

.equipment-title-left,
.status-title-left {
  position: relative;
  display: flex;
  align-items: center;
  height: 25px;
}

.equipment-icon {
  position: relative;
  width: 25px;
  height: 25px;
  /* border: 2px solid #525252;
  border-radius: 50%;
  background: #d2d493; */
  margin-right: 3px;
}

.equipment-icon-img {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  /* filter: brightness(0.3); */
}

.status-icon {
  position: relative;
  width: 25px;
  height: 25px;
  margin: 2px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.status-icon>img {
  width: 100%;
  border-radius: 50%;
}

.status-bg {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 90%;
  height: 90%;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.25;
}

.status-cnt {
  position: absolute;
  left: 15px;
  bottom: 0;
  font-size: 12px;
  height: 12px;
  width: 12px;
  line-height: 12px;
  text-align: center;
  color: white;
  background: #000000ae;
  border-radius: 50%;
}

.info-hero-skill-desc,
.info-card-desc,
.status-desc,
.summon-desc,
.equipment-desc,
.rule-desc {
  color: #c8c8c8;
  margin: 2px;
  padding: 3px;
}

.info-hero-skill-explain,
.info-hero-status-explain,
.info-card-explain,
.info-summon-explain {
  margin: 3px;
  margin-right: 0;
  margin-top: 5px;
  padding: 3px;
  padding-top: 0;
  font-size: smaller;
  border-left: 3px #8f8f8f solid;
  box-sizing: border-box;
  color: #c8c8c8;
}

.skill-img {
  width: 35px;
  height: 35px;
  margin-right: 5px;
}

.info-skill-costs {
  display: flex;
  flex-direction: column;
}

.skill-type {
  color: #bfba83;
  font-weight: bold;
}

.info-status,
.info-equipment {
  margin-top: 2px;
}

.info-status>.title,
.info-equipment>.title,
.info-rule>.title {
  text-align: center;
  font-weight: bold;
  color: #93aed4;
}

.mobile-font {
  font-size: small;
}

svg {
  display: none;
}

::-webkit-scrollbar {
  width: 5px;
  height: 5px;
  background: #2f405bd0;
}

::-webkit-scrollbar-thumb {
  border-radius: 5px;
  background: #8caee1d0;
}


@media screen and (orientation: portrait) {
  .info-container {
    width: 25vh;
    max-height: 50vw;
  }
}
</style>

<style>
.info-outer-container>.info-container .skill-cost {
  width: 17px;
  height: 17px;
  margin: 0 2px;
  margin-top: 5px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  color: white;
  -webkit-text-stroke: 1px black;
}

.info-outer-container>.info-container .skill-cost>.cost-img {
  position: absolute;
  width: 23px;
  height: 23px;
}

.info-outer-container>.info-container .skill-cost>span {
  position: absolute;
  width: 23px;
  height: 17px;
  text-align: center;
  align-content: center;
}
</style>