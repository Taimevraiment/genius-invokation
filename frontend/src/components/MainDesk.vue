<template>
  <div class="main-container">
    <div class="side" :style="{ opacity: +(player.phase >= PHASE.CHOOSE_HERO) }">
      <div class="round" @click.stop="showHistory">
        <img src="@@/image/TimeState.png" alt="回合" />
        <span>{{ client.round }}</span>
      </div>
      <div class="pile">
        <span>
          <div>{{ diceCnt[playerIdx ^ 1] }}</div>
        </span>
        {{ pileCnt[playerIdx ^ 1] }}
        <div class="will-getcard-oppo" :class="{ 'mobile-will-card': isMobile }" v-if="opponent?.UI.willGetCard"
          :style="{ left: `${cidx * 70 - 70}px` }" v-for="(_, cidx) in opponent?.UI.willGetCard" :key="cidx"></div>
        <handcard class="will-addcard-my" :class="{ 'mobile-will-card': isMobile }" v-if="opponent?.UI.willAddCard"
          :style="{ left: `${cidx * 70 - 70}px` }" v-for="(card, cidx) in opponent?.UI.willAddCard" :card="card"
          :isMobile="isMobile" :key="cidx">
        </handcard>
        <handcard class="will-discard-hcard-oppo" :class="{ 'mobile-will-card': isMobile }" :card="card"
          :isMobile="isMobile" :style="{ left: `${cidx * 70 - 70}px` }"
          v-for="(card, cidx) in opponent?.UI.willDiscard[0]" :key="cidx">
        </handcard>
        <handcard class="will-discard-pile-my" :class="{ 'mobile-will-card': isMobile }" :card="card"
          :isMobile="isMobile" :style="{ left: `${cidx * 70 - 70}px` }"
          v-for="(card, cidx) in opponent?.UI.willDiscard[1]" :key="cidx">
        </handcard>
      </div>
      <div class="timer" :style="{ 'background-image': currTimeBg }">
        <button class="end-phase" @click.stop="endPhase"
          :class="{ forbidden: player.status == PLAYER_STATUS.WAITING || !canAction || phase >= PHASE.ACTION_END || isLookon > -1 }">
          结束
        </button>
      </div>
      <div class="pile">
        <span>
          <div>{{ diceCnt[playerIdx] }}</div>
        </span>
        {{ pileCnt[playerIdx] }}
        <handcard class="will-getcard-my" :class="{ 'mobile-will-card': isMobile }" :card="card" :isMobile="isMobile"
          :style="{ left: `${cidx * 70 - 70}px` }" v-for="(card, cidx) in player.UI.willGetCard" :key="cidx">
        </handcard>
        <handcard class="will-addcard-my" :class="{ 'mobile-will-card': isMobile }" :card="card" :isMobile="isMobile"
          :style="{ left: `${cidx * 70 - 70}px` }" v-for="(card, cidx) in player.UI.willAddCard" :key="cidx">
        </handcard>
        <handcard class="will-discard-hcard-my" :class="{ 'mobile-will-card': isMobile }" :card="card"
          :isMobile="isMobile" :style="{ left: `${cidx * 70 - 70}px` }" v-for="(card, cidx) in player.UI.willDiscard[0]"
          :key="cidx">
        </handcard>
        <handcard class="will-discard-pile-my" :class="{ 'mobile-will-card': isMobile }" :card="card"
          :isMobile="isMobile" :style="{ left: `${cidx * 70 - 70}px` }" v-for="(card, cidx) in player.UI.willDiscard[1]"
          :key="cidx">
        </handcard>
      </div>
      <div class="history-info" v-if="isShowHistory">
        <div v-for="(his, hsidx) in historyInfo" :key="hsidx"
          :style="{ color: his.match(/(?<=\[)[^\]]+(?=\])/)?.[0] == player.name ? '#e0b97e' : '#63a0e6' }">
          {{ his }}
        </div>
      </div>
    </div>

    <div class="supports self">
      <div class="support-area" v-for="(supportArea, saidx) in [opponent?.supports ?? [], player.supports]"
        :key="saidx">
        <div class="support" :class="{
          'support-select': supportSelect[getGroup(saidx)][siidx] || support.isSelected,
          'support-can-select': support.canSelect && player.status == PLAYER_STATUS.PLAYING,
          'active-supportcnt': canAction && currSkill.type != SKILL_TYPE.Passive && supportCnt[getGroup(saidx)][siidx] != 0,
        }" v-for="(support, siidx) in supportArea" :key="siidx" @click.stop="showSupportInfo(saidx, siidx)">
          <div class="support-img-content">
            <img class="support-img"
              :style="{ top: support.card.subType.includes(CARD_SUBTYPE.Ally) && isMobile ? '100%' : '60%' }"
              :src="support.card.UI.src" v-if="support.card.UI.src.length > 0" :alt="support.card.name" />
            <span v-else>{{ support.card.name }}</span>
            <div style="position: absolute; width: 100%; height: 100%"
              :class="{ 'support-can-use': support.perCnt > 0 }">
            </div>
          </div>
          <img class="support-top-icon" v-if="support.type != SUPPORT_TYPE.Permanent"
            :src="getPngIcon(support.type == SUPPORT_TYPE.Round ? 'TimeState' : 'Counter')" />
          <div class="support-top-num" :class="{ 'is-change': supportCurcnt[saidx][siidx].isChange }"
            v-if="support.type != SUPPORT_TYPE.Permanent">
            {{ support.cnt }}
          </div>
          <div :class="{
            'will-destroy': supportCnt[getGroup(saidx)][siidx] < 0,
            'will-add': supportCnt[getGroup(saidx)][siidx] > 0,
          }">
            <img v-if="supportCnt[getGroup(saidx)][siidx] < -support.cnt" :src="getSvgIcon('die')"
              style="height: 16px" />
            <span>
              {{ supportCnt[getGroup(saidx)][siidx] > 0 ? "+" :
                supportCnt[getGroup(saidx)][siidx] >= -support.cnt ? "-" : "" }}
            </span>
            <span v-if="supportCnt[getGroup(saidx)][siidx] >= -support.cnt">
              {{ Math.abs(supportCnt[getGroup(saidx)][siidx]) }}
            </span>
          </div>
          <img class="support-bottom-icon" v-if="support.heal > 0" :src="getSvgIcon('heal')" />
          <div class="support-bottom-num" v-if="support.heal > 0">
            {{ support.heal }}
          </div>
        </div>
      </div>
    </div>

    <div class="heros">
      <div class="hero-group" v-for="(hgroup, hgi) in heros" :key="hgi">
        <div class="hero" @click.stop="selectHero(hgi, hidx)" v-if="!!opponent" :style="{
          'background-color': hero.UI.src == '' ? ELEMENT_COLOR[hero?.element ?? ELEMENT_TYPE.Physical] : '',
        }" :class="{
          'mobile-hero': isMobile,
          'my': hgi == 1,
          'is-front-oppo': hero?.isFront && player.phase >= PHASE.DICE && opponent?.phase >= PHASE.DICE && hgi == 0,
          'is-front-my': hero?.isFront && hgi == 1,
          'active-willhp': canAction && (willHp[hgi][hidx] != undefined || (hero.skills.some(sk => sk.id == currSkill.id) || heroSelect[hgi][hidx] || client.isShowChangeHero >= 2) && hgi == 1 || willSwitch[hgi][hidx]),
        }" v-for="(hero, hidx) in hgroup" :key="hidx">
          <div class="card-border"></div>
          <div class="hero-img-content" :class="{
            'hero-select': heroSelect[hgi][hidx],
            'hero-can-select': hgi == 1 && heroCanSelect[hidx] && player.status == PLAYER_STATUS.PLAYING,
            'hero-shield7': hero.hp > 0 && [...hero.heroStatus, ...(hero.isFront ? combatStatuses[hgi] : [])].some(sts => sts.type.includes(STATUS_TYPE.Shield) && sts.useCnt > 0),
          }">
            <img class="hero-img" :src="hero.UI.src" v-if="hero?.UI.src?.length > 0" :alt="hero.name" />
            <div v-else class="hero-name">{{ hero?.name }}</div>
          </div>
          <div class="hero-freeze" v-if="hero.hp > 0 && hero.heroStatus.some(ist => ist.id == 106)">
            <img :src="getPngIcon('freeze-bg')" />
          </div>
          <div class="hero-freeze" style="background-color: #716446de"
            v-if="hero.hp > 0 && hero.heroStatus.some(ist => ist.id == 2087)"></div>
          <div class="hero-shield2" v-if="hero.hp > 0 && (
            hero.heroStatus.some(ist => ist.type.includes(STATUS_TYPE.Barrier)) ||
            hero.isFront && combatStatuses[hgi].some(ost => ost.type.includes(STATUS_TYPE.Barrier)) ||
            hero.talentSlot?.tag.includes(CARD_TAG.Barrier) && (hero.talentSlot?.perCnt ?? 0) > 0)">
          </div>
          <img class="switch-icon" v-if="willSwitch[hgi][hidx]" :src="getSvgIcon('switch')" />
          <div class="hero-hp" v-if="(hero?.hp ?? 0) > 0">
            <img class="hero-hp-bg" src="@@/image/hero-hp-bg.png" />
            <div class="hero-hp-cnt" :class="{ 'is-change': hpCurcnt[hgi][hidx].isChange }">
              {{ Math.max(0, hpCurcnt[hgi][hidx].val) }}
            </div>
          </div>
          <div class="hero-energys" v-if="(hero?.hp ?? 0) > 0">
            <img v-for="(_, eidx) in hero?.maxEnergy" :key="eidx" class="hero-energy"
              :class="{ 'mobile-energy': isMobile }" :src="getEnergyIcon((hero?.energy ?? 0) - 1 >= eidx)" />
          </div>
          <div class="hero-equipment">
            <div class="hero-weapon" v-if="hero.weaponSlot != null"
              :class="{ 'slot-select': slotSelect[hgi][hidx]?.[0] }">
              <img :src="CARD_SUBTYPE_URL[CARD_SUBTYPE.Weapon]" style="filter: brightness(0.3);" />
              <div :style="{
                position: 'absolute',
                width: '100%',
                height: `${100 / (1 + +!!hero.artifactSlot + +!!hero.talentSlot + +!!hero.spskillSlot)}%`,
                borderRadius: '50%',
              }" :class="{ 'slot-can-use': hero.weaponSlot.perCnt > 0 }"></div>
            </div>
            <div class="hero-artifact" v-if="hero.artifactSlot != null"
              :class="{ 'slot-select': slotSelect[hgi][hidx]?.[1] }">
              <img :src="CARD_SUBTYPE_URL[CARD_SUBTYPE.Artifact]" style="filter: brightness(0.3);" />
              <div :style="{
                position: 'absolute',
                width: '100%',
                height: `${100 / (1 + +!!hero.weaponSlot + +!!hero.talentSlot + +!!hero.spskillSlot)}%`,
                borderRadius: '50%',
              }" :class="{ 'slot-can-use': hero.artifactSlot.perCnt > 0 }"></div>
            </div>
            <div class="hero-talent" v-if="hero.talentSlot != null"
              :class="{ 'slot-select': slotSelect[hgi][hidx]?.[2] }">
              <img :src="CARD_SUBTYPE_URL[CARD_SUBTYPE.Talent]" style="filter: brightness(0.3);" />
              <div :style="{
                position: 'absolute',
                width: '100%',
                height: `${100 / (1 + +!!hero.artifactSlot + +!!hero.weaponSlot + +!!hero.spskillSlot)}%`,
                borderRadius: '50%',
              }" :class="{ 'slot-can-use': hero.talentSlot.perCnt > 0 }"></div>
            </div>
            <div class="hero-spskill" v-if="hero.spskillSlot != null"
              :class="{ 'slot-select': slotSelect[hgi][hidx]?.[3] }">
              <img :src="CARD_SUBTYPE_URL[CARD_SUBTYPE.Spskill]" style="filter: brightness(0.3);" />
              <div :style="{
                position: 'absolute',
                width: '100%',
                height: `${100 / (1 + +!!hero.artifactSlot + +!!hero.weaponSlot + +!!hero.talentSlot)}%`,
                borderRadius: '50%',
              }" :class="{ 'slot-can-use': hero.spskillSlot.perCnt > 0 }"></div>
            </div>
          </div>
          <div class="attach-element">
            <div class="el-tip" v-if="elTips[hgi][hidx] != undefined" :class="{
              'el-tip-enter': elTips[hgi][hidx][0] != '',
              'el-tip-leave': elTips[hgi][hidx][0] == '',
            }" :style="{
              color: ELEMENT_COLOR[elTips[hgi][hidx][1]],
              fontWeight: 'bolder',
              '-webkit-text-stroke': `1px${ELEMENT_COLOR[elTips[hgi][hidx][2]]}`,
            }">
              {{ elTips[hgi][hidx][0] }}
            </div>
            <template v-if="hero.hp > 0">
              <img v-for="(el, eidx) in hero.attachElement" :key="eidx" :src="ELEMENT_URL[el]" style="width: 20px" />
              <img class="will-attach"
                v-for="(attach, waidx) in willAttachs[hgi][hidx]?.filter(wa => wa != ELEMENT_TYPE.Physical)"
                :key="waidx" :src="ELEMENT_URL[attach]" />
            </template>
          </div>
          <div class="instatus" v-if="phase >= PHASE.DICE && hero.hp > 0">
            <div
              :class="{ status: true, 'mobile-status': isMobile, 'status-select': statusSelect[hgi]?.[0]?.[hidx]?.[isti] }"
              v-for="(ists, isti) in hero.heroStatus.filter((sts, stsi) => hero.heroStatus.length <= 4 ? !sts.type.includes(STATUS_TYPE.Hide) : stsi < 4)"
              :key="ists.id">
              <div class="status-bg" :class="{ 'mobile-status-bg': isMobile }" :style="{ background: ists.UI.iconBg }">
              </div>
              <img v-if="getPngIcon(ists.UI.icon) != ''" class="status-icon" :style="{
                filter: getPngIcon(ists.UI.icon).startsWith('https') || ists.UI.icon.startsWith('buff') || ists.UI.icon.endsWith('dice')
                  ? getSvgFilter(ists.UI.iconBg) : '',
              }" :src="getPngIcon(ists.UI.icon)" />
              <div v-else style="color: white;">{{ ists.name[0] }}</div>
              <div :style="{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%' }"
                :class="{ 'status-can-use': ists.perCnt > 0 }"></div>
              <div class="status-cnt"
                :class="{ 'mobile-status-cnt': isMobile, 'is-change': statusCurcnt[hgi][hidx][0][isti].isChange }"
                v-if="!ists.type.includes(STATUS_TYPE.Sign) && (ists.useCnt >= 0 || ists.roundCnt >= 0)">
                {{ ists.useCnt < 0 ? ists.roundCnt : ists.useCnt }} </div>
              </div>
              <div v-if="hero.heroStatus.length > 4" :class="{ status: true, 'mobile-status': isMobile }"
                style="background-color: #faebd767">
                <span>···</span>
                <div class="status-cnt" :class="{ 'mobile-status-cnt': isMobile }">
                  {{ hero.heroStatus.length - 3 }}
                </div>
              </div>
            </div>
            <div class="outstatus" :class="{ 'mobile-outstatus': isMobile }"
              v-if="phase >= PHASE.DICE && hero.hp > 0 && hero.isFront">
              <div
                :class="{ status: true, 'mobile-status': isMobile, 'status-select': statusSelect[hgi]?.[1]?.[hidx]?.[osti] }"
                v-for="(osts, osti) in combatStatuses[hgi].filter((sts, stsi) => combatStatuses[hgi].length <= 4 ? !sts.type.includes(STATUS_TYPE.Hide) : stsi < 3)"
                :key="osts.id">
                <div class="status-bg" :class="{ 'mobile-status-bg': isMobile }"
                  :style="{ background: osts.UI.iconBg }">
                </div>
                <img v-if="getPngIcon(osts.UI.icon) != ''" class="status-icon" :style="{
                  filter: getPngIcon(osts.UI.icon).startsWith('https') || osts.UI.icon.startsWith('buff') || osts.UI.icon.endsWith('dice')
                    ? getSvgFilter(osts.UI.iconBg) : '',
                }" :src="getPngIcon(osts.UI.icon)" />
                <div v-else style="color: white;">{{ osts.name[0] }}</div>
                <div :style="{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%' }"
                  :class="{ 'status-can-use': osts.perCnt > 0 }"></div>
                <div class="status-cnt"
                  :class="{ 'mobile-status-cnt': isMobile, 'is-change': statusCurcnt[hgi][hidx][1][osti].isChange }"
                  v-if="!osts.type.includes(STATUS_TYPE.Sign) && (osts.useCnt >= 0 || osts.roundCnt >= 0)">
                  {{ osts.useCnt < 0 ? osts.roundCnt : osts.useCnt }} </div>
                </div>
                <div v-if="combatStatuses[hgi].length > 4" :class="{ status: true, 'mobile-status': isMobile }"
                  style="background-color: #faebd767">
                  <span>···</span>
                  <div class="status-cnt" :class="{ 'mobile-status-cnt': isMobile }">
                    {{ combatStatuses[hgi].length - 3 }}
                  </div>
                </div>
              </div>
              <div class="hero-die" v-if="hero.hp <= 0">
                <img :src="getSvgIcon('die')" style="width: 40px" />
              </div>
              <div :class="{
                'will-damage': (willHp[hgi][hidx] ?? 0) <= 0,
                'will-heal': (willHp[hgi][hidx] ?? 0) > 0,
              }" :style="{
                'padding-left': `${hero.hp + (willHp[hgi][hidx] ?? 0) <= 0 ? '0' : '3px'}`,
                // 'background-image': `url(${getPngIcon(`Preview${(willHp[hgi][hidx] ?? 0) <= 0 ? 2 : 3}`)})`,
                'border-image-source': `url(${getPngIcon(`Preview${hero.hp + (willHp[hgi][hidx] ?? 0) <= 0 ? 1 : (willHp[hgi][hidx] ?? 0) <= 0 ? 2 : 3}`)})`,
              }" v-if="willHp[hgi][hidx] != undefined">
                <img v-if="(willHp[hgi][hidx] ?? 0) % 1 != 0"
                  :src="getPngIcon('https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Revive.webp')"
                  style="height: 16px" />
                <img v-else-if="hero.hp + (willHp[hgi][hidx] ?? 0) <= 0" :src="getSvgIcon('die')"
                  style="height: 16px; padding-left: 3px" />
                <span
                  :style="{ padding: `0 8px 0 ${hero.hp + (willHp[hgi][hidx] ?? 0) > 0 && (willHp[hgi][hidx] ?? 0) % 1 == 0 ? '5px' : '0'}` }">
                  {{ (willHp[hgi][hidx] ?? 0) > 0 ? "+" : "-" }}{{ Math.abs(Math.ceil(willHp[hgi][hidx] ?? 0) % 100) }}
                </span>
              </div>
              <div class="damages">
                <div class="damage" v-if="dmgElements[hgi] != undefined && willDamages[hgi][hidx] != undefined"
                  :class="{ 'show-damage': isShowDmg && willDamages[hgi][hidx][0] >= 0 && hero.hp >= 0 }" :style="{
                    color: ELEMENT_COLOR[dmgElements[hgi][hidx]],
                    'background-image': `url(${getPngIcon('Attack')})`,
                  }">
                  -{{ willDamages[hgi][hidx][0] }}
                </div>
                <div class="damage" v-if="willDamages[hgi][hidx] != undefined"
                  :class="{ 'show-damage': isShowDmg && willDamages[hgi][hidx][1] > 0 && hero.hp >= 0 }" :style="{
                    color: ELEMENT_COLOR[DAMAGE_TYPE.Pierce],
                    'background-image': `url(${getPngIcon('Attack')})`,
                  }">
                  -{{ willDamages[hgi][hidx][1] }}
                </div>
                <div class="heal" v-if="willHeals[hgi][hidx] != undefined"
                  :class="{ 'show-heal': isShowDmg && willHeals[hgi][hidx] >= 0 }" :style="{
                    color: ELEMENT_COLOR.Heal,
                    'background-image': `url(${getPngIcon('Heal')})`,
                  }">
                  +{{ Math.ceil(willHeals[hgi][hidx]) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="summons">
          <div class="summon-area" v-if="!!opponent"
            v-for="(smnArea, saidx) in [[...opponent?.summons, ...willSummons[0]], [...player.summons, ...willSummons[1]]]"
            :key="saidx">
            <div class="summon" :class="{
              'will-attach': summon.UI.isWill,
              'summon-select': summonSelect[saidx][suidx] || summon.isSelected,
              'summon-can-select': summon.canSelect && player.status == PLAYER_STATUS.PLAYING,
              'active-summoncnt': canAction && summonCnt[getGroup(saidx)][suidx] != 0,
            }" v-for="(summon, suidx) in smnArea" :key="suidx"
              @click.stop="showSummonInfo(saidx, suidx, summon.UI.isWill)">
              <div class="summon-img-content">
                <div class="card-border"></div>
                <img class="summon-img" :src="summon.UI.src" v-if="summon?.UI.src?.length > 0" :alt="summon.name" />
                <span v-else>{{ summon.name }}</span>
                <div style="position: absolute; width: 100%; height: 100%"
                  :class="{ 'summon-can-use': summon.perCnt > 0 && !summon.UI.isWill }"></div>
              </div>
              <img class="summon-top-icon" v-if="!summon?.UI.isWill"
                :src="getPngIcon(summon.maxUse > 10 ? 'Counter' : summon.shieldOrHeal < 0 ? 'Barrier' : 'TimeState')" />
              <div class="summon-top-num" :class="{ 'is-change': summonCurcnt[saidx][suidx].isChange }"
                v-if="!summon?.UI.isWill">
                {{ summon.useCnt }}
              </div>
              <div :class="{
                // 'will-destroy': summonCnt[getGroup(saidx)][suidx] < 0,
                // 'will-add': summonCnt[getGroup(saidx)][suidx] > 0,
                'will-add': true,
              }" :style="{
                'border-image-source': `url(${getPngIcon(`Preview${summonCnt[getGroup(saidx)][suidx] > 0 ? 3 : -summonCnt[getGroup(saidx)][suidx] <= summon.useCnt ? 2 : 1}`)})`,
              }" v-if="summonCnt[getGroup(saidx)][suidx] != 0">
                <img
                  v-if="summonCnt[getGroup(saidx)][suidx] <= -summon.useCnt && (summon.isDestroy == SUMMON_DESTROY_TYPE.Used || summonCnt[getGroup(saidx)][suidx] < -99)"
                  :src="getSvgIcon('die')" style="height: 16px" />
                <span>
                  {{ summonCnt[getGroup(saidx)][suidx] > 0 ? "+" :
                    summonCnt[getGroup(saidx)][suidx] > -summon.useCnt ||
                      (summon.isDestroy != SUMMON_DESTROY_TYPE.Used && summonCnt[getGroup(saidx)][suidx] > -99) ?
                      "-" : "" }}
                </span>
                <span
                  v-if="summonCnt[getGroup(saidx)][suidx] > -summon.useCnt || (summon.isDestroy != SUMMON_DESTROY_TYPE.Used && summonCnt[getGroup(saidx)][suidx] > -99)">
                  {{ Math.abs(summonCnt[getGroup(saidx)][suidx]) }}
                </span>
              </div>
              <img class="summon-bottom-icon" v-if="!summon?.UI.isWill"
                :style="{ background: `radial-gradient(${ELEMENT_COLOR.Heal} 30%, ${ELEMENT_COLOR.Heal}19 60%, transparent 80%)` }"
                :src="summon.damage > 0 ? ELEMENT_URL[summon.element] : getSvgIcon('heal')" />
              <div class="summon-bottom-num" v-if="!summon?.UI.isWill">
                {{ summon.damage > 0 ? summon.damage : summon.shieldOrHeal }}{{ summon.UI.hasPlus ? "+" : "" }}
              </div>
            </div>
          </div>
        </div>

        <div class="dices" :class="{ 'mobile-dices': isMobile }">
          <div class="dice-my cursor-point" v-for="(dice, didx) in player.phase >= PHASE.ACTION_START ? dices : []"
            :key="didx" :class="{ 'dice-select': diceSelect[didx], 'mobile-dice-my': isMobile }"
            @click.stop="selectUseDice(didx)">
            <img class="dice-change-img" :src="getDiceBgIcon(ELEMENT_ICON[dice])" style="opacity: 1" />
            <img class="dice-change-el-img" :src="getDiceIcon(ELEMENT_ICON[dice])" />
            <img class="dice-change-img" :src="getDiceBgIcon(ELEMENT_ICON[dice])" />
          </div>
        </div>

        <div class="dice-change"
          v-if="(phase == PHASE.DICE || phase == PHASE.ACTION) && player.phase == PHASE.DICE && isLookon == -1"
          @mousedown.stop="mousedown()" @mouseup.stop="mouseup">
          <div class="dice-change-area">
            <div class="dice-container" v-for="(dice, didx) in dices" :key="didx">
              <div class="dice" :class="{ 'dice-select': diceSelect[didx] }" @mousedown.stop="mousedown(didx)"
                @mouseenter.stop="selectRerollDice(didx)">
                <img class="dice-change-img" :src="getDiceBgIcon(ELEMENT_ICON[dice])" style="opacity: 1" />
                <img class="dice-change-el-img" :src="getDiceIcon(ELEMENT_ICON[dice])" />
                <img class="dice-change-img" :src="getDiceBgIcon(ELEMENT_ICON[dice])" />
              </div>
            </div>
          </div>
          <div v-if="rollCnt > 1" style="color: white; position: absolute; bottom: 35%">
            还可重投{{ rollCnt }}轮
          </div>
          <button @click="reroll()" :class="{ 'not-show': !showRerollBtn }">
            {{ diceSelect.some(v => v) ? "重掷" : "确认" }}
          </button>
        </div>

        <div class="card-change" v-if="player.phase == PHASE.CHANGE_CARD && isLookon == -1">
          <div class="init-cards">
            <handcard class="init-card" v-for="(card, cidx) in initCards" :key="`${cidx}-${card.id}`" :card="card"
              :isMobile="isMobile" @click.stop="selectChangeCard(cidx)">
              <img :src="getPngIcon('Select_ExchangeCard')" alt="选中" v-if="initCardsSelect[cidx]" class="init-select" />
            </handcard>
          </div>
          <button @click="changeCard" v-if="showChangeCardBtn">
            {{ initCardsSelect.some(v => v) ? "换牌" : "确认手牌" }}
          </button>
        </div>
      </div>
