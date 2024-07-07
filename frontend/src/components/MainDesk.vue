<template>
  <div class="main-container">
    <div class="side" :style="{ opacity: +(player.phase >= PHASE.CHOOSE_HERO) }">
      <div class="round" @click.stop="showHistory">
        <img src="@@/svg/round.svg" alt="回合" />
        <span>{{ client.round }}</span>
      </div>
      <div class="pile">
        <span>
          <div>{{ opponent?.dice.length }}</div>
        </span>
        {{ opponent?.pile.length }}
        <div class="will-getcard-oppo" :class="{ 'mobile-will-card': isMobile }" v-if="opponent?.UI.willGetCard"
          :style="{ left: `${cidx * 70 - 70}px` }" v-for="(_, cidx) in opponent?.UI.willGetCard" :key="cidx"></div>
        <div class="will-addcard-my" :class="{ 'mobile-will-card': isMobile }" v-if="opponent?.UI.willAddCard"
          :style="{ left: `${cidx * 70 - 70}px` }" v-for="(card, cidx) in opponent?.UI.willAddCard" :key="cidx">
          <img class="card-img" :src="card.UI.src" v-if="card?.UI.src?.length > 0" :alt="card.name" />
          <span v-else>{{ card.name }}</span>
        </div>
        <div class="will-discard-hcard-oppo" :class="{ 'mobile-will-card': isMobile }"
          :style="{ left: `${cidx * 70 - 70}px` }" v-for="(card, cidx) in opponent?.UI.willDiscard[0]" :key="cidx">
          <img class="card-img" :src="card.UI.src" v-if="card?.UI.src?.length > 0" :alt="card.name" />
          <span v-else>{{ card.name }}</span>
        </div>
        <div class="will-discard-pile-my" :class="{ 'mobile-will-card': isMobile }"
          :style="{ left: `${cidx * 70 - 70}px` }" v-for="(card, cidx) in opponent?.UI.willDiscard[1]" :key="cidx">
          <img class="card-img" :src="card.UI.src" v-if="card?.UI.src?.length > 0" :alt="card.name" />
          <span v-else>{{ card.name }}</span>
        </div>
      </div>
      <div class="timer" :style="{ 'background-image': currTimeBg }">
        <button class="end-phase" @click.stop="endPhase"
          :class="{ forbidden: player.status == PLAYER_STATUS.WAITING || !canAction || phase >= PHASE.ACTION_END || isLookon > -1 }">
          结束
        </button>
      </div>
      <div class="pile">
        <span>
          <div>{{ player.dice.length }}</div>
        </span>
        {{ player.pile.length }}
        <div class="will-getcard-my" :class="{ 'mobile-will-card': isMobile }" :style="{ left: `${cidx * 70 - 70}px` }"
          v-for="(card, cidx) in player.UI.willGetCard" :key="cidx">
          <img class="card-img" :src="card.UI.src" v-if="card?.UI.src?.length > 0" :alt="card.name" />
          <span v-else>{{ card.name }}</span>
        </div>
        <div class="will-addcard-my" :class="{ 'mobile-will-card': isMobile }" :style="{ left: `${cidx * 70 - 70}px` }"
          v-for="(card, cidx) in player.UI.willAddCard" :key="cidx">
          <img class="card-img" :src="card.UI.src" v-if="card?.UI.src?.length > 0" :alt="card.name" />
          <span v-else>{{ card.name }}</span>
        </div>
        <div class="will-discard-hcard-my" :class="{ 'mobile-will-card': isMobile }"
          :style="{ left: `${cidx * 70 - 70}px` }" v-for="(card, cidx) in player.UI.willDiscard[0]" :key="cidx">
          <img class="card-img" :src="card.UI.src" v-if="card?.UI.src?.length > 0" :alt="card.name" />
          <span v-else>{{ card.name }}</span>
        </div>
        <div class="will-discard-pile-my" :class="{ 'mobile-will-card': isMobile }"
          :style="{ left: `${cidx * 70 - 70}px` }" v-for="(card, cidx) in player.UI.willDiscard[1]" :key="cidx">
          <img class="card-img" :src="card.UI.src" v-if="card?.UI.src?.length > 0" :alt="card.name" />
          <span v-else>{{ card.name }}</span>
        </div>
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
              :style="{ top: support.card.hasSubtype(CARD_SUBTYPE.Ally) && isMobile ? '100%' : '60%' }"
              :src="support.card.UI.src" v-if="support.card.UI.src.length > 0" :alt="support.card.name" />
            <span v-else>{{ support.card.name }}</span>
            <div style="position: absolute; width: 100%; height: 100%"
              :class="{ 'support-can-use': support.perCnt > 0 }">
            </div>
          </div>
          <img class="support-top-icon" v-if="support.type != SUPPORT_TYPE.Permanent"
            :src="getSvgIcon(support.type == SUPPORT_TYPE.Round ? 'round' : 'bag')" />
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
          <img class="support-bottom-icon" v-if="support.hpCnt > 0" :src="getSvgIcon('heal')" />
          <div class="support-bottom-num" v-if="support.hpCnt > 0">
            {{ support.hpCnt }}
          </div>
        </div>
      </div>
    </div>

    <div class="heros">
      <div class="hero" @click.stop="selectHero(getPidx(hidx), getHidx(hidx))" v-if="!!opponent" :style="{
        'background-color': hero.UI.src == '' ? ELEMENT_COLOR[hero?.element ?? ELEMENT_TYPE.Physical] : '',
      }" :class="{
        'mobile-hero': isMobile,
        'my': hidx >= eLen,
        'is-front-oppo': hero?.isFront && player.phase >= PHASE.DICE && opponent?.phase >= PHASE.DICE && hidx < eLen,
        'is-front-my': hero?.isFront && hidx >= eLen,
        'active-willhp': canAction && (willHp[hidx] != undefined || (hero.skills.some(sk => sk.id == currSkill.id) || client.isShowChangeHero >= 2) && hidx >= eLen || willSwitch[hidx]),
      }" v-for="(hero, hidx) in heros" :key="hidx">
        <div class="hero-img-content" :class="{
          'hero-select': heroSelect[hidx],
          'hero-can-select': hero.canSelect && player.status == PLAYER_STATUS.PLAYING,
          'hero-shield7': hero.hp > 0 && [...hero.heroStatus, ...(hero.isFront ? combatStatuses[getPidx(hidx)] : [])].some(sts => sts.hasType(STATUS_TYPE.Shield) && sts.useCnt > 0),
        }">
          <img class="hero-img" :src="hero.UI.src" v-if="hero?.UI.src?.length > 0" :alt="hero.name" />
          <div v-else class="hero-name">{{ hero?.name }}</div>
        </div>
        <div class="hero-freeze" v-if="hero.hp > 0 && hero.heroStatus.some(ist => ist.id == 106)">
          <img :src="getPngIcon('freeze-bg')" />
        </div>
        <div class="hero-freeze" style="background-color: #716446de"
          v-if="hero.hp > 0 && hero.heroStatus.some(ist => ist.id == 2087)"></div>
        <div class="hero-shield2" v-if="hero.hp > 0 &&
          (hero.heroStatus.some(ist => ist.hasType(STATUS_TYPE.Barrier) && ist.useCnt > 0) ||
            // todo 迪希雅的特殊情况要在js里处理
            hero.isFront && combatStatuses[getPidx(hidx)].some(ost => ost.type.some(t => t == STATUS_TYPE.Barrier && (ost.id != 2105 || hero.id != 1209) && ost.useCnt > 0)) ||
            (hero.talentSlot?.hasTag(CARD_TAG.Barrier) && (hero.talentSlot?.useCnt ?? 0) > 0))">
        </div>
        <img class="switch-icon" v-if="willSwitch[hidx]" :src="getSvgIcon('switch')" />
        <div class="hero-hp" v-if="(hero?.hp ?? 0) > 0">
          <img class="hero-hp-bg" src="@@/image/hero-hp-bg.png" />
          <div class="hero-hp-cnt" :class="{ 'is-change': hpCurcnt[hidx].isChange }">
            {{ Math.max(0, hpCurcnt[hidx].val) }}
          </div>
        </div>
        <div class="hero-energys" v-if="(hero?.hp ?? 0) > 0">
          <img v-for="(_, eidx) in hero?.maxEnergy" :key="eidx" class="hero-energy"
            :class="{ 'mobile-energy': isMobile }" :src="getEnergyIcon((hero?.energy ?? 0) - 1 >= eidx)" />
        </div>
        <div class="hero-equipment">
          <div class="hero-weapon" v-if="hero.weaponSlot != null" :class="{ 'slot-select': hero.weaponSlot.selected }">
            <img :src="getSvgIcon('weapon')" />
            <div :style="{
              position: 'absolute',
              width: '100%',
              height: `${100 / (1 + +!!hero.artifactSlot + +!!hero.talentSlot)}%`,
              borderRadius: '50%',
            }" :class="{ 'slot-can-use': hero.weaponSlot.perCnt > 0 }"></div>
          </div>
          <div class="hero-artifact" v-if="hero.artifactSlot != null"
            :class="{ 'slot-select': hero.artifactSlot.selected }">
            <img :src="getSvgIcon('artifact')" />
            <div :style="{
              position: 'absolute',
              width: '100%',
              height: `${100 / (1 + +!!hero.weaponSlot + +!!hero.talentSlot)}%`,
              borderRadius: '50%',
            }" :class="{ 'slot-can-use': hero.artifactSlot.perCnt > 0 }"></div>
          </div>
          <div class="hero-talent" v-if="hero.talentSlot != null" :class="{ 'slot-select': hero.talentSlot.selected }">
            <img :src="getSvgIcon('talent')" />
            <div :style="{
              position: 'absolute',
              width: '100%',
              height: `${100 / (1 + +!!hero.artifactSlot + +!!hero.weaponSlot)}%`,
              borderRadius: '50%',
            }" :class="{ 'slot-can-use': hero.talentSlot.perCnt > 0 }"></div>
          </div>
        </div>
        <div class="attach-element">
          <div class="el-tip" :class="{
            'el-tip-enter': elTips[hidx][0] != '',
            'el-tip-leave': elTips[hidx][0] == '',
          }" :style="{
            color: ELEMENT_COLOR[elTips[hidx][1]],
            fontWeight: 'bolder',
            '-webkit-text-stroke': `0.5px${ELEMENT_COLOR[elTips[hidx][2]]}`,
          }">
            {{ elTips[hidx][0] }}
          </div>
          <img v-for="(el, eidx) in hero.attachElement.filter(() => hero?.hp > 0)" :key="eidx" :src="ELEMENT_URL[el]"
            style="width: 20px" />
          <img class="will-attach" v-for="(attach, waidx) in willAttachs[hidx].filter(() => hero?.hp > 0)" :key="waidx"
            :src="ELEMENT_URL[attach]" />
        </div>
        <div class="instatus" v-if="phase >= PHASE.DICE && hero.hp > 0">
          <div :class="{ status: true, 'mobile-status': isMobile, 'status-select': ists.UI.isSelected }"
            v-for="(ists, isti) in hero.heroStatus.filter((sts, stsi) => hero.heroStatus.length <= 4 ? !sts.hasType(STATUS_TYPE.Hide) : stsi < 4)"
            :key="ists.id">
            <div class="status-bg" :class="{ 'mobile-status-bg': isMobile }" :style="{ background: ists.UI.iconBg }">
            </div>
            <img v-if="getPngIcon(ists.UI.icon) != ''" class="status-icon" :style="{
              filter: getPngIcon(ists.UI.icon).startsWith('https') || ists.UI.icon.startsWith('buff') || ists.UI.icon.endsWith('dice')
                ? `url(${getSvgIcon('filter')}#status-color-${STATUS_BG_COLOR_KEY[ists.UI.iconBg]})` : '',
            }" :src="getPngIcon(ists.UI.icon)" />
            <div v-else style="color: white;">{{ ists.name[0] }}</div>
            <div :style="{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%' }"
              :class="{ 'status-can-use': ists.perCnt > 0 }"></div>
            <div class="status-cnt"
              :class="{ 'mobile-status-cnt': isMobile, 'is-change': statusCurcnt[hidx][0][isti].isChange }"
              v-if="!ists.hasType(STATUS_TYPE.Sign) && (ists.useCnt >= 0 || ists.roundCnt >= 0)">
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
            <div :class="{ status: true, 'mobile-status': isMobile, 'status-select': osts.UI.isSelected }"
              v-for="(osts, osti) in combatStatuses[getPidx(hidx)].filter((sts, stsi) => combatStatuses[getPidx(hidx)].length <= 4 ? !sts.hasType(STATUS_TYPE.Hide) : stsi < 3)"
              :key="osts.id">
              <div class="status-bg" :class="{ 'mobile-status-bg': isMobile }" :style="{ background: osts.UI.iconBg }">
              </div>
              <img v-if="getPngIcon(osts.UI.icon) != ''" class="status-icon" :style="{
                filter: getPngIcon(osts.UI.icon).startsWith('https') || osts.UI.icon.startsWith('buff') || osts.UI.icon.endsWith('dice')
                  ? `url(${getSvgIcon('filter')}#status-color-${STATUS_BG_COLOR_KEY[osts.UI.iconBg]})` : '',
              }" :src="getPngIcon(osts.UI.icon)" />
              <div v-else style="color: white;">{{ osts.name[0] }}</div>
              <div :style="{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%' }"
                :class="{ 'status-can-use': osts.perCnt > 0 }"></div>
              <div class="status-cnt"
                :class="{ 'mobile-status-cnt': isMobile, 'is-change': statusCurcnt[hidx][1][osti].isChange }"
                v-if="!osts.hasType(STATUS_TYPE.Sign) && (osts.useCnt >= 0 || osts.roundCnt >= 0)">
                {{ osts.useCnt < 0 ? osts.roundCnt : osts.useCnt }} </div>
              </div>
              <div v-if="combatStatuses[getPidx(hidx)].length > 4" :class="{ status: true, 'mobile-status': isMobile }"
                style="background-color: #faebd767">
                <span>···</span>
                <div class="status-cnt" :class="{ 'mobile-status-cnt': isMobile }">
                  {{ combatStatuses[getPidx(hidx)].length - 3 }}
                </div>
              </div>
            </div>
            <div class="hero-die" v-if="hero.hp <= 0">
              <img :src="getSvgIcon('die')" style="width: 40px" />
            </div>
            <div :class="{
              'will-damage': (willHp[hidx] ?? 0) <= 0,
              'will-heal': (willHp[hidx] ?? 0) > 0,
            }" :style="{ paddingLeft: `${hero.hp + (willHp[hidx] ?? 0) <= 0 ? '0' : '3px'}` }"
              v-if="willHp[hidx] != undefined">
              <img v-if="(willHp[hidx] ?? 0) % 1 != 0"
                :src="getPngIcon('https://gi-tcg-assets.guyutongxue.support/assets/UI_Gcg_Buff_Common_Revive.webp')"
                style="height: 16px" />
              <img v-else-if="hero.hp + (willHp[hidx] ?? 0) <= 0" :src="getSvgIcon('die')"
                style="height: 16px; padding-left: 3px" />
              <span :style="{ padding: `0 8px 0 ${hero.hp + (willHp[hidx] ?? 0) > 0 ? '5px' : '0'}` }">
                {{ (willHp[hidx] ?? 0) > 0 ? "+" : "-" }}{{ Math.abs(Math.ceil(willHp[hidx] ?? 0) % 100) }}
              </span>
            </div>
            <div class="damages">
              <div class="damage" :class="{ 'show-damage': isShowDmg && willDamages[hidx][0] >= 0 && hero.hp >= 0 }"
                :style="{ color: ELEMENT_COLOR[dmgElements[hidx]] }">
                -{{ willDamages[hidx][0] }}
              </div>
              <div class="damage" :class="{ 'show-damage': isShowDmg && willDamages[hidx][1] > 0 && hero.hp >= 0 }"
                :style="{ color: ELEMENT_COLOR[DAMAGE_TYPE.Pierce] }">
                -{{ willDamages[hidx][1] }}
              </div>
              <div class="heal" :class="{ 'show-heal': isShowHeal && willHeals[hidx] >= 0 }"
                :style="{ color: ELEMENT_COLOR.Heal }">
                +{{ willHeals[hidx] }}
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
                <img class="summon-img" :src="summon.UI.src" v-if="summon?.UI.src?.length > 0" :alt="summon.name" />
                <span v-else>{{ summon.name }}</span>
                <div style="position: absolute; width: 100%; height: 100%"
                  :class="{ 'summon-can-use': summon.perCnt > 0 && !summon.UI.isWill }"></div>
              </div>
              <img class="summon-top-icon" v-if="!summon?.UI.isWill"
                :src="getSvgIcon(summon.maxUse > 10 ? 'bag' : summon.shieldOrHeal < 0 ? 'shield' : 'round')" />
              <div class="summon-top-num" :class="{ 'is-change': summonCurcnt[saidx][suidx].isChange }"
                v-if="!summon?.UI.isWill">
                {{ summon.useCnt }}
              </div>
              <div :class="{
                'will-destroy': summonCnt[getGroup(saidx)][suidx] < 0,
                'will-add': summonCnt[getGroup(saidx)][suidx] > 0,
              }" v-if="summonCnt[getGroup(saidx)][suidx] != 0">
                <img
                  v-if="summonCnt[getGroup(saidx)][suidx] <= -summon.useCnt && summon.isDestroy == SUMMON_DESTROY_TYPE.Used"
                  :src="getSvgIcon('die')" style="height: 16px" />
                <span>
                  {{ summonCnt[getGroup(saidx)][suidx] > 0 ? "+" : summonCnt[getGroup(saidx)][suidx] >
                    -summon.useCnt || summon.isDestroy > 0 ? "-" : "" }}
                </span>
                <span
                  v-if="summonCnt[getGroup(saidx)][suidx] > -summon.useCnt || summon.isDestroy != SUMMON_DESTROY_TYPE.Used">
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
            <div class="init-card" v-for="(card, cidx) in initCards" :key="`${cidx}-${card.id}`"
              @click.stop="selectChangeCard(cidx)">
              <div class="init-card-content">
                <img class="card-img" :src="card.UI.src" v-if="card?.UI.src?.length > 0" :alt="card.name" />
                <span v-else>{{ card.name }}</span>
                <img class="lengend-border" v-if="card.hasSubtype(CARD_SUBTYPE.Legend)"
                  :src="getPngIcon('lengend-border')" />
              </div>
              <div class="init-card-cost">
                <img class="dice-img" :src="getDiceBgIcon(ELEMENT_ICON[card.costType])" />
                <span>{{ card.cost }}</span>
              </div>
              <div class="init-card-energy" v-if="card.anydice > 0">
                <img class="dice-img" :src="getDiceBgIcon(ELEMENT_ICON[ELEMENT_TYPE.Physical])" />
                <span>{{ card.anydice }}</span>
              </div>
              <div class="init-card-energy" v-if="card.energy > 0">
                <img class="dice-img" :src="getDiceBgIcon(ELEMENT_ICON[COST_TYPE.Energy])" />
                <span>{{ card.energy }}</span>
              </div>
              <div class="init-card-energy" v-if="card.hasSubtype(CARD_SUBTYPE.Legend)">
                <img class="dice-img" :src="getDiceBgIcon(ELEMENT_ICON[CARD_SUBTYPE.Legend])" />
              </div>
              <img src="@@/svg/initSelect.svg" alt="选中" v-if="initCardsSelect[cidx]" class="init-select" />
            </div>
          </div>
          <button @click="changeCard" v-if="showChangeCardBtn">
            {{ initCardsSelect.some(v => v) ? "换牌" : "确认手牌" }}
          </button>
        </div>
      </div>
