<template>
  <div class="info-outer-container">
    <div class="info-container" :class="{ 'mobile-font': isMobile }" v-if="isShow" @click.stop="">
      <div v-if="type == INFO_TYPE.Card || type == INFO_TYPE.Support"
        @click.stop="showRule((info as Card).UI.description, ...skillExplain.flat(2))">
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
          <div class="info-card-energy" v-if="(info as Card).energy > 0">
            <img class="cost-img" :src="getDiceIcon(ELEMENT_ICON[COST_TYPE.Energy])" />
            <span>{{ (info as Card).energy }}</span>
          </div>
          <div class="info-card-legend" v-if="(info as Card).subType.includes(CARD_SUBTYPE.Legend)">
            <img class="cost-img" :src="getDiceIcon(ELEMENT_ICON[CARD_SUBTYPE.Legend])" />
          </div>
        </div>
        <div class="info-card-type">{{ CARD_TYPE_NAME[(info as Card).type] }}</div>
        <div class="info-card-type sub" v-for="(subtype, suidx) in (info as Card).subType" :key="suidx">
          {{ CARD_SUBTYPE_NAME[subtype] }}
        </div>
        <div v-if="(info as Card).subType.includes(CARD_SUBTYPE.Weapon)" class="info-card-type sub">
          {{ WEAPON_TYPE_NAME[(info as Card).userType as WeaponType] }}
        </div>
        <div class="info-card-desc" v-for="(desc, didx) in (info as Card).UI.descriptions" :key="didx" v-html="desc">
        </div>
        <div class="info-card-explain"
          v-for="(expl, eidx) in skillExplain.filter(() => !(info as Card).subType.includes(CARD_SUBTYPE.Vehicle))"
          :key="eidx" style="margin-top: 5px">
          <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
        </div>
      </div>
      <div v-if="type == INFO_TYPE.Hero || type == INFO_TYPE.Skill ||
        (type == INFO_TYPE.Card && (info as Card).subType.includes(CARD_SUBTYPE.Vehicle))">
        <div v-if="type == INFO_TYPE.Hero" class="name">{{ (info as Hero).name }}</div>
        <div v-if="type == INFO_TYPE.Hero" class="info-hero-tag">
          <span>{{ ELEMENT_NAME[(info as Hero).element] }}</span>
          <span>{{ WEAPON_TYPE_NAME[(info as Hero).weaponType] }}</span>
          <span v-for="(tag, tidx) in (info as Hero).tags" :key="tidx">
            {{ HERO_TAG_NAME[tag] }}
          </span>
        </div>
        <div class="info-hero-skill" v-for="(skill, sidx) in skills.filter(
          (sk, i) => type == INFO_TYPE.Card ||
            type == INFO_TYPE.Hero && (sk.type != SKILL_TYPE.Vehicle || i > 0) ||
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
                  <div class="skill-cost" v-for="(cost, cidx) in (skill as Skill).cost.filter(c => c.cnt > 0)"
                    :key="cidx" :style="{
                      color: cidx < 2 && (skill.costChange[cidx] as number) > 0 ?
                        CHANGE_GOOD_COLOR : cidx < 2 && (skill.costChange[cidx] as number) < 0 ?
                          CHANGE_BAD_COLOR : 'white'
                    }">
                    <img class="cost-img" :src="getDiceIcon(ELEMENT_ICON[cost.type])" />
                    <span>{{ Math.max(cost.cnt - (cidx < 2 ? (skill.costChange[cidx] as number) : 0), 0) }}</span>
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
              v-for="(expl, eidx) in skillExplain[type == INFO_TYPE.Skill ? skidx : sidx + +(skills[0].type == SKILL_TYPE.Vehicle)]"
              :key="eidx">
              <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
            </div>
          </div>
        </div>
        <div v-if="type == INFO_TYPE.Skill && skills[skidx].type != SKILL_TYPE.Vehicle">
          <div class="info-equipment"
            v-if="(info as Hero).weaponSlot || (info as Hero).talentSlot || (info as Hero).artifactSlot || (info as Hero).vehicleSlot">
            <div class="title">—— 角色装备 ——</div>
            <div class="equipment"
              v-for="(slot, slidx) in [(info as Hero).weaponSlot, (info as Hero).artifactSlot, (info as Hero).talentSlot, (info as Hero).vehicleSlot?.[0]].filter(s => s).sort((a, b) => b!.entityId - a!.entityId)"
              :key="slidx">
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
            <div v-for="(ist, idx) in (info as Hero).heroStatus.filter(sts => !sts.type.includes(STATUS_TYPE.Hide))"
              :key="ist.id" class="status">
              <div class="status-title" @click.stop="showDesc(isHeroStatus, idx)">
                <span class="status-title-left">
                  <div class="status-icon">
                    <div class="status-bg" :style="{ background: ist.UI.iconBg }"></div>
                    <img v-if="getPngIcon(ist.UI.icon) != ''" :src="getPngIcon(ist.UI.icon)" :style="{
                      filter: getPngIcon(ist.UI.icon).startsWith('https') || ist.UI.icon.startsWith('buff') || ist.UI.icon.endsWith('dice') ? getSvgFilter(ist.UI.iconBg) : ''
                    }" />
                    <div v-else style="color: white;">{{ ist.name[0] }}</div>
                    <div class="status-cnt"
                      v-if="!ist.type.includes(STATUS_TYPE.Sign) && (ist.useCnt >= 0 || ist.roundCnt >= 0)">
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
            <div v-for="(ost, idx) in combatStatus.filter(sts => !sts.type.includes(STATUS_TYPE.Hide))" :key="ost.id"
              class="status">
              <div class="status-title" @click.stop="showDesc(isCombatStatus, idx)">
                <span class="status-title-left">
                  <div class="status-icon">
                    <div class="status-bg" :style="{ background: ost.UI.iconBg }"></div>
                    <img v-if="getPngIcon(ost.UI.icon) != ''" :src="getPngIcon(ost.UI.icon)"
                      :style="{ filter: getPngIcon(ost.UI.icon).startsWith('https') || ost.UI.icon.startsWith('buff') || ost.UI.icon.endsWith('dice') ? getSvgFilter(ost.UI.iconBg) : '' }" />
                    <div v-else style="color: white;">{{ ost.name[0] }}</div>
                    <div class="status-cnt"
                      v-if="!ost.type.includes(STATUS_TYPE.Sign) && (ost.useCnt >= 0 || ost.roundCnt >= 0)">
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
        <div class="name">{{ (info as Summon).name }}</div>
        <div style="font-weight: bolder;color: #afa04b;padding-left: 4px;">召唤物</div>
        <div class="summon-desc" v-for="(desc, didx) in (info as Summon).UI.descriptions" :key="didx" v-html="desc">
        </div>
        <div class="info-summon-explain" v-for="(expl, eidx) in smnExplain" :key="eidx" style="margin-top: 5px">
          <div v-for="(desc, didx) in expl" :key="didx" v-html="desc"></div>
        </div>
      </div>
    </div>
    <div class="info-container" :class="{ 'mobile-font': isMobile }" @click.stop=""
      v-if="isShow && type == INFO_TYPE.Hero && ((info as Hero).weaponSlot || (info as Hero).talentSlot || (info as Hero).artifactSlot || (info as Hero).vehicleSlot || (info as Hero).heroStatus.length > 0 || combatStatus.length > 0)">
      <div class="info-equipment"
        v-if="(info as Hero).weaponSlot || (info as Hero).talentSlot || (info as Hero).artifactSlot || (info as Hero).vehicleSlot">
        <div class="title">—— 角色装备 ——</div>
        <div class="equipment"
          v-for="(slot, slidx) in [(info as Hero).weaponSlot, (info as Hero).artifactSlot, (info as Hero).talentSlot, (info as Hero).vehicleSlot?.[0]].filter(s => s).sort((a, b) => b!.entityId - a!.entityId)"
          :key="slidx">
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
        <div v-for="(ist, idx) in (info as Hero).heroStatus.filter(sts => !sts.type.includes(STATUS_TYPE.Hide))"
          :key="ist.id" class="status">
          <div class="status-title" @click.stop="showDesc(isHeroStatus, idx)">
            <span class="status-title-left">
              <div class="status-icon">
                <div class="status-bg" :style="{ background: ist.UI.iconBg }"></div>
                <img v-if="getPngIcon(ist.UI.icon) != ''" :src="getPngIcon(ist.UI.icon)"
                  :style="{ filter: getPngIcon(ist.UI.icon).startsWith('https') || ist.UI.icon.startsWith('buff') || ist.UI.icon.endsWith('dice') ? getSvgFilter(ist.UI.iconBg) : '' }" />
                <div v-else style="color: white;">{{ ist.name[0] }}</div>
                <div class="status-cnt"
                  v-if="!ist.type.includes(STATUS_TYPE.Sign) && (ist.useCnt >= 0 || ist.roundCnt >= 0)">
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
        <div v-for="(ost, idx) in combatStatus.filter(sts => !sts.type.includes(STATUS_TYPE.Hide))" :key="ost.id"
          class="status">
          <div class="status-title" @click.stop="showDesc(isCombatStatus, idx)">
            <span class="status-title-left">
              <div class="status-icon">
                <div class="status-bg" :style="{ background: ost.UI.iconBg }"></div>
                <img v-if="getPngIcon(ost.UI.icon) != ''" :src="getPngIcon(ost.UI.icon)"
                  :style="{ filter: getPngIcon(ost.UI.icon).startsWith('https') || ost.UI.icon.startsWith('buff') || ost.UI.icon.endsWith('dice') ? getSvgFilter(ost.UI.iconBg) : '' }" />
                <div v-else style="color: white;">{{ ost.name[0] }}</div>
                <div class="status-cnt"
                  v-if="!ost.type.includes(STATUS_TYPE.Sign) && (ost.useCnt >= 0 || ost.roundCnt >= 0)">
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
  ELEMENT_NAME, ELEMENT_URL, ElementColorKey, HERO_TAG_NAME, HERO_TAG_URL, RULE_EXPLAIN, SHIELD_ICON_URL, SKILL_TYPE_ABBR,
  SKILL_TYPE_NAME, STATUS_BG_COLOR_CODE, STATUS_BG_COLOR_KEY, StatusBgColor, WEAPON_TYPE_NAME, WEAPON_TYPE_URL,
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