</template>

<script setup lang='ts'>
import Handcard from '@/components/Card.vue';
import {
  CARD_SUBTYPE, CARD_TAG,
  DAMAGE_TYPE, DICE_COST_TYPE, DiceCostType, ELEMENT_TYPE, ElementType, PHASE, Phase, PLAYER_STATUS,
  PureElementType, SKILL_TYPE, STATUS_TYPE, SUMMON_DESTROY_TYPE, SUPPORT_TYPE, Version
} from '@@@/constant/enum';
import { MAX_SUMMON_COUNT, MAX_SUPPORT_COUNT } from '@@@/constant/gameOption';
import { CARD_SUBTYPE_URL, ELEMENT_COLOR, ELEMENT_ICON, ELEMENT_URL, STATUS_BG_COLOR_CODE, STATUS_BG_COLOR_KEY, StatusBgColor } from '@@@/constant/UIconst';
import { newHero } from '@@@/data/heros';
import { computed, onMounted, ref, watchEffect } from 'vue';
import { Card, Hero, Player, Skill, Status, Summon } from '../../../typing';

const props = defineProps(['isMobile', 'canAction', 'isLookon', 'afterWinHeros', 'client', 'isShowHistory', 'version']);
const emits = defineEmits([
  'selectChangeCard', 'changeCard', 'reroll', 'selectHero', 'selectUseDice', 'selectSummon', 'selectSupport', 'endPhase',
  'showHistory', 'update:diceSelect',
]);