</template>

<script setup lang='ts'>
import { computed, ref, watchEffect } from 'vue';
import { ELEMENT_COLOR, ELEMENT_ICON, ELEMENT_URL, STATUS_BG_COLOR_KEY } from '@@@/constant/UIconst';
import { newHero } from '@@@/data/heros';
import { Card, Hero, Player, Skill, Summon } from '../../../typing';
import {
  CARD_TAG, DamageType, PureElementType, STATUS_TYPE, DAMAGE_TYPE, Version, SKILL_TYPE, PHASE, PLAYER_STATUS, CARD_SUBTYPE,
  SUPPORT_TYPE, ELEMENT_TYPE, SUMMON_DESTROY_TYPE, Phase, COST_TYPE, DICE_COST_TYPE, DiceCostType,
} from '@@@/constant/enum';

const props = defineProps(['isMobile', 'canAction', 'isLookon', 'afterWinHeros', 'client', 'isShowHistory', 'version']);
const emits = defineEmits([
  'selectChangeCard', 'changeCard', 'reroll', 'selectHero', 'selectUseDice', 'selectSummon', 'selectSupport', 'endPhase',
  'showHistory', 'update:diceSelect',
]);

type Curcnt = { sid: number, val: number, isChange: boolean };
const genChangeProxy = (length: number) => Array.from({ length }, () => ({ sid: 0, val: 0, isChange: false }));
const supportCurcnt = ref<Curcnt[][]>([genChangeProxy(4), genChangeProxy(4)]);
const summonCurcnt = ref<Curcnt[][]>([genChangeProxy(4), genChangeProxy(4)]);
const statusCurcnt = ref<Curcnt[][][]>([]);
const hpCurcnt = ref<Curcnt[]>([]);
const getGroup = (idx: number) => idx ^ playerIdx.value ^ 1;
const wrapArr = <T>(arr: T[]) => {
  if (playerIdx.value == 1) return arr;
  const h0 = props.client.players.value[0].heros.length;
  const a0 = arr.slice(0, h0);
  const a1 = arr.slice(h0);
  return a1.concat(a0);
}