const props = defineProps<{
  info: InfoVO,
  isMobile: boolean,
  isInGame: boolean,
  round?: number,
  playerInfo?: GameInfo,
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

const wrapedIcon = (el?: ElementColorKey, isDice = false) => {
  if (el == undefined || el == DAMAGE_TYPE.Pierce || el == DICE_TYPE.Same || el == 'Heal') return '';
  let url = [...Object.keys(DICE_COLOR), DICE_COST_TYPE.Omni, DAMAGE_TYPE.Physical].some(v => v == el) ?
    isDice ? getPngIcon(ELEMENT_ICON[el] + '-dice-bg') : ELEMENT_URL[el as ElementType] :
    getPngIcon(ELEMENT_ICON[el]);
  if (el == STATUS_TYPE.Shield) url = SHIELD_ICON_URL;
  return `<img style='width:18px;transform:translateY(20%);' src='${url}'/>`;
}
const wrapExplCtt = (content: string) => {
  if (!/^[a-z,0-9]+$/.test(content)) return { name: content, default: true }
  const [a1, a2, a3] = content.slice(3).split(',').map(v => JSON.parse(v));
  const type = content.slice(0, 3);
  return type == 'crd' ? newCard(version.value)(a1) :
    type == 'sts' ? newStatus(version.value)(a1, a2, a3) :
      type == 'rsk' ? newSkill(version.value)(a1) :
        type == 'smn' ? newSummon(version.value)(a1, a2, a3) :
          type == 'ski' ? newHero(version.value)(a1).skills[a2] :
            type == 'hro' ? newHero(version.value)(a1) :
              { name: content, default: true };
}
type WrapExplainType = 'slot' | 'card' | 'support' | '';
const wrapDesc = (desc: string, options: { isExplain?: boolean, type?: WrapExplainType, obj?: ExplainContent }): string => {
  const wrapName = (_: string, ctt: string) => `<span style='color:white;'>${wrapExplCtt(ctt).name}</span>`;
  const { isExplain, type = '', obj } = options;
  let res = desc.slice()
    .replace(/〔(\[.+\])?(.+)〕/g, (_, f: string, ctt: string) => {
      const flag = (f || '').slice(1, -1);
      if (typeof obj != 'string' && obj != undefined && flag != '' && type != '' && flag != type) return '';
      if (!isInGame.value || isExplain) return '';
      ctt = ctt
        .replace(/{round}/, `${round.value}`)
        .replace(/{dessptcnt}/, `${playerInfo.value?.destroyedSupport}`)
        .replace(/{eldmgcnt}/, `${playerInfo.value?.oppoGetElDmgType.toString(2).split('').filter(v => +v).length}`)
      if (typeof obj != 'string' && obj != undefined) {
        ctt = ctt.replace(/{pct}/, `${-obj.perCnt}`).replace(/{unt}/, `${obj.useCnt}`);
      }
      return `<span style="color:#d5bb49;">${ctt}</span>`
    })
    .replace(/(?<!\\)〖(.*?)〗/g, wrapName)
    .replace(/(?<!\\)【(.*?)】/g, wrapName)
    .replace(/(?<!\\)(｢)(.*?)(｣)/g, (_, prefix: string, word: string, suffix: string) => {
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
    }).replace(/(?<!\\)(\*?)\[(.*?)\]/g, (_, isUnderline: string, ctt: string) => {
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
      // const underline = isUnderline == '' ? `border-bottom:2px solid ${color};cursor:pointer;` : '';
      const underline = isUnderline == '' ? `text-decoration: underline;cursor:pointer;` : '';
      const marginLeft = el == undefined || el == DAMAGE_TYPE.Pierce || el == DICE_TYPE.Same ? 'margin-left:2px;' : '';
      return `${wpicon}<span style='color:${color};${underline}margin-right:2px;${marginLeft}'>${ctt}</span>`;
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
// 变白色：【】｢｣
// 下划线（有规则解释，如果可能前面会有图标）：[]
// 解析名字并加入解释：〖〗【】
// 有某些特殊颜色（如 冰/水/火/雷）：‹nxxx› n为字体元素颜色 + 前面的图标 xxx为内容
// 卡牌上一些实时信息：〔〕
// 一些参考括号类型｢｣﹝﹞«»‹›〔〕〖〗『』〈〉《》【】[]

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
    if ('costType' in expl) { // Card
      explains.push(`
        <div style="display:flex;align-items:flex-end;">
            ${nameEl}
            <div class="skill-cost" style="margin-left:5px;">
              <img class="cost-img" src="${getDiceIcon(ELEMENT_ICON[expl.costType])}" />
              <span>${expl.cost}</span>
            </div>
        </div>
      `);
    } else {
      explains.push(nameEl);
    }
    explains.push(...expl.UI.description.split('；').map(desc => wrapDesc(desc, { isExplain: true, obj: expl })));
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
      ruleExplain.value.push(`<div style='font-weight:bold;border-top: 2px solid #6f84a0;padding-top:5px;'>${wrapDesc(`*[${title}]`, { isExplain: true })}</div>`);
      ruleExplain.value.push(...RULE_EXPLAIN[title].split('；').map(desc => wrapDesc(desc, { isExplain: true })));
    }
  });
}