type Curcnt = { sid: number, val: number, isChange: boolean };
const genChangeProxy = (length: number) => Array.from({ length }, () => ({ sid: 0, val: 0, isChange: false }));
const supportCurcnt = ref<Curcnt[][]>([genChangeProxy(MAX_SUPPORT_COUNT), genChangeProxy(MAX_SUPPORT_COUNT)]);
const summonCurcnt = ref<Curcnt[][]>([genChangeProxy(MAX_SUMMON_COUNT), genChangeProxy(MAX_SUMMON_COUNT)]);
const statusCurcnt = ref<Curcnt[][][][]>([]);
const hpCurcnt = ref<Curcnt[][]>([]);
const getGroup = (idx: number) => idx ^ playerIdx.value ^ 1;
const wrapArr = <T>(arr: T[], reverse: boolean = false) => {
  const h0 = props.client.players[0].heros.length;
  const a0 = arr.slice(0, h0);
  const a1 = arr.slice(h0);
  if (playerIdx.value == 1 != reverse) return [a0, a1];
  return [a1, a0];
}

const playerIdx = computed<number>(() => Math.max(props.isLookon, props.client.playerIdx));
const player = computed<Player>(() => {
  const players: Player[] = props.client.players;
  if (statusCurcnt.value.length == 0) statusCurcnt.value = players.map(p => p.heros.map(() => [genChangeProxy(12), genChangeProxy(12)]));
  if (hpCurcnt.value.length == 0) hpCurcnt.value = players.map(p => genChangeProxy(p.heros.length));
  players.forEach((p, pidx) => {
    const pi = pidx ^ playerIdx.value ^ 1;
    p.heros.forEach((h, hi) => {
      if (hpCurcnt.value[pi][hi].val != h.hp) {
        if (hpCurcnt.value[pi][hi].sid == h.id) {
          setTimeout(() => {
            hpCurcnt.value[pi][hi] = { sid: h.id, val: h.hp, isChange: true };
            setTimeout(() => hpCurcnt.value[pi][hi].isChange = false, 300);
          }, 200);
        } else {
          hpCurcnt.value[pi][hi] = { sid: h.id, val: h.hp, isChange: false };
        }
      }
      [h.heroStatus, (p.hidx == hi ? p.combatStatus : [])].forEach((hst, hsti) => {
        hst.forEach((s, si) => {
          const val = Math.max(s.roundCnt, s.useCnt);
          if (statusCurcnt.value[pi][hi][hsti][si].val != val) {
            if (statusCurcnt.value[pi][hi][hsti][si].sid == s.id) {
              statusCurcnt.value[pi][hi][hsti][si] = { sid: s.id, val, isChange: true };
              setTimeout(() => statusCurcnt.value[pi][hi][hsti][si].isChange = false, 300);
            } else {
              statusCurcnt.value[pi][hi][hsti][si] = { sid: s.id, val, isChange: false };
            }
          }
        });
      });
    });
    p.supports.forEach((st, sti) => {
      const saidx = +(pi == playerIdx.value);
      if (supportCurcnt.value[saidx][sti].val != st.cnt) {
        if (supportCurcnt.value[saidx][sti].sid == st.entityId) {
          supportCurcnt.value[saidx][sti] = { sid: st.entityId, val: st.cnt, isChange: true };
          setTimeout(() => supportCurcnt.value[saidx][sti].isChange = false, 300);
        } else {
          supportCurcnt.value[saidx][sti] = { sid: st.entityId, val: st.cnt, isChange: false };
        }
      }
    });
    p.summons.forEach((smn, smni) => {
      const saidx = +(pi == playerIdx.value);
      if (summonCurcnt.value[saidx][smni].val != smn.useCnt) {
        if (summonCurcnt.value[saidx][smni].sid == smn.id) {
          summonCurcnt.value[saidx][smni] = { sid: smn.id, val: smn.useCnt, isChange: true };
          setTimeout(() => summonCurcnt.value[saidx][smni].isChange = false, 300);
        } else {
          summonCurcnt.value[saidx][smni] = { sid: smn.id, val: smn.useCnt, isChange: false };
        }
      }
    });
  });
  return players[playerIdx.value];
});
const version = computed<Version>(() => props.version);
const phase = computed<Phase>(() => props.client.phase);
const opponent = computed<Player>(() => props.client.players[playerIdx.value ^ 1]);
const currCard = computed<Card>(() => props.client.currCard);
const currSkill = computed<Skill>(() => props.client.currSkill);
const isMobile = computed<boolean>(() => props.isMobile);
const pileCnt = computed<number[]>(() => props.client.pileCnt);
const diceCnt = computed<number[]>(() => props.client.diceCnt);
const rollCnt = computed<number>(() => props.client.rollCnt);
const showRerollBtn = computed<boolean>(() => props.client.showRerollBtn);
const isReconcile = computed<boolean>(() => props.client.isReconcile);
const heroDOMs = ref<NodeListOf<Element>>();
const atkPidx = computed<number>(() => props.client.damageVO.atkPidx ?? -1);
const atkHidx = computed<number>(() => props.client.damageVO.atkHidx ?? -1);
const tarHidx = computed<number>(() => props.client.damageVO.tarHidx ?? -1);
const willAttachs = computed<ElementType[][][]>(() => wrapArr(props.client.willAttachs ?? []));
let isAnimating = false;
const willDamages = computed<number[][][]>(() => {
  const dmgs: number[][][] = wrapArr(props.client.damageVO.willDamages ?? []);
  if (dmgs.length > 0 && props.client.damageVO.dmgSource == 'skill' &&
    atkHidx.value >= 0 && tarHidx.value > -1 && heroDOMs.value != undefined && !isAnimating) {
    isAnimating = true;
    const isAtker = playerIdx.value == atkPidx.value;
    const atkHeroDOM = heroDOMs.value[+isAtker * props.client.players[playerIdx.value ^ 1].heros.length + atkHidx.value];
    const { width: parentWidth = 0 } = atkHeroDOM.parentElement?.getBoundingClientRect() ?? {};
    const { width, height } = atkHeroDOM.getBoundingClientRect();
    const widthDiff = (tarHidx.value - atkHidx.value) * (width + 0.1 * parentWidth);
    const heightDiff = height / 0.35 * 0.5 * (isAtker ? -1 : 1);
    const deg = Math.atan2(widthDiff, -heightDiff) * (180 / Math.PI) - (isAtker ? 0 : 180);
    const anime = atkHeroDOM.animate([{
      offset: 0.3,
      transform: `rotate(${deg}deg) scale(1.3)`,
      zIndex: 5,
    }, {
      offset: 0.5,
      transform: `rotate(${deg}deg) scale(1.3)`,
      zIndex: 5,
    }, {
      offset: 0.75,
      transform: `translate(${widthDiff}px, ${heightDiff}px) rotate(${deg}deg) scale(0.7)`,
      zIndex: 5,
    }, {
      offset: 0.95,
      transform: `rotate(${deg}deg)`,
      zIndex: 5,
    }], { duration: 700 });
    setTimeout(() => anime.cancel(), 700);
    setTimeout(() => isAnimating = false, 3000);
  }
  return dmgs;
});
const dmgElements = computed<ElementType[][]>(() => wrapArr(props.client.damageVO.dmgElements ?? []));
const willHeals = computed<number[][]>(() => wrapArr(props.client.damageVO.willHeals ?? []));
const elTips = computed<[string, PureElementType, PureElementType][][]>(() => wrapArr(props.client.damageVO.elTips ?? []));
const willHp = computed<(number | undefined)[][]>(() => wrapArr(props.client.willHp));
const willSummons = computed<Summon[][]>(() => props.client.willSummons);
const willSwitch = computed<boolean[][]>(() => wrapArr(props.client.willSwitch));
const isShowChangeHero = computed<number>(() => props.client.isShowChangeHero);
const isShowDmg = computed<boolean>(() => props.client.isShowDmg);
const canAction = computed<boolean>(() => props.canAction);
const heroSwitchDice = computed<number>(() => props.client.heroSwitchDice);
const supportCnt = computed<number[][]>(() => props.client.supportCnt);
const summonCnt = computed<number[][]>(() => props.client.summonCnt);
const initCardsSelect = ref<boolean[]>(new Array(player.value.handCards.length).fill(false));
const heroSelect = computed<number[][]>(() => props.client.heroSelect);
const heroCanSelect = computed<boolean[]>(() => props.client.heroCanSelect);
const supportSelect = computed<boolean[][]>(() => props.client.supportSelect);
const summonSelect = computed<boolean[][]>(() => props.client.summonSelect);
const statusSelect = computed<boolean[][][][]>(() => props.client.statusSelect);
const slotSelect = computed<boolean[][][][]>(() => props.client.slotSelect);
const isLookon = computed<number>(() => props.isLookon);
const heros = computed<Hero[][]>(() => {
  if (props.client.isWin < 2) return [opponent?.value.heros, player.value.heros];
  if (playerIdx.value == 0) return [props.afterWinHeros[1], props.afterWinHeros[0]];
  return props.afterWinHeros.flat();
});
const combatStatuses = computed<Status[][]>(() => [opponent.value.combatStatus, player.value.combatStatus]);
const currTime = computed<number>(() => ((props.client.countdown.limit - props.client.countdown.curr) / props.client.countdown.limit) * 100);
const currTimeBg = computed<string>(() => `conic-gradient(transparent ${currTime.value}%, ${player.value.status == PLAYER_STATUS.WAITING ? '#2b6aff' : '#ffb36d'} ${currTime.value + 5}%)`);
const isShowHistory = computed<boolean>(() => props.client.isShowHistory);
const historyInfo = computed<string[]>(() => props.client.log);
const initCards = computed<Card[]>(() => player.value.handCards);
const dices = computed<DiceCostType[]>(() => player.value.dice);
const diceSelect = computed<boolean[]>(() => props.client.diceSelect);
const showChangeCardBtn = ref<boolean>(true);