const playerIdx = computed<number>(() => Math.max(props.isLookon, props.client.playerIdx));
const player = computed<Player>(() => {
  const players = props.client.players as Player[];
  if (statusCurcnt.value.length == 0) statusCurcnt.value = players.flatMap(p => p.heros.map(() => [genChangeProxy(12), genChangeProxy(12)]));
  if (hpCurcnt.value.length == 0) hpCurcnt.value = players.flatMap(p => genChangeProxy(p.heros.length));
  players.forEach((p, pi) => {
    p.heros.forEach((h, hi) => {
      const hidx = +(pi == playerIdx.value) * players[playerIdx.value ^ 1].heros.length + hi;
      if (hpCurcnt.value[hidx].val != h.hp) {
        if (hpCurcnt.value[hidx].sid == h.id) {
          setTimeout(() => {
            hpCurcnt.value[hidx] = { sid: h.id, val: h.hp, isChange: true };
            setTimeout(() => hpCurcnt.value[hidx].isChange = false, 300);
          }, 200);
        } else {
          hpCurcnt.value[hidx] = { sid: h.id, val: h.hp, isChange: false };
        }
      }
      [h.heroStatus, (p.hidx == hi ? p.combatStatus : [])].forEach((hst, hsti) => {
        hst.forEach((s, si) => {
          const val = Math.max(s.roundCnt, s.useCnt);
          if (statusCurcnt.value[hidx][hsti][si].val != val) {
            if (statusCurcnt.value[hidx][hsti][si].sid == s.id) {
              statusCurcnt.value[hidx][hsti][si] = { sid: s.id, val, isChange: true };
              setTimeout(() => statusCurcnt.value[hidx][hsti][si].isChange = false, 300);
            } else {
              statusCurcnt.value[hidx][hsti][si] = { sid: s.id, val, isChange: false };
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
      const saidx = +(smni == playerIdx.value);
      if (summonCurcnt.value[saidx][smni].val != smn.useCnt) {
        if (summonCurcnt.value[saidx][smni].sid == smn.id) {
          summonCurcnt.value[saidx][smni] = { sid: smn.id, val: smn.useCnt, isChange: true };
          setTimeout(() => summonCurcnt.value[saidx][smni].isChange = false, 300);
        } else {
          summonCurcnt.value[saidx][smni] = { sid: smn.id, val: smn.useCnt, isChange: false };
        }
      }
    });
  })
  return players[playerIdx.value];
});
const version = computed<Version>(() => props.version);
const phase = computed<Phase>(() => props.client.phase);
const opponent = computed<Player>(() => props.client.players[playerIdx.value ^ 1]);
const currCard = computed<Card>(() => props.client.currCard);
const currSkill = computed<Skill>(() => props.client.currSkill);
const isMobile = computed<boolean>(() => props.isMobile);
const rollCnt = computed<number>(() => props.client.rollCnt);
const showRerollBtn = computed<boolean>(() => props.client.showRerollBtn);
const isReconcile = computed<boolean>(() => props.client.isReconcile);
const willAttachs = computed<PureElementType[][]>(() => wrapArr(props.client.willAttachs));
const willDamages = computed<number[][]>(() => wrapArr(props.client.willDamages));
const dmgElements = computed<DamageType[]>(() => wrapArr(props.client.dmgElements));
const willHeals = computed<number[]>(() => wrapArr(props.client.willHeals));
const willHp = computed<(number | undefined)[]>(() => wrapArr(props.client.willHp));
const willSummons = computed<Summon[][]>(() => props.client.willSummons);
const willSwitch = computed<boolean[]>(() => wrapArr(props.client.willSwitch));
const isShowChangeHero = computed<number>(() => props.client.isShowChangeHero);
const isShowDmg = computed<boolean>(() => props.client.isShowDmg);
const isShowHeal = computed<boolean>(() => props.client.isShowHeal);
const canAction = computed<boolean>(() => props.canAction);
const elTips = computed<[string, PureElementType, PureElementType][]>(() => wrapArr(props.client.elTips));
const heroChangeDice = computed<number>(() => props.client.heroChangeDice);
const supportCnt = computed<number[][]>(() => props.client.supportCnt);
const summonCnt = computed<number[][]>(() => props.client.summonCnt);
const initCardsSelect = ref<boolean[]>(new Array(player.value.handCards.length).fill(false));
const heroSelect = computed<number[]>(() => props.client.heroSelect);
const supportSelect = computed<boolean[][]>(() => props.client.supportSelect);
const summonSelect = computed<boolean[][]>(() => props.client.summonSelect);
const isLookon = computed<number>(() => props.isLookon);
const heros = computed<Hero[]>(() => {
  if (props.client.isWin < 2) return [...opponent?.value.heros, ...player.value.heros];
  if (playerIdx.value == 0) return [...props.afterWinHeros[1], ...props.afterWinHeros[0]];
  return props.afterWinHeros.flat();
});
const combatStatuses = [opponent.value.combatStatus, player.value.combatStatus];
const currTime = computed<number>(() => ((props.client.countdown.limit - props.client.countdown.curr) / props.client.countdown.limit) * 100);
const currTimeBg = computed<string>(() => `conic-gradient(transparent ${currTime.value}%, ${player.value.status == PLAYER_STATUS.WAITING ? '#2b6aff' : '#ffb36d'} ${currTime.value + 5}%)`);
const isShowHistory = computed<boolean>(() => props.client.isShowHistory);
const historyInfo = computed<string[]>(() => props.client.log.slice(4));
const initCards = computed<Card[]>(() => player.value.handCards);
const dices = ref<DiceCostType[]>(player.value.dice);
const diceSelect = computed<boolean[]>(() => props.client.diceSelect);
const showChangeCardBtn = ref<boolean>(true);

const eLen = opponent.value.heros.length;
let diceChangeEnter: number | boolean = -1;
let isMouseDown: boolean = false;

// 获得标识号
const getPidx = (hidx: number) => {
  return Math.floor(hidx / eLen);
}

// 获得角色序号
const getHidx = (hidx: number) => {
  return hidx < eLen ? hidx : hidx - eLen;
}

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

watchEffect(() => {
  if (phase.value == PHASE.DICE) {
    initCardsSelect.value = player.value.handCards.map(() => false);
  }
});

// 选择要换的卡
const selectChangeCard = (idx: number) => {
  initCardsSelect.value[idx] = !initCardsSelect.value[idx];
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
  if (!isMouseDown) return;
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
  if (currCard.value.id <= 0 && currSkill.value.type == SKILL_TYPE.Passive && isShowChangeHero.value < 2) return;
  if (isReconcile.value && [DICE_COST_TYPE.Omni, player.value.heros[player.value.hidx].element].includes(dices.value[didx])) return;
  const newVal = !diceSelect.value[didx];
  emits('update:diceSelect', didx, newVal);
  if (newVal) {
    let cost = 0;
    if (currCard.value.id > 0) {
      cost = currCard.value.cost + currCard.value.anydice - currCard.value.costChange;
    } else if (currSkill.value.type > 0) {
      cost = currSkill.value.cost[0].cnt - currSkill.value.costChange[0] + currSkill.value.cost[1].cnt - currSkill.value.costChange[1];
    } else if (isShowChangeHero.value > 0) cost = heroChangeDice.value;
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
  aspect-ratio: 1;
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
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-around;
  align-self: self-end;
}

@property --front-val {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}

.hero {
  --scale-val-will: 1;
  position: relative;
  width: 23%;
  height: 35%;
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

.hero-hp-bg {
  position: absolute;
  width: 28px;
  height: 28px;
}

.hero-hp {
  position: absolute;
  left: -10px;
  top: -10px;
  width: 28px;
  height: 28px;
  display: flex;
  justify-content: center;
  align-items: center;
  letter-spacing: -2px;
  font-size: medium;
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
}

.hero-weapon,
.hero-artifact,
.hero-talent {
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
.hero-talent>img {
  width: 100%;
  border-radius: 50%;
}

.is-front-oppo {
  --front-val: 20%;
}

.is-front-my {
  --front-val: -20%;
}

.will-damage {
  position: absolute;
  top: 5px;
  left: 20%;
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

.will-heal {
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
}

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
  border-radius: 10px;
  color: #22a800;
  font-weight: bold;
  background-color: #7bc67c;
  display: flex;
  justify-content: center;
  align-items: center;
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
  transition: 1s;
  font-weight: bold;
}

.el-tip-enter {
  transform: translate(-50%, -10px);
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
}

.damage,
.heal {
  width: 0;
  height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffef60;
  border-radius: 50%;
  transition: 0.5s;
  font-size: 0;
  opacity: 0;
  box-sizing: border-box;
  -webkit-text-stroke: 0.5px black;
}

.show-damage,
.show-heal {
  width: 40px;
  height: 40px;
  font-size: large;
  font-weight: bold;
  opacity: 1;
  border: 3px solid #9e9978;
}

.instatus {
  position: absolute;
  bottom: 0;
  width: 100%;
  display: flex;
  flex-direction: row;
  box-sizing: border-box;
  padding: 3px;
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
  width: 18px;
  height: 18px;
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
  border-radius: 2px !important;
  border: 4px solid #fffdd2e5 !important;
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
  border: 2px black solid;
  border-radius: 10px;
  background: black;
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
  border-radius: 10px;
  overflow: hidden;
}

.summon-img {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 107%;
  border-radius: 10px;
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
}

.summon-top-icon,
.support-top-icon {
  position: absolute;
  top: 0;
  right: 0;
  width: 25px;
  height: 25px;
  transform: translate(35%, -30%);
}

.summon-bottom-num,
.support-bottom-num {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 25px;
  height: 25px;
  text-align: center;
  line-height: 25px;
  transform: translate(-35%, 30%);
  color: white;
  font-weight: bolder;
  font-size: medium;
  -webkit-text-stroke: 1px black;
}

.summon-bottom-icon,
.support-bottom-icon {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  background: radial-gradient(#ffffff 10%, #ffffff19 60%, transparent 80%);
  transform: translate(-30%, 30%);
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
  aspect-ratio: 1;
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
  box-shadow: 0 0 5px 2px yellow inset;
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

.lengend-border {
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

.init-card-cost {
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
}

.init-select {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 50%;
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
  background-image: url('https://homdgcat.wiki/images/GCG/UI_Gcg_CardBack_01.png');
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
  background-image: url('https://homdgcat.wiki/images/GCG/UI_Gcg_CardBack_01.png');
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
  aspect-ratio: 1;
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

<style>
@keyframes attack0-1 {
  30% {
    transform: rotate(-60deg) scale(1.3);
    z-index: 5;
  }

  70% {
    transform: rotate(-60deg) scale(1.3);
    z-index: 5;
  }

  85% {
    transform: translate(-300%, -170%) rotate(-60deg) scale(0.7);
    z-index: 5;
  }

  95% {
    transform: rotate(-60deg);
    z-index: 5;
  }
}

@keyframes attack1-1 {
  30% {
    transform: rotate(-35deg) scale(1.3);
    z-index: 5;
  }

  70% {
    transform: rotate(-35deg) scale(1.3);
    z-index: 5;
  }

  85% {
    transform: translate(-150%, -170%) rotate(-35deg) scale(0.7);
    z-index: 5;
  }

  95% {
    transform: rotate(-35deg);
    z-index: 5;
  }
}

@keyframes attack2-1 {
  70% {
    transform: translate(0, 0) scale(1.3);
    z-index: 5;
  }

  85% {
    transform: translate(0%, -170%) scale(0.7);
    z-index: 5;
  }
}

@keyframes attack3-1 {
  30% {
    transform: rotate(35deg) scale(1.3);
    z-index: 5;
  }

  70% {
    transform: rotate(35deg) scale(1.3);
    z-index: 5;
  }

  85% {
    transform: translate(150%, -170%) rotate(35deg) scale(0.7);
    z-index: 5;
  }

  95% {
    transform: rotate(35deg);
    z-index: 5;
  }
}

@keyframes attack4-1 {
  30% {
    transform: rotate(60deg) scale(1.3);
    z-index: 5;
  }

  70% {
    transform: rotate(60deg) scale(1.3);
    z-index: 5;
  }

  85% {
    transform: translate(300%, -170%) rotate(60deg) scale(0.7);
    z-index: 5;
  }

  95% {
    transform: rotate(60deg);
    z-index: 5;
  }
}

@keyframes attack0-0 {
  30% {
    transform: rotate(-60deg) scale(1.3);
    z-index: 5;
  }

  70% {
    transform: rotate(-60deg) scale(1.3);
    z-index: 5;
  }

  85% {
    transform: translate(300%, 170%) rotate(-60deg) scale(0.7);
    z-index: 5;
  }

  95% {
    transform: rotate(-60deg);
    z-index: 5;
  }
}

@keyframes attack1-0 {
  30% {
    transform: rotate(-35deg) scale(1.3);
    z-index: 5;
  }

  70% {
    transform: rotate(-35deg) scale(1.3);
    z-index: 5;
  }

  85% {
    transform: translate(150%, 170%) rotate(-35deg) scale(0.7);
    z-index: 5;
  }

  95% {
    transform: rotate(-35deg);
    z-index: 5;
  }
}

@keyframes attack2-0 {
  70% {
    transform: translate(0, 0) scale(1.3);
    z-index: 5;
  }

  85% {
    transform: translate(0%, 170%) scale(0.7);
    z-index: 5;
  }
}

@keyframes attack3-0 {
  30% {
    transform: rotate(35deg) scale(1.3);
    z-index: 5;
  }

  70% {
    transform: rotate(35deg) scale(1.3);
    z-index: 5;
  }

  85% {
    transform: translate(-150%, 170%) rotate(35deg) scale(0.7);
    z-index: 5;
  }

  95% {
    transform: rotate(35deg);
    z-index: 5;
  }
}

@keyframes attack4-0 {
  30% {
    transform: rotate(60deg) scale(1.3);
    z-index: 5;
  }

  70% {
    transform: rotate(60deg) scale(1.3);
    z-index: 5;
  }

  85% {
    transform: translate(-300%, 170%) rotate(60deg) scale(0.7);
    z-index: 5;
  }

  95% {
    transform: rotate(60deg);
    z-index: 5;
  }
}
</style>