// 获取骰子背景
const getDiceIcon = (name: string) => {
  return `/image/${name}-dice-bg.png`;
}

// 获取png图片
const getPngIcon = (name: string) => {
  if (name.startsWith('http') || name == '') return name;
  if (name.endsWith('-dice')) return getSvgIcon(name);
  if (name.startsWith('ski')) {
    const [hid, skidx] = name.slice(3).split(',').map(v => JSON.parse(v));
    return newHero(version.value)(hid).skills?.[skidx].UI.src ?? '';
  }
  if (name == 'energy') name += '-dice-bg';
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
    info.value.UI.descriptions = info.value.UI.description.split('；').map(desc => wrapDesc(desc, { obj: info.value as Card, type: type.value == INFO_TYPE.Support ? 'support' : 'card' }));
    skillExplain.value = wrapExpl(info.value.UI.explains, info.value.id + info.value.name);
    if (info.value.subType.includes(CARD_SUBTYPE.Vehicle)) {
      const vehicle = newSkill(version.value)(+`${info.value.id}1`);
      vehicle.UI.descriptions = vehicle.UI.description.split('；').map(desc => wrapDesc(desc, { obj: vehicle }));
      skills.value.push(vehicle);
      isShowSkill.value.push(true);
      skillExplain.value = [wrapExpl(vehicle.UI.explains, vehicle.id + vehicle.name)];
    }
  }
  if (info.value && 'maxUse' in info.value) { // 召唤物
    smnExplain.value = wrapExpl(info.value.UI.explains, info.value.id + info.value.name);
    info.value.UI.descriptions = (info.value.UI.description as string).split('；').map(desc => wrapDesc(desc, { obj: info.value as Summon }));
    const onceDesc = info.value.UI.descriptions.findIndex(v => v.includes('入场时：'));
    if (onceDesc > -1) info.value.UI.descriptions.splice(onceDesc, 1);
  }
  if (info.value && 'heroStatus' in info.value) { // 角色
    heroStatusExplain.value = [];
    combatStatusExplain.value = [];
    info.value.heroStatus.forEach(ist => {
      ist.UI.descriptions = ist.UI.description.split('；').map(desc => wrapDesc(desc, { obj: ist }));
      heroStatusExplain.value.push(wrapExpl(ist.UI.explains, ist.id + ist.name));
    });
    combatStatus.value.forEach(ost => {
      ost.UI.descriptions = ost.UI.description.split('；').map(desc => wrapDesc(desc, { obj: ost }));
      combatStatusExplain.value.push(wrapExpl(ost.UI.explains, ost.id + ost.name));
    });
    for (const skill of info.value.skills) {
      skills.value.push(skill);
      isShowSkill.value.push(type.value == INFO_TYPE.Skill);
    }
    slotExplain.value = [];
    [info.value.weaponSlot, info.value.artifactSlot, info.value.talentSlot, info.value.vehicleSlot?.[0]].forEach(slot => {
      if (slot) {
        const desc = slot.UI.description.split('；').map(desc => wrapDesc(desc, { obj: slot, type: 'slot' }));
        const isActionTalent = [CARD_SUBTYPE.Action, CARD_SUBTYPE.Talent].every(v => slot.subType.includes(v));
        slot.UI.descriptions = isActionTalent ? desc.slice(2) : desc;
        const onceDesc = slot.UI.descriptions.findIndex(v => v.includes('入场时：'));
        if (onceDesc > -1) slot.UI.descriptions.splice(onceDesc, 1);
        slotExplain.value.push(wrapExpl(slot.UI.explains.slice(+isActionTalent), slot.id + slot.name));
        if (slot.subType.includes(CARD_SUBTYPE.Vehicle)) {
          skills.value.unshift((info.value as Hero).vehicleSlot![1]);
          skills.value.push((info.value as Hero).vehicleSlot![1]);
          isShowSkill.value.push(type.value == INFO_TYPE.Skill);
        }
      }
    });
    skills.value.forEach(skill => {
      skill.UI.descriptions = skill.UI.description.split('；').map(desc => wrapDesc(desc, { obj: skill }));
      skillExplain.value.push(wrapExpl(skill.UI.explains, skill.id + skill.name));
    });
    isHeroStatus.value = new Array(info.value.heroStatus.length).fill(false);
    isCombatStatus.value = new Array(combatStatus.value.length).fill(false);
    isEquipment.value = new Array([info.value.weaponSlot, info.value.artifactSlot, info.value.talentSlot, info.value.vehicleSlot?.[0]].filter(s => s).length).fill(false);
  }
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
  font-family: 'HYWenHei 85W';
}