let diceChangeEnter: -1 | boolean = -1;
let isMouseDown: boolean = false;

// 获取png图片
const getPngIcon = (name: string) => {
  if (name.startsWith('http') || name == '') return name;
  if (name.endsWith('-dice')) return getSvgIcon(name);
  if (name.startsWith('ski')) {
    const [hid, skidx] = name.slice(3).split(',').map(v => JSON.parse(v));
    return newHero(version.value)(hid).skills?.[skidx].UI.src ?? '';
  }
  return `/image/${name}.png`;
};

// 获取svg图片
const getSvgIcon = (name: string) => {
  return `/svg/${name}.svg`;
};

// 获取骰子背景
const getDiceBgIcon = (name: string) => {
  return `/image/${name}-dice-bg.png`;
};

// 获取骰子元素图案
const getDiceIcon = (name: string) => {
  return `/svg/${name}-dice.svg`;
};

// 获取充能图标
const getEnergyIcon = (isCharged: boolean = false) => {
  return `/image/energy-${isCharged ? 'charged' : 'empty'}.png`;
};

// 获取过滤器
const getSvgFilter = (statusColor: StatusBgColor) => {
  return `url(/svg/filter.svg#status-color-${STATUS_BG_COLOR_CODE[STATUS_BG_COLOR_KEY[statusColor]]})`;
}

watchEffect(() => {
  if (phase.value == PHASE.DICE) {
    initCardsSelect.value = player.value.handCards.map(() => false);
  }
});

onMounted(() => {
  heroDOMs.value = document.querySelectorAll('.hero');
});

// 选择要换的卡
const selectChangeCard = (idx: number) => {
  if (!showChangeCardBtn.value) return;
  initCardsSelect.value[idx] = !initCardsSelect.value[idx];
  emits('selectChangeCard', idx, initCardsSelect.value[idx]);
};
// 换卡
const changeCard = () => {
  emits('changeCard', initCardsSelect.value.map((v, i) => v ? i : -1).filter(v => v > -1));
  initCardsSelect.value.forEach((_, i, a) => (a[i] = false));
  showChangeCardBtn.value = false;
  setTimeout(() => (showChangeCardBtn.value = true), 3000);
};
// 选择角色
const selectHero = (pidx: number, hidx: number) => {
  emits('selectHero', pidx, hidx);
};
// 选择要重掷的骰子
const selectRerollDice = (didx: number) => {
  if (!isMouseDown || !showRerollBtn.value) return;
  if (diceChangeEnter == -1) diceChangeEnter = !diceSelect.value[didx];
  emits('update:diceSelect', didx, diceChangeEnter);
};
// 重掷骰子
const reroll = () => {
  if (!showRerollBtn.value) return;
  emits('reroll');
};
// 选择要消费的骰子
const selectUseDice = (didx: number) => {
  if (player.value.status == PLAYER_STATUS.WAITING) return;
  if (currCard.value.id <= 0 && currSkill.value.type == SKILL_TYPE.Passive && isShowChangeHero.value == 0) return;
  if (isReconcile.value && [DICE_COST_TYPE.Omni, player.value.heros[player.value.hidx].element].includes(dices.value[didx])) return;
  const newVal = !diceSelect.value[didx];
  emits('update:diceSelect', didx, newVal);
  if (newVal) {
    let cost = 0;
    if (currCard.value.id > 0) {
      cost = currCard.value.cost + currCard.value.anydice - currCard.value.costChange;
    } else if (currSkill.value.type != SKILL_TYPE.Passive) {
      cost = currSkill.value.cost[0].cnt - currSkill.value.costChange[0] + currSkill.value.cost[1].cnt - currSkill.value.costChange[1];
    } else if (isShowChangeHero.value > 0) cost = heroSwitchDice.value;
    if (isReconcile.value) cost = 1;
    if (cost == 0) {
      emits('update:diceSelect', -1);
    } else if (diceSelect.value.filter(v => v).length > cost) {
      emits('update:diceSelect', didx);
    }
  }
  emits('selectUseDice');
};
// 显示召唤物信息/选择卡牌目标
const showSummonInfo = (pidx: number, suidx: number, isNotShow: boolean) => {
  emits('selectSummon', pidx, suidx, isNotShow);
};
// 显示场地信息/选择卡牌目标
const showSupportInfo = (pidx: number, siidx: number) => {
  emits('selectSupport', pidx, siidx);
};
// 显示历史信息
const showHistory = () => {
  emits('showHistory');
}
// 结束回合
const endPhase = () => {
  if (player.value.status == PLAYER_STATUS.WAITING || !canAction) return;
  emits('endPhase');
}
// 鼠标按下
const mousedown = (didx: number = -1) => {
  if (!isMouseDown && player.value.phase == PHASE.DICE) isMouseDown = true;
  if (didx > -1) selectRerollDice(didx);
}
// 鼠标松开
const mouseup = () => {
  if (isMouseDown && player.value.phase == PHASE.DICE) isMouseDown = false;
  diceChangeEnter = -1;
}
</script>

<style scoped>
.main-container {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  position: absolute;
  top: 20px;
  left: 0;
  height: 75%;
  width: 100%;
}

.side {
  height: 85%;
  width: min(50px, 5%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.round {
  position: relative;
  width: 50%;
  aspect-ratio: 1/1;
  color: white;
  font-weight: bolder;
  -webkit-text-stroke: 1px black;
  margin-bottom: 5px;
  cursor: pointer;
}

.round * {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  left: 0;
  top: 0;
}

.pile {
  position: relative;
  border-top: 3px solid black;
  border-right: 3px solid black;
  border-bottom: 3px solid black;
  border-top-right-radius: 7px;
  border-bottom-right-radius: 7px;
  height: 20%;
  width: 100%;
  background-color: #003da0;
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  align-items: center;
}

.pile>span {
  width: 55%;
  aspect-ratio: 1/1.1;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  background-color: #ababab;
  display: flex;
  justify-content: center;
  align-items: center;
}

.pile>span>div {
  width: 90%;
  height: 90%;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #5675a5;
}

button {
  background-color: #ffe122;
  border: 3px outset #e1c300;
  border-radius: 5px;
  cursor: pointer;
  padding: 3px 15px;
  width: 20%;
  height: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
}

button:active {
  background-color: #d0b81d;
  border: 3px inset #e1c300;
}

.heros {
  height: 95%;
  width: 40%;
  max-width: 400px;
  min-height: 250px;
  display: flex;
  flex-direction: column;
  align-self: self-end;
}

.hero-group {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: space-between;
}

@property --front-val {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}

.hero {
  --scale-val-will: 1;
  position: relative;
  width: 100%;
  height: 70%;
  border-radius: 10px;
  margin: 0 5%;
  cursor: pointer;
  transition: --front-val 0.3s;
  background: black;
  transform: translateY(var(--front-val)) scale(var(--scale-val-will));
}

.hero.my {
  align-self: flex-end;
}

.hero-hp-bg,
.card-border {
  position: absolute;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.card-border {
  border: min(15px, 1.5vw) solid transparent;
  border-image: url(@@/image/Gold.png) 75 stretch;
  box-sizing: border-box;
}

.hero-hp {
  position: absolute;
  left: -10px;
  top: -10px;
  width: 45%;
  aspect-ratio: 1/1;
  display: flex;
  justify-content: center;
  align-items: center;
  letter-spacing: -2px;
  font-size: min(23px, max(16px, 2vw));
}

.hero-hp-cnt {
  color: white;
  font-weight: bolder;
  -webkit-text-stroke: black 1px;
  z-index: 1;
  padding-right: 2px;
  transform: scale(var(--scale-val-change));
  transition: transform 0.3s;
}

.hero-name {
  position: absolute;
  top: 30px;
  left: 8px;
}

.hero-energys {
  position: absolute;
  right: -6px;
  top: 15px;
  display: flex;
  flex-direction: column;
  z-index: 1;
}

.hero-energy {
  width: 15px;
  height: 15px;
  margin-bottom: 1px;
}

.hero-equipment {
  position: absolute;
  top: 20%;
  left: -20%;
  width: 30%;
  z-index: 1;
}

.hero-weapon,
.hero-artifact,
.hero-talent,
.hero-spskill {
  width: 100%;
  border: 2px solid #525252;
  border-radius: 50%;
  background: #d2d493;
  display: flex;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  transition: 0.3s;
}

.hero-weapon>img,
.hero-artifact>img,
.hero-talent>img,
.hero-spskill>img {
  width: 100%;
  border-radius: 50%;
}

.is-front-oppo {
  --front-val: 20%;
}

.is-front-my {
  --front-val: -20%;
}

.will-damage,
.will-heal {
  position: absolute;
  top: 5px;
  left: 30%;
  height: 23px;
  line-height: 20px;
  /* border-radius: 10px; */
  /* color: #a80000; */
  /* background-color: #c67b7b; */
  color: white;
  -webkit-text-stroke: 0.5px black;
  font-weight: bold;
  display: flex;
  justify-content: center;
  align-items: center;
  /* background-position: center center;
  background-size: 100% 23px;
  background-repeat: no-repeat; */
  border-image-slice: 20 25 fill;
  border-image-width: 7px;
  z-index: 1;
}

/* .will-heal {
  position: absolute;
  top: 5px;
  left: 20%;
  height: 20px;
  line-height: 20px;
  border-radius: 10px;
  color: #22a800;
  font-weight: bold;
  background-color: #7bc67c;
  display: flex;
  justify-content: center;
  align-items: center;
} */

.will-destroy {
  position: absolute;
  top: -5px;
  left: -5px;
  min-width: 35px;
  height: 20px;
  line-height: 20px;
  border-radius: 10px;
  color: #a80000;
  font-weight: bold;
  background-color: #c67b7b;
  display: flex;
  justify-content: center;
  align-items: center;
}

.will-add {
  position: absolute;
  top: -5px;
  left: -5px;
  min-width: 35px;
  height: 20px;
  line-height: 20px;
  font-weight: bold;
  /* border-radius: 10px;
  color: #22a800;
  background-color: #7bc67c; */
  display: flex;
  justify-content: center;
  align-items: center;
  border-image-slice: 20 25 fill;
  border-image-width: 7px;
  color: white;
  -webkit-text-stroke: 0.5px black;
  z-index: 1;
}

.attach-element {
  width: 200%;
  position: absolute;
  top: -23px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
}

.el-tip {
  position: absolute;
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  transition: all 1s;
  font-weight: bold;
}

.el-tip-enter {
  top: -10px;
}

.el-tip-leave {
  opacity: 0;
  z-index: -20;
}

.attach-element img {
  margin: 0 2px;
}

.will-attach {
  width: 20px;
  animation: blink 1s linear infinite alternate;
  z-index: 5;
}

.damages {
  position: absolute;
  bottom: 5px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  width: 100%;
  z-index: 1;
}

.damage,
.heal {
  width: 0;
  /* height: 0; */
  aspect-ratio: 1/1;
  display: flex;
  align-items: center;
  justify-content: center;
  /* background-color: #ffef60; */
  /* border-radius: 50%; */
  transition: 0.5s;
  font-size: 0;
  box-sizing: border-box;
  -webkit-text-stroke: 0.5px black;
  font-weight: bold;
  /* background-image: url(@@/image/Attack.png); */
  background-size: 100%;
}

.show-damage,
.show-heal {
  width: 80%;
  aspect-ratio: 1/1;
  font-size: max(18px, min(24px, 2vw));
  /* border: 3px solid #9e9978; */
}

.instatus {
  position: absolute;
  bottom: 0;
  width: 100%;
  display: flex;
  flex-direction: row;
  box-sizing: border-box;
  padding: 3px;
  z-index: 1;
}

.outstatus {
  position: absolute;
  bottom: -21px;
  width: 100%;
  display: flex;
  flex-direction: row;
  box-sizing: border-box;
  padding: 1px 2px;
}

.status {
  position: relative;
  width: 23%;
  /* height: 18px; */
  aspect-ratio: 1/1;
  text-align: center;
  line-height: 18px;
  border-radius: 50%;
  margin-right: 2px;
  transition: 0.4s;
}

.status-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.status-bg {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  opacity: 0.6;
}

.status-cnt {
  position: absolute;
  right: -6px;
  bottom: -3px;
  font-size: 12px;
  height: 12px;
  width: 12px;
  line-height: 12px;
  text-align: center;
  color: white;
  background: #0000007b;
  border-radius: 50%;
  transform: scale(var(--scale-val-change));
  transition: transform 0.3s;
}

.hero-die {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: #00000094;
  display: flex;
  justify-content: center;
  align-items: center;
}

.hero-freeze {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 105%;
  height: 105%;
  transform: translate(-50%, -50%);
  border-radius: inherit;
  display: flex;
  justify-content: center;
  align-items: center;
}

.hero-freeze>img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  opacity: 0.6;
}

.hero-shield2 {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 108%;
  height: 108%;
  transform: translate(-50%, -50%);
  border-radius: inherit;
  border-left: 6px solid #ffffff8b;
  border-right: 6px solid #ffffff8b;
}

.switch-icon {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  opacity: 0.85;
}

.hero-shield7 {
  border-radius: 5px !important;
  border: 4px solid #fffdd2bd !important;
  z-index: 1;
}

.summons,
.supports {
  height: 100%;
  width: 25%;
  max-width: 230px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 5px 0;
  margin-top: 1.5%;
  box-sizing: border-box;
}

.supports.self {
  align-items: flex-end;
}

.summon-area,
.support-area {
  height: 42%;
  width: 70%;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
}

.summon,
.support {
  position: relative;
  width: 45%;
  height: 45%;
  text-align: center;
  padding-top: 10%;
  box-sizing: border-box;
  cursor: pointer;
  transition: box-shadow 0.5s;
  transform: scale(var(--scale-val-will));
}

.summon-img-content,
.support-img-content {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  color: white;
  border-radius: 10%;
  overflow: hidden;
}

.summon-img {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 107%;
  transform: translate(-50%, -50%);
}

.support-img {
  position: absolute;
  left: 50%;
  top: 60%;
  width: 100%;
  border-radius: 10px;
  transform: translate(-50%, -50%);
}

.summon-top-num,
.support-top-num {
  --scale-val-change: 1;
  position: absolute;
  top: 0;
  right: 0;
  width: 25px;
  height: 25px;
  text-align: center;
  line-height: 25px;
  transform: translate(35%, -30%) scale(var(--scale-val-change));
  color: white;
  font-weight: bolder;
  font-size: medium;
  -webkit-text-stroke: 1px black;
  transition: 0.2s;
  z-index: 1;
}

.summon-top-icon,
.support-top-icon {
  position: absolute;
  top: 0;
  right: 0;
  width: 25px;
  height: 25px;
  transform: translate(35%, -30%);
  z-index: 1;
}

.summon-bottom-num,
.support-bottom-num {
  position: absolute;
  left: 11px;
  bottom: 10px;
  width: 25px;
  height: 25px;
  text-align: center;
  line-height: 25px;
  transform: translate(-35%, 30%);
  color: white;
  font-weight: bolder;
  font-size: medium;
  -webkit-text-stroke: 1px black;
  z-index: 1;
}

.summon-bottom-icon,
.support-bottom-icon {
  position: absolute;
  left: 10px;
  bottom: 10px;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  background: radial-gradient(#ffffff 10%, #ffffff19 60%, transparent 80%);
  transform: translate(-30%, 30%);
  z-index: 1;
}

.dices {
  height: 67%;
  width: 5%;
  text-align: center;
  padding-top: 170px;
  padding-right: 10px;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap-reverse;
  z-index: 5;
}

.dice-change {
  position: absolute;
  top: 0;
  left: 5%;
  width: 90%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #636363f4;
  padding: 0 10%;
  padding-bottom: 1%;
  border-radius: 10px;
  box-sizing: border-box;
  z-index: 2;
}

.dice-change-area {
  width: 100%;
  height: 60%;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  align-content: center;
  padding: 0 20%;
  box-sizing: border-box;
}

.dice-change-el-img {
  position: absolute;
  width: min(30px, 60%);
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.dice-change-img {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(60px, 100%);
  opacity: 60%;
}

.dice {
  width: min(60px, 100%);
  aspect-ratio: 1/1;
  border-radius: 50%;
  cursor: pointer;
}

.dice-container {
  position: relative;
  width: 15%;
  height: 40%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 3%;
}

.support-can-use {
  box-shadow: 0 0 15px yellow inset;
}

.slot-can-use {
  box-shadow: 0 0 5px 2px yellow inset;
}

.summon-can-use {
  box-shadow: 0 0 15px 2px yellow inset;
}

.status-can-use {
  box-shadow: 0 0 5px 1px yellow inset;
}

.summon-select,
.support-select,
.hero-select,
.status-select,
.slot-select {
  box-shadow: 4px 4px 6px #ffeb56, -4px 4px 6px #ffeb56, 4px -4px 6px #ffeb56,
    -4px -4px 6px #ffeb56 !important;
}

.summon-select,
.support-select,
.hero-select {
  background-color: #ffeb56;
}

.dice-select {
  box-shadow: 0 0 10px #ffeb56b8, 0 0 40px #ffeb56b8 inset;
}

.hero-can-select,
.summon-can-select,
.support-can-select {
  box-shadow: 2px 2px 3px #d1ffc4, -2px 2px 3px #d1ffc4, 2px -2px 3px #d1ffc4,
    -2px -2px 3px #d1ffc4;
}

.dice-my {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-bottom: 2px;
}

.card-change {
  position: absolute;
  top: 0;
  left: 15%;
  width: 70%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #636363f4;
  border-radius: 5px;
  z-index: 2;
}

.init-cards {
  width: 90%;
  height: 70%;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.init-card {
  position: relative;
  width: 90px;
  height: 125px;
  border-radius: 10px;
  cursor: pointer;
  text-align: center;
  padding-top: 25px;
  background-color: #a7bbdd;
}

.init-card-content {
  position: relative;
  top: -25px;
  width: 100%;
  height: 120%;
  border-radius: 10px;
  border: 2px solid black;
  overflow: hidden;
  box-sizing: border-box;
}

.hero-img-content {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  border: 2px solid black;
  overflow: hidden;
  box-sizing: border-box;
}

.card-img,
.hero-img {
  position: absolute;
  left: 50%;
  top: 0;
  min-width: 100%;
  min-height: 100%;
  max-height: 120%;
  transform: translateX(-50%);
  /* width: 100%;
  height: 100%;
  object-fit: cover; */
  border-radius: 10px;
}

.card-img {
  border: 2px solid black;
}

.history-info {
  position: absolute;
  left: 0;
  top: 20px;
  padding: 10px;
  color: white;
  height: 80%;
  overflow-y: scroll;
  border-top-right-radius: 5px;
  border-bottom-right-radius: 5px;
  z-index: 2;
  background-color: #35527fce;
}

.legend-border {
  position: absolute;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
  border-radius: inherit;
}

.dice-img {
  position: absolute;
  left: -5px;
  top: -5px;
  width: 30px;
  height: 30px;
  border-radius: 10px;
}

/* .init-card-cost {
  position: absolute;
  left: 0;
  top: 0;
  width: 20px;
  height: 20px;
  text-align: center;
  line-height: 20px;
  color: white;
  font-weight: bold;
  -webkit-text-stroke: 1px black;
}

.init-card-cost>span,
.init-card-energy>span {
  position: absolute;
  left: 5px;
  top: 0;
  font-size: medium;
}

.init-card-energy {
  position: absolute;
  left: 0;
  top: 35px;
  width: 20px;
  height: 20px;
  text-align: center;
  line-height: 20px;
  color: white;
  font-weight: bold;
  -webkit-text-stroke: 1px black;
} */

.init-select {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
}

.will-getcard-my {
  position: absolute;
  width: 90px;
  height: 120px;
  border-radius: 10px;
  color: black;
  text-align: center;
  background-color: #a7bbdd;
  padding-top: 20px;
  transform: rotate(90deg);
  animation: getcard-my 1.5s linear forwards;
}

.will-getcard-oppo {
  position: absolute;
  width: 90px;
  height: 120px;
  border: 2px solid black;
  border-radius: 10px;
  background-color: #14408c;
  background-image: url(https://homdgcat.wiki/images/GCG/UI_Gcg_CardBack_01.png);
  background-size: 100% 100%;
  color: black;
  text-align: center;
  padding-top: 20px;
  transform: rotate(90deg);
  animation: getcard-oppo 1.5s linear forwards;
  overflow: hidden;
}

.will-addcard-my {
  position: absolute;
  width: 90px;
  height: 120px;
  border-radius: 10px;
  color: black;
  text-align: center;
  background-color: #a7bbdd;
  padding-top: 20px;
  transform: translate(500%, -10%);
  animation: addcard 1.2s linear;
  opacity: 0;
}

.will-addcard-oppo {
  position: absolute;
  width: 90px;
  height: 120px;
  border: 2px solid black;
  border-radius: 10px;
  background-color: #14408c;
  background-image: url(https://homdgcat.wiki/images/GCG/UI_Gcg_CardBack_01.png);
  background-size: 100% 100%;
  color: black;
  text-align: center;
  padding-top: 20px;
  transform: translate(500%, -10%);
  animation: addcard 1.2s linear;
  overflow: hidden;
  opacity: 0;
}

.will-discard-pile-my {
  position: absolute;
  width: 90px;
  height: 120px;
  border-radius: 10px;
  color: black;
  text-align: center;
  background-color: #a7bbdd;
  padding-top: 20px;
  transform: rotate(90deg);
  animation: discard-pile 1.5s linear forwards;
}

.will-discard-hcard-my {
  position: absolute;
  width: 90px;
  height: 120px;
  border-radius: 10px;
  color: black;
  text-align: center;
  background-color: #a7bbdd;
  padding-top: 20px;
  transform: rotate(90deg);
  animation: discard-hcard-my 1.5s linear forwards;
}

.will-discard-hcard-oppo {
  position: absolute;
  width: 90px;
  height: 120px;
  border-radius: 10px;
  color: black;
  text-align: center;
  background-color: #a7bbdd;
  padding-top: 20px;
  transform: rotate(90deg);
  animation: discard-hcard-oppo 1.5s linear forwards;
}

.active-willhp,
.active-supportcnt,
.active-summoncnt {
  --scale-val-will: 1.1;
  z-index: 5;
}

.is-change {
  --scale-val-change: 1.5;
}

.mobile-hero {
  width: 20%;
}

.mobile-dices {
  padding-top: 110px;
}

.mobile-status {
  width: 14px;
  height: 14px;
  line-height: 14px;
  margin-right: 1px;
}

.mobile-status-cnt {
  position: absolute;
  right: -3px;
  bottom: -2px;
  font-size: 8px;
  height: 8px;
  width: 8px;
  line-height: 8px;
  text-align: center;
  color: white;
  background: #0000007b;
  border-radius: 50%;
}

.mobile-dice-my {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  margin-bottom: 2px;
}

.mobile-outstatus {
  bottom: -17px;
}

.mobile-will-card {
  width: 60px;
  height: 90px;
}

.mobile-energy {
  width: 12px;
  height: 12px;
  margin: 0;
}

.not-show {
  opacity: 0;
}

.timer {
  width: 90%;
  aspect-ratio: 1/1;
  margin: 10px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  transition: background-image 1s;
}

.end-phase {
  padding: 0;
  height: 90%;
  width: 90%;
  border-radius: inherit;
  font-size: 12px;
}

.cursor-point {
  cursor: pointer;
}

.forbidden {
  background-color: #a8a8a8 !important;
  border: 3px outset #bdbdbd !important;
}

img {
  -webkit-user-drag: none;
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
  background: #335c99d0;
}

::-webkit-scrollbar-track {
  background: transparent;
}

@keyframes blink {
  0% {
    opacity: 0.5;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0.5;
  }
}

@keyframes getcard-my {
  20% {
    transform: translate(500%, -10%);
    z-index: 5;
  }

  80% {
    transform: translate(500%, -10%);
    z-index: 5;
  }

  100% {
    transform: translate(500%, 200%);
  }
}

@keyframes getcard-oppo {
  50% {
    transform: translate(1100%, -50%);
    z-index: 5;
  }

  100% {
    transform: translate(1300%, -80%);
    opacity: 0;
  }
}

@keyframes addcard {
  0% {
    z-index: 5;
    opacity: 0;
    transform: translate(500%, -10%);
  }

  30% {
    z-index: 5;
    opacity: 1;
    transform: translate(500%, -10%);
  }

  50% {
    z-index: 5;
    opacity: 1;
    transform: translate(500%, -10%);
  }

  100% {
    transform: translate(-500%, 0) rotate(-90deg);
    opacity: 0;
  }
}

@keyframes discard-pile {
  20% {
    transform: translate(800%, -10%);
    z-index: 5;
  }

  80% {
    transform: translate(800%, -10%);
    z-index: 5;
  }

  100% {
    transform-origin: center center;
    transform: translate(800%, -10%) scale(0);
    opacity: 0;
    z-index: 5;
  }
}

@keyframes discard-hcard-my {
  0% {
    transform: translate(800%, 200%);
  }

  20% {
    transform: translate(800%, -10%);
    z-index: 5;
  }

  80% {
    transform: translate(800%, -10%);
    z-index: 5;
  }

  100% {
    transform: translate(800%, -10%) scale(0);
    opacity: 0;
    z-index: 5;
  }
}

@keyframes discard-hcard-oppo {
  0% {
    transform: translate(1300%, -80%);
  }

  20% {
    transform: translate(800%, -10%);
    z-index: 5;
  }

  80% {
    transform: translate(800%, -10%);
    z-index: 5;
  }

  100% {
    transform: translate(800%, -10%) scale(0);
    opacity: 0;
    z-index: 5;
  }
}

@keyframes dmgchange {
  50% {
    font-size: larger;
  }
}
</style>