.info-container {
  position: relative;
  width: 25vw;
  max-height: 50vh;
  border: 2px solid black;
  border-radius: 5px;
  background-color: #3e4d69e7;
  padding: 10px 5px;
  margin-right: 2px;
  overflow: auto;
  pointer-events: all;
}

.name {
  font-weight: bolder;
  margin-bottom: 3px;
  color: #93aed4;
  padding-left: 3px;
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
  left: 8px;
  top: 3px;
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
  border: 2px solid black;
  border-radius: 5px;
  background-color: #898989dd;
  padding: 0 5px;
  margin-bottom: 3px;
}

.info-card-type.sub {
  background-color: #5787dfdd;
  margin-left: 3px;
}

.info-hero-tag {
  margin: 5px 0;
  display: flex;
  flex-wrap: wrap;
}

.info-hero-tag>span {
  border: 2px solid black;
  border-radius: 5px;
  margin: 1px;
  padding: 0 3px;
  background-color: #5786dfdd;
}

.info-hero-skill,
.info-status>.status,
.info-equipment>.equipment {
  border: 2px solid black;
  margin-top: 3px;
  transition: 1s;
  border-radius: 4px;
}

.info-hero-skill-title,
.status-title,
.equipment-title {
  border: 2px solid black;
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
  width: 20px;
  height: 20px;
  border: 2px solid #525252;
  border-radius: 50%;
  background: #d2d493;
  margin-right: 3px;
}

.equipment-icon-img {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  filter: brightness(0.3);
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
  background: transparent;
}

::-webkit-scrollbar-thumb {
  border-radius: 5px;
  background: #8caee1d0;
}

::-webkit-scrollbar-track {
  background: transparent;
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
  width: 20px;
  height: 20px;
}

.info-outer-container>.info-container .skill-cost>span {
  position: absolute;
}
</style>