<template>
  <div class="main-container">
    <div class="side" :style="{ opacity: +(player.phase >= PHASE.CHOOSE_HERO) }">
      <div class="round" @click.stop="showHistory">
        <img class="round-bg" src="@@/image/TimeState.png" alt="回合" />
        <StrokedText class="round-text">{{ client.round }}</StrokedText>
      </div>
      <div class="pile">
        <img src="@@/image/card-bg.png" alt="" class="pile-bg">
        <span class="dice-cnt">
          <div>
            <StrokedText>{{ diceCnt[playerIdx ^ 1] }}</StrokedText>
          </div>
        </span>
        <StrokedText class="pile-cnt">{{ pileCnt[playerIdx ^ 1] }}</StrokedText>
        <Handcard class="will-getcard-oppo" :class="{
          'mobile-will-card': isMobile,
          'will-getcard-oppo-pile': opponent?.UI.willGetCard.isFromPile,
          'will-getcard-oppo-generate': !opponent?.UI.willGetCard.isFromPile
        }" v-if="opponent?.UI.willGetCard"
          :style="{ left: `${getLeft(cidx, opponent?.UI.willGetCard.cards.length)}px` }"
          v-for="(card, cidx) in opponent?.UI.willGetCard.cards" :card="card" :isMobile="isMobile" :key="cidx">
        </Handcard>
        <Handcard class="will-addcard-oppo" :class="{ 'mobile-will-card': isMobile }"
          v-if="opponent?.UI.willAddCard.cards"
          :style="{ left: `${getLeft(cidx, opponent?.UI.willAddCard.cards.length)}px` }"
          v-for="(card, cidx) in opponent?.UI.willAddCard.cards" :card="card" :isMobile="isMobile" :key="cidx">
        </Handcard>
        <Handcard class="will-discard-hcard-oppo" :class="{ 'mobile-will-card': isMobile }" :card="card"
          :isMobile="isMobile" :style="{ left: `${getLeft(cidx, opponent?.UI.willDiscard.hcards.length)}px` }"
          v-for="(card, cidx) in opponent?.UI.willDiscard.hcards" :key="cidx">
        </Handcard>
        <Handcard class="will-discard-pile-my" :class="{ 'mobile-will-card': isMobile }" :card="card"
          :isMobile="isMobile" :style="{ left: `${getLeft(cidx, opponent?.UI.willDiscard.pile.length)}px` }"
          v-for="(card, cidx) in opponent?.UI.willDiscard.pile" :key="cidx">
        </Handcard>
      </div>
      <div class="end-phase-btn">
        <button class="end-phase" @click.stop="endPhase" :class="{
          'pre-end-phase': !isShowEndPhase,
          forbidden: player.status == PLAYER_STATUS.WAITING || !canAction || phase >= PHASE.ACTION_END || isLookon > -1,
        }" :style="{
          backgroundImage: `url(${getPngIcon(`RoundButton_0${phase == PHASE.ACTION && player.status == PLAYER_STATUS.WAITING ? 1 : !canAction || isLookon > -1 ? 5 : isShowEndPhase ? 4 : 2}`)})`,
        }">
          <img class="end-phase-icon" :class="{ 'confirm-end-phase': isShowEndPhase }" :src="getSvgIcon('round')"
            alt="">
        </button>
        <div class="timer" :style="{ backgroundImage: currTimeBg }"></div>
      </div>
      <div class="pile">
        <img src="@@/image/card-bg.png" alt="" class="pile-bg">
        <span class="dice-cnt">
          <div style="background-color: #eca944;">
            <StrokedText>{{ diceCnt[playerIdx] }}</StrokedText>
          </div>
        </span>
        <StrokedText class="pile-cnt">{{ pileCnt[playerIdx] }}</StrokedText>
        <Handcard class="will-addcard-my" :class="{ 'mobile-will-card': isMobile }" :card="card" :isMobile="isMobile"
          :style="{ left: `${getLeft(cidx, player.UI.willAddCard.cards.length)}px` }"
          v-for="(card, cidx) in player.UI.willAddCard.cards" :key="cidx">
        </Handcard>
        <Handcard class="will-discard-pile-my" :class="{ 'mobile-will-card': isMobile }" :card="card"
          :isMobile="isMobile" :style="{ left: `${getLeft(cidx, player?.UI.willDiscard.pile.length)}px` }"
          v-for="(card, cidx) in player.UI.willDiscard.pile" :key="cidx">
        </Handcard>
      </div>
      <div class="history-info" v-if="isShowHistory">
        <div v-for="(his, hsidx) in historyInfo" :key="hsidx" :style="{ color: his.color }">
          {{ his.ctt }}
        </div>
      </div>
    </div>

    <div class="supports self">
      <div class="support-area" v-for="(supportArea, saidx) in [opponent?.supports ?? [], player.supports]"
        :key="saidx">
        <div class="support" :class="{
          'support-select': supportSelect[saidx][siidx],
          'support-can-select': supportCanSelect[saidx][siidx] && player.status == PLAYER_STATUS.PLAYING,
          'active-supportcnt': canAction && supportCnt[getGroup(saidx)][siidx],
        }" v-for="(support, siidx) in supportArea" :key="siidx" @click.stop="showSupportInfo(saidx, siidx)">
          <div class="support-img-content">
            <div class="card-border"></div>
            <img class="support-img"
              :style="{ top: support.card.hasSubtype(CARD_SUBTYPE.Ally) && isMobile ? '100%' : '60%' }"
              :src="getPngIcon(support.card.UI.src)" v-if="support.card.UI.src.length > 0" :alt="support.card.name" />
            <span v-else>{{ support.card.name }}</span>
            <div style="position: absolute; width: 100%; height: 100%"
              :class="{ 'support-can-use': support.perCnt > 0 }">
            </div>
          </div>
          <img class="support-top-icon" v-if="support.type != SUPPORT_TYPE.Permanent"
            :src="getPngIcon(support.type == SUPPORT_TYPE.Round ? 'TimeState' : 'Counter')" />
          <StrokedText class="support-top-num" :class="{ 'is-change': supportCurcnt[saidx][siidx].isChange }"
            v-if="support.type != SUPPORT_TYPE.Permanent">
            {{ support.cnt }}
          </StrokedText>
          <div :class="{
            // 'will-destroy': supportCnt[getGroup(saidx)][siidx] < 0,
            'will-add': supportCnt[getGroup(saidx)][siidx] != 0,
          }" :style="{
            'border-image-source': `url(${getPngIcon(`Preview${supportCnt[getGroup(saidx)][siidx] > 0 ? 3 : supportCnt[getGroup(saidx)][siidx] < -support.cnt ? 1 : 2}`)})`,
          }">
            <img v-if="supportCnt[getGroup(saidx)][siidx] < -support.cnt" :src="getSvgIcon('die')"
              style="height: 16px;" />
            <StrokedText>
              {{ supportCnt[getGroup(saidx)][siidx] > 0 ? "+" :
                supportCnt[getGroup(saidx)][siidx] >= -support.cnt ? "-" : "" }}
            </StrokedText>
            <StrokedText v-if="supportCnt[getGroup(saidx)][siidx] >= -support.cnt">
              {{ Math.abs(supportCnt[getGroup(saidx)][siidx]) }}
            </StrokedText>
          </div>
          <img class="support-bottom-icon" v-if="support.heal > 0" :src="getPngIcon('Element_Heal')" />
          <StrokedText class="support-bottom-num" v-if="support.heal > 0">
            {{ support.heal }}
          </StrokedText>
        </div>
      </div>
    </div>

    <div class="heros" :class="{ 'mobile-heros': isMobile }">
      <div class="hero-group" v-for="(hgroup, hgi) in heros" :key="hgi">
        <div class="hero" @click.stop="selectHero(hgi, hidx)" v-if="!!opponent" :style="{
          backgroundColor: hero.UI.src == '' ? ELEMENT_COLOR[hero?.element ?? ELEMENT_TYPE.Physical] : '',
        }" :class="{
          'mobile-hero': isMobile,
          'my': hgi == 1,
          'oppo': hgi == 0,
          'is-front-oppo': hero?.isFront && phase >= PHASE.DICE && hgi == 0,
          'is-front-my': hero?.isFront && hgi == 1,
          'hero-select': heroSelect[hgi][hidx],
          'hero-can-select': hgi == 1 && heroCanSelect[hidx] && player.status == PLAYER_STATUS.PLAYING,
          'active-willhp': canAction && (
            willHp[hgi][hidx] != undefined || willAttachs[hgi][hidx]?.length || energyCnt[hgi][hidx] ||
            (heroSelect[hgi][hidx] || client.isShowSwitchHero >= 2) && hgi == 1 ||
            willSwitch[hgi][hidx] || targetSelect?.[hgi]?.[hidx] || changedHeros[getGroup(hgi)][hidx]
          ),
        }" v-for="(hero, hidx) in hgroup" :key="hidx">
          <div class="card-border"></div>
          <div class="hero-img-content">
            <img :class="['hero-img', { blink: changedHeros[getGroup(hgi)][hidx] }]"
              :src="changedHeros[getGroup(hgi)][hidx] || hero.UI.src" v-if="hero?.UI.src?.length > 0"
              :alt="hero.name" />
            <div v-else class="hero-name">{{ hero?.name }}</div>
          </div>
          <div class="hero-freeze" v-if="hasObjById(hero.heroStatus, 106)">
            <img :src="getPngIcon('freeze-bg')" />
          </div>
          <div class="hero-freeze" v-if="hasObjById(hero.heroStatus, 116033)">
            <img :src="getPngIcon('rocken-bg')" />
          </div>
          <div class="hero-shield"
            v-if="[...hero.heroStatus, ...(hero.isFront ? combatStatuses[hgi] : [])].some(sts => sts.hasType(STATUS_TYPE.Shield) && sts.useCnt > 0)">
          </div>
          <div class="hero-barrier" v-if="(
            hero.heroStatus.some(ist => ist.hasType(STATUS_TYPE.Barrier)) ||
            hero.isFront && combatStatuses[hgi].some(ost => ost.hasType(STATUS_TYPE.Barrier)) ||
            hero.talentSlot?.tag.includes(CARD_TAG.Barrier) && hero.talentSlot.perCnt != 0 ||
            hero.weaponSlot?.tag.includes(CARD_TAG.Barrier) && hero.weaponSlot.perCnt != 0) ||
            hero.vehicleSlot?.[0].tag.includes(CARD_TAG.Barrier) && hero.vehicleSlot[0].perCnt != 0">
            <img :src="getPngIcon('barrier-bg')" alt="" style="width: 100%;height: 100%;">
          </div>
          <img class="hero-center-icon" v-if="willSwitch[hgi][hidx]" :src="getPngIcon('Select_Replace')" />
          <img class="hero-center-icon" style="width: 60%;opacity: 1;" src="@@/image/Select_Ring_01.png"
            v-if="targetSelect?.[hgi]?.[hidx]" />
          <img class="hero-center-icon" style="width: 30%;opacity: 1;" src="@@/image/Select_Check_01.png"
            v-if="targetSelect?.[hgi]?.[hidx]" />
          <div class="hero-hp" :class="{ 'mobile-hero-hp': isMobile }" v-if="(hero?.hp ?? 0) >= 0">
            <img class="hero-hp-bg" src="@@/image/hero-hp-bg.png" :style="{
              filter: `${hasObjById(hero.heroStatus, 122) ? 'saturate(2.2) hue-rotate(-25deg) contrast(0.8)' :
                hero.hp == hero.maxHp ? 'brightness(1.2)' : ''}`
            }" />
            <StrokedText class="hero-hp-cnt" :class="{ 'is-change': hpCurcnt[hgi][hidx].isChange }">
              {{ Math.max(0, hpCurcnt[hgi][hidx].val) }}
            </StrokedText>
          </div>
          <div class="hero-energys" v-if="hero && hero.hp > 0">
            <div v-for="(_, eidx) in Math.abs(hero.maxEnergy) / (hero.maxEnergy >= 0 ? 1 : 2)" :key="eidx"
              class="hero-energy" :class="{ 'mobile-energy': isMobile }">
              <img class="hero-energy-img" :src="getEnergyIcon(
                hero.maxEnergy < 0 && Math.abs(hero.energy) + Math.max(0, energyCnt?.[hgi]?.[hidx] ?? 0) + (hero.maxEnergy / 2) - 1 >= eidx,
                hero.maxEnergy < 0
              )">
              <img class="hero-energy-img" :class="{
                blink: (Math.abs(hero.energy) - 1 < eidx && Math.abs(hero.energy) + (energyCnt?.[hgi]?.[hidx] ?? 0) - 1 >= eidx) ||
                  (Math.abs(hero.energy) + (hero.maxEnergy / 2) - 1 < eidx && Math.abs(hero.energy) + (energyCnt?.[hgi]?.[hidx] ?? 0) + (hero.maxEnergy / 2) - 1 >= eidx)
              }" :src="getEnergyIcon(
                Math.abs(hero.energy) + Math.max(0, energyCnt?.[hgi]?.[hidx] ?? 0) - 1 >= eidx,
                hero.maxEnergy < 0,
                Math.abs(hero.energy) + Math.max(0, energyCnt?.[hgi]?.[hidx] ?? 0) + (hero.maxEnergy / 2) - 1 >= eidx
              )" />
            </div>
            <div class="hero-vehicle" v-if="hero.vehicleSlot != null" style="margin-top: 15%;" :class="{
              'slot-select': slotSelect[hgi][hidx]?.[SLOT_CODE[CARD_SUBTYPE.Vehicle]],
            }">
              <img :src="hero.vehicleSlot[1].UI.src || CARD_SUBTYPE_URL[CARD_SUBTYPE.Vehicle]" />
              <div :class="{ 'slot-can-use': hero.vehicleSlot[0].perCnt + hero.vehicleSlot[1].perCnt > 0 }"></div>
            </div>
          </div>
          <div class="hero-equipment" v-if="hero && hero.hp >= 0">
            <div class="hero-weapon" v-if="hero.weaponSlot != null"
              :class="{ 'slot-select': slotSelect[hgi][hidx]?.[SLOT_CODE[CARD_SUBTYPE.Weapon]] }">
              <img :src="CARD_SUBTYPE_URL[CARD_SUBTYPE.Weapon]" />
              <div :class="{ 'slot-can-use': hero.weaponSlot.perCnt > 0 }"></div>
            </div>
            <div class="hero-relic" v-if="hero.relicSlot != null"
              :class="{ 'slot-select': slotSelect[hgi][hidx]?.[SLOT_CODE[CARD_SUBTYPE.Relic]] }">
              <img :src="CARD_SUBTYPE_URL[CARD_SUBTYPE.Relic]" />
              <div :class="{ 'slot-can-use': hero.relicSlot.perCnt > 0 }"></div>
            </div>
            <div class="hero-talent" v-if="hero.talentSlot != null"
              :class="{ 'slot-select': slotSelect[hgi][hidx]?.[SLOT_CODE[CARD_SUBTYPE.Talent]] }">
              <img :src="CARD_SUBTYPE_URL[CARD_SUBTYPE.Talent]" />
              <div :class="{ 'slot-can-use': hero.talentSlot.perCnt > 0 }"></div>
            </div>
          </div>
          <div class="attach-element">
            <template v-if="elTips[hgi][hidx] != undefined && elTips[hgi][hidx][0] != ''">
              <img :src="ELEMENT_URL[elTips[hgi][hidx][1]]" alt="" style="width: 20px;"
                :class="{ 'el-tip-anime-left-icon': elTips[hgi][hidx][0] != '' }">
              <img :src="ELEMENT_URL[elTips[hgi][hidx][2]]" alt="" style="width: 20px;"
                :class="{ 'el-tip-anime-right-icon': elTips[hgi][hidx][0] != '' }">
              <div class="el-tip" :class="{ 'el-tip-anime': elTips[hgi][hidx][0] != '' }"
                :style="{ color: REACTION_COLOR[elTips[hgi][hidx][0]] }">
                {{ elTips[hgi][hidx][0] }}
              </div>
            </template>
            <template v-if="hero.hp > 0">
              <img v-for="(el, eidx) in hero.attachElement" :key="eidx" :src="ELEMENT_URL[el]" style="width: 20px;" />
              <img class="will-attach"
                v-for="(attach, waidx) in willAttachs[hgi][hidx]?.filter(wa => wa != ELEMENT_TYPE.Physical)"
                :key="waidx" :src="ELEMENT_URL[attach]" />
            </template>
          </div>
          <div class="instatus" v-if="phase >= PHASE.DICE">
            <div class="status"
              :class="{ 'mobile-status': isMobile, 'status-select': statusSelect[hgi]?.[0]?.[hidx]?.[isti] }"
              v-for="(ists, isti) in hero.heroStatus.filter((sts, stsi) => (hero.heroStatus.length <= 4 || stsi < 3) && (hero.hp >= 0 || sts.hasType(STATUS_TYPE.Show)))"
              :key="ists.id">
              <div class="status-bg" :class="{ 'mobile-status-bg': isMobile }" :style="{ background: ists.UI.iconBg }">
              </div>
              <img v-if="getPngIcon(ists.UI.icon) != ''" class="status-icon" :style="{
                filter: (getPngIcon(ists.UI.icon).startsWith('https') ||
                  ists.UI.icon == STATUS_ICON.ElementAtkUp ||
                  ists.UI.icon == STATUS_ICON.Enchant ||
                  ists.UI.icon.endsWith('dice')) && !getPngIcon(ists.UI.icon).includes('guyutongxue')
                  ? getSvgFilter(ists.UI.iconBg) : '',
              }" :src="getPngIcon(ists.UI.icon)" />
              <div v-else style="color: white;">{{ ists.name[0] }}</div>
              <div style="position: absolute;width: 100%;height: 100%;border-radius: 50%;"
                :class="{ 'status-can-use': ists.perCnt > 0 }"></div>
              <div class="status-cnt"
                :class="{ 'mobile-status-cnt': isMobile, 'is-change': statusCurcnt[hgi][hidx][0][isti].isChange }"
                v-if="!ists.hasType(STATUS_TYPE.Sign) && (ists.useCnt >= 0 || ists.roundCnt >= 0)">
                {{ ists.useCnt < 0 ? ists.roundCnt : ists.useCnt }} </div>
              </div>
              <div v-if="hero.heroStatus.length > 4" class="status" :class="{ 'mobile-status': isMobile }"
                style="background-color: #faebd767;">
                <span style="color: beige;">…</span>
                <div class="status-cnt" :class="{ 'mobile-status-cnt': isMobile }">
                  {{ hero.heroStatus.length - 3 }}
                </div>
              </div>
            </div>
            <div class="outstatus" :class="{ 'mobile-outstatus': isMobile }"
              v-if="phase >= PHASE.DICE && hero.hp >= 0 && hero.isFront">
              <div class="status"
                :class="{ 'mobile-status': isMobile, 'status-select': statusSelect[hgi]?.[1]?.[hidx]?.[osti] }"
                v-for="(osts, osti) in combatStatuses[hgi].filter((_, stsi) => combatStatuses[hgi].length <= 4 || stsi < 3)"
                :key="osts.id">
                <div class="status-bg" :class="{ 'mobile-status-bg': isMobile }"
                  :style="{ background: osts.UI.iconBg }">
                </div>
                <img v-if="getPngIcon(osts.UI.icon) != ''" class="status-icon" :style="{
                  filter: (getPngIcon(osts.UI.icon).startsWith('https') ||
                    osts.UI.icon == STATUS_ICON.ElementAtkUp ||
                    osts.UI.icon == STATUS_ICON.Enchant ||
                    osts.UI.icon.endsWith('dice')) && !getPngIcon(osts.UI.icon).includes('guyutongxue')
                    ? getSvgFilter(osts.UI.iconBg) : '',
                }" :src="getPngIcon(osts.UI.icon)" />
                <div v-else style="color: white;">{{ osts.name[0] }}</div>
                <div :style="{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%' }"
                  :class="{ 'status-can-use': osts.perCnt > 0 }"></div>
                <div class="status-cnt"
                  :class="{ 'mobile-status-cnt': isMobile, 'is-change': statusCurcnt[hgi][hidx][1][osti].isChange }"
                  v-if="!osts.hasType(STATUS_TYPE.Sign) && (osts.useCnt >= 0 || osts.roundCnt >= 0)">
                  {{ osts.useCnt < 0 ? osts.roundCnt : osts.useCnt }} </div>
                </div>
                <div v-if="combatStatuses[hgi].length > 4" class="status" :class="{ 'mobile-status': isMobile }"
                  style="background-color: #faebd767">
                  <span style="color: beige;">…</span>
                  <div class="status-cnt" :class="{ 'mobile-status-cnt': isMobile }">
                    {{ combatStatuses[hgi].length - 3 }}
                  </div>
                </div>
              </div>
              <div class="hero-die" v-if="hero.hp <= 0">
                <img :src="getPngIcon('Death')" style="width: 90%;" />
              </div>
              <div :class="{
                'will-damage': (willHp[hgi][hidx] ?? 0) <= 0,
                'will-heal': (willHp[hgi][hidx] ?? 0) > 0,
              }" :style="{
                paddingLeft: `${hero.hp + (willHp[hgi][hidx] ?? 0) <= 0 ? '0' : '3px'}`,
                // backgroundImage: `url(${getPngIcon(`Preview${(willHp[hgi][hidx] ?? 0) <= 0 ? 2 : 3}`)})`,
                borderImageSource: `url(${getPngIcon(`Preview${hero.hp + (willHp[hgi][hidx] ?? 0) <= 0 ? 1 : (willHp[hgi][hidx] ?? 0) <= 0 || ((willHp[hgi][hidx] ?? 0) % 1 != 0 && hero.hp > 0) ? 2 : 3}`)})`,
                color: `${hero.hp + (willHp[hgi][hidx] ?? 0) <= 0 ? '#ffdada' : (willHp[hgi][hidx] ?? 0) <= 0 ? 'white' : '#e0ffd6'}`,
              }" v-if="willHp[hgi][hidx] != undefined">
                <img v-if="(willHp[hgi][hidx] ?? 0) % 1 != 0" :src="getPngIcon(STATUS_ICON.Revive)"
                  style="height: 16px;" />
                <img v-else-if="hero.hp + (willHp[hgi][hidx] ?? 0) <= 0" :src="getSvgIcon('die')"
                  style="height: 16px; padding-left: 3px;" />
                <StrokedText
                  :style="{ padding: `0 8px 0 ${hero.hp + (willHp[hgi][hidx] ?? 0) > 0 && (willHp[hgi][hidx] ?? 0) % 1 == 0 ? '5px' : '0'}` }">
                  {{ (willHp[hgi][hidx] ?? 0) > 0 ? "+" : "-" }}{{
                    Math.min(100, Math.abs(Math.ceil(willHp[hgi][hidx] ?? 0)) % 100) }}
                </StrokedText>
              </div>
              <div class="damages">
                <div class="damage" v-if="dmgElements[hgi] != undefined && willDamages[hgi][hidx] != undefined"
                  :class="{ 'show-damage': isShowDmg && willDamages[hgi][hidx][0] >= 0 && hero.hp >= 0 }" :style="{
                    color: ELEMENT_COLOR[dmgElements[hgi][hidx]],
                    backgroundImage: `url(${getPngIcon('Attack')})`,
                  }">
                  <StrokedText>
                    -{{ willDamages[hgi][hidx][0] }}
                  </StrokedText>
                </div>
                <div class="damage" v-if="willDamages[hgi][hidx] != undefined"
                  :class="{ 'show-damage': isShowDmg && willDamages[hgi][hidx][1] > 0 && hero.hp >= 0 }" :style="{
                    color: ELEMENT_COLOR[DAMAGE_TYPE.Pierce],
                    backgroundImage: `url(${getPngIcon('Attack')})`,
                  }">
                  <StrokedText>
                    -{{ willDamages[hgi][hidx][1] }}
                  </StrokedText>
                </div>
                <div class="heal" v-if="willHeals[hgi][hidx] != undefined"
                  :class="{ 'show-heal': isShowDmg && willHeals[hgi][hidx] >= 0 }" :style="{
                    color: ELEMENT_COLOR.Heal,
                    backgroundImage: `url(${getPngIcon('Heal')})`,
                    paddingTop: '9%',
                  }">
                  <StrokedText>
                    +{{ Math.ceil(willHeals[hgi][hidx]) }}
                  </StrokedText>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="summons">
          <div class="summon-area" v-if="!!opponent" v-for="(smnArea, saidx) in smnAreas" :key="saidx">
            <div class="summon" :class="{
              'will-attach': summon.UI.isWill || summon.UI.willChange,
              'summon-select': summonSelect[saidx][suidx] && !summon.UI.isWill,
              'summon-can-select': summonCanSelect[saidx][suidx] && player.status == PLAYER_STATUS.PLAYING && !summon.UI.isWill,
              'active-summoncnt': canAction && summonCnt[getGroup(saidx)][suidx] != 0,
            }" v-for="(summon, suidx) in smnArea" :key="suidx"
              @click.stop="showSummonInfo(saidx, suidx, summon.UI.isWill)">
              <div class="summon-img-content">
                <div class="card-border"></div>
                <img class="summon-img" :src="summon.UI.src" v-if="summon?.UI.src?.length > 0" :alt="summon.name" />
                <span v-else>{{ summon.name }}</span>
                <div style="position: absolute; width: 100%; height: 100%;top: 0;"
                  :class="{ 'summon-can-use': summon.perCnt > 0 && !summon.UI.isWill }"></div>
              </div>
              <img class="summon-top-icon" v-if="!summon?.UI.isWill" :src="getPngIcon(summon.UI.icon)" />
              <StrokedText class="summon-top-num" :class="{ 'is-change': summonCurcnt[saidx][suidx].isChange }"
                v-if="!summon?.UI.isWill">
                {{ summon.useCnt }}
              </StrokedText>
              <div :class="{
                // 'will-destroy': summonCnt[getGroup(saidx)][suidx] < 0,
                // 'will-add': summonCnt[getGroup(saidx)][suidx] > 0,
                'will-add': true,
              }" :style="{
                borderImageSource: `url(${getPngIcon(`Preview${summonCnt[getGroup(saidx)][suidx] > 0 ? 3 : summonCnt[getGroup(saidx)][suidx] <= -summon.useCnt && (summon.isDestroy == SUMMON_DESTROY_TYPE.Used || summonCnt[getGroup(saidx)][suidx] < -50) ? 1 : 2}`)})`,
              }" v-if="summonCnt[getGroup(saidx)][suidx] != 0">
                <img
                  v-if="summonCnt[getGroup(saidx)][suidx] <= -summon.useCnt && (summon.isDestroy == SUMMON_DESTROY_TYPE.Used || summonCnt[getGroup(saidx)][suidx] < -50)"
                  :src="getSvgIcon('die')" style="height: 16px;" />
                <StrokedText>
                  {{ summonCnt[getGroup(saidx)][suidx] > 0 ? "+" :
                    summonCnt[getGroup(saidx)][suidx] > -summon.useCnt ||
                      (summon.isDestroy != SUMMON_DESTROY_TYPE.Used && summonCnt[getGroup(saidx)][suidx] > -50) ?
                      "-" : "" }}
                </StrokedText>
                <StrokedText
                  v-if="summonCnt[getGroup(saidx)][suidx] > -summon.useCnt || (summon.isDestroy != SUMMON_DESTROY_TYPE.Used && summonCnt[getGroup(saidx)][suidx] > -50)">
                  {{ Math.floor(Math.abs(Math.max(summonCnt[getGroup(saidx)][suidx], -summon.useCnt))) }}
                </StrokedText>
              </div>
              <img class="summon-bottom-icon" v-if="!summon?.UI.isWill"
                :style="{ background: `radial-gradient(${ELEMENT_COLOR.Heal} 30%, ${ELEMENT_COLOR.Heal}19 60%, transparent 80%)` }"
                :src="summon.damage >= 0 ? ELEMENT_URL[summon.element] : getPngIcon('Element_Heal')" />
              <StrokedText class="summon-bottom-num" v-if="!summon?.UI.isWill">
                {{ summon.damage >= 0 ? summon.damage : summon.shieldOrHeal }}{{ summon.UI.hasPlus ? "+" : "" }}
              </StrokedText>
            </div>
          </div>
        </div>

        <div class="dices" :class="{ 'mobile-dices': isMobile }">
          <div class="dice-my" v-for="(dice, didx) in player.phase >= PHASE.ACTION_START ? dices : []" :key="didx"
            :class="{ 'mobile-dice-my': isMobile }" @click.stop="selectUseDice(didx)">
            <div class="dice-select" v-if="diceSelect[didx]"></div>
            <img class="dice-change-img" :src="getDiceBgIcon(ELEMENT_ICON[dice])" style="opacity: 1" />
            <img class="dice-change-el-img" :src="getDiceIcon(ELEMENT_ICON[dice])" />
            <img class="dice-change-img" :src="getDiceBgIcon(ELEMENT_ICON[dice])" />
          </div>
        </div>

        <div class="dice-change"
          v-if="(phase == PHASE.DICE || phase == PHASE.ACTION) && player.phase == PHASE.DICE && !isHide && isLookon == -1"
          @mousedown.stop="mousedown()" @mouseup.stop="mouseup" @touchmove.stop="selectRerollDiceByMobile"
          @touchstart.stop="mousedown()" @touchend.stop="mouseup">
          <div class="dice-change-area">
            <div class="dice-container" v-for="(dice, didx) in dices" :key="didx">
              <div class="dice" @pointerdown="mousedown(didx)" @pointerenter="selectRerollDice(didx)">
                <div class="dice-select" v-if="diceSelect[didx]"></div>
                <img class="dice-change-img" :src="getDiceBgIcon(ELEMENT_ICON[dice])" style="opacity: 1" />
                <img class="dice-change-el-img" :src="getDiceIcon(ELEMENT_ICON[dice])" />
                <img class="dice-change-img" :src="getDiceBgIcon(ELEMENT_ICON[dice])" :didx="didx" />
              </div>
            </div>
          </div>
          <div v-if="rollCnt > 1" style="color: white; position: absolute; bottom: 35%;">
            还可重投{{ rollCnt }}轮
          </div>
          <button @click="reroll()" class="button" :class="{ 'not-show': !showRerollBtn }">
            {{diceSelect.some(v => v) ? "重掷" : "确认"}}
          </button>
        </div>

        <div class="card-change" v-if="player.phase == PHASE.CHANGE_CARD && !isHide && isLookon == -1">
          <div class="init-cards">
            <Handcard :class="['init-card', card.UI.class ?? '']" v-for="(card, cidx) in initCards"
              :key="`${card.entityId}-initcard`" :card="card" :isMobile="isMobile" @click.stop="selectChangeCard(cidx)"
              :style="{ left: client.initcardsPos[cidx], top: '25%' }">
              <img :src="getPngIcon('Select_ExchangeCard')" alt="选中" v-if="initCardsSelect[cidx]" class="init-select" />
              <div v-if="initCardsSelect[cidx]" class="init-select-text">替换</div>
            </Handcard>
          </div>
          <button class="button" @click="changeCard" v-if="showChangeCardBtn">
            {{initCardsSelect.some(v => v) ? "换牌" : "确认手牌"}}
          </button>
        </div>

        <div class="card-pick" v-if="player.phase == PHASE.PICK_CARD && !isHide && isLookon == -1">
          <div style="color: white;font-size: large;letter-spacing: 5px;">挑选卡牌</div>
          <div class="pick-cards">
            <Handcard class="pick-card" v-for="(card, cidx) in pickCards" :key="`${card.entityId}-pickcard`"
              :card="card" :isMobile="isMobile" :class="{ 'pick-select': cidx == pickCardIdx }"
              @click.stop="selectCardPick(cidx)">
              <div style="position: relative;color: white;top: 20px;">{{ card.name }}</div>
            </Handcard>
          </div>
          <button class="button" @click="pickCard" v-if="pickCardIdx > -1">确认</button>
        </div>
      </div>

      <div v-if="showHideBtn" class="display-btn" :class="{ 'hide-btn': isHide }">
        <img @click="triggerHide" src="@@/svg/lookon.svg" alt="显/隐"
          style="position: absolute;width: 100%;height: 100%;" />
        <div style="width: 20px;height: 30px;"></div>
      </div>
</template>

<script setup lang='ts'>
import Handcard from '@/components/Card.vue';
import GeniusInvokationClient from '@/geniusInovakationClient';
import {
  CARD_SUBTYPE, CARD_TAG, DAMAGE_TYPE, DamageType, DICE_COST_TYPE, DiceCostType, ELEMENT_TYPE, ElementType, PHASE, Phase, PLAYER_STATUS,
  PureElementType, SKILL_TYPE, STATUS_TYPE, SUMMON_DESTROY_TYPE, SUPPORT_TYPE, Version
} from '@@@/constant/enum';
import { MAX_SUMMON_COUNT, MAX_SUPPORT_COUNT } from '@@@/constant/gameOption';
import { CARD_SUBTYPE_URL, ELEMENT_COLOR, ELEMENT_ICON, ELEMENT_URL, REACTION_COLOR, SLOT_CODE, STATUS_BG_COLOR_CODE, STATUS_BG_COLOR_KEY, STATUS_ICON, StatusBgColor } from '@@@/constant/UIconst';
import { newHero } from '@@@/data/heros';
import { newSkill } from '@@@/data/skills';
import { hasObjById } from '@@@/utils/gameUtil';
import { computed, onMounted, ref, watchEffect } from 'vue';
import { Card, Hero, Player, Skill, Status, Summon } from '../../../typing';
import StrokedText from './StrokedText.vue';

const props = defineProps<{
  isMobile: boolean,
  canAction: boolean,
  isLookon: number,
  afterWinHeros: Hero[][],
  client: GeniusInvokationClient,
  version: Version,
}>();
const emits = defineEmits<{
  selectChangeCard: [idx: number, val: boolean],
  changeCard: [cidxs: number[]],
  reroll: [],
  selectHero: [pidx: number, hidx: number],
  selectUseDice: [],
  selectSummon: [pidx: number, suidx: number],
  selectSupport: [pidx: number, siidx: number],
  endPhase: [],
  showHistory: [],
  'update:diceSelect': [didx: number, val?: boolean],
  selectCardPick: [pcidx: number],
  pickCard: [],
  'update:isShowEndPhase': [val: boolean],
}>();

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

const playerIdx = computed<number>(() => props.client.playerIdx);
const player = computed<Player>(() => {
  const players: Player[] = props.client.players;
  if (statusCurcnt.value.length == 0) statusCurcnt.value = players.map(p => p.heros.map(() => [genChangeProxy(12), genChangeProxy(12)]));
  if (hpCurcnt.value.length == 0) hpCurcnt.value = players.map(p => genChangeProxy(p.heros.length));
  if (props.client.phase > PHASE.NOT_BEGIN && hpCurcnt.value.length > 0) {
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
        if (supportCurcnt.value[pi][sti].val != st.cnt) {
          if (supportCurcnt.value[pi][sti].sid == st.entityId) {
            supportCurcnt.value[pi][sti] = { sid: st.entityId, val: st.cnt, isChange: true };
            setTimeout(() => supportCurcnt.value[pi][sti].isChange = false, 300);
          } else {
            supportCurcnt.value[pi][sti] = { sid: st.entityId, val: st.cnt, isChange: false };
          }
        }
      });
      p.summons.forEach((smn, smni) => {
        if (summonCurcnt.value[pi][smni].val != smn.useCnt) {
          if (summonCurcnt.value[pi][smni].sid == smn.id) {
            summonCurcnt.value[pi][smni] = { sid: smn.id, val: smn.useCnt, isChange: true };
            setTimeout(() => summonCurcnt.value[pi][smni].isChange = false, 300);
          } else {
            summonCurcnt.value[pi][smni] = { sid: smn.id, val: smn.useCnt, isChange: false };
          }
        }
      });
    });
  }
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
  if (
    dmgs.length > 0 && props.client.damageVO.dmgSource == 'skill' &&
    atkHidx.value >= 0 && tarHidx.value > -1 && heroDOMs.value != undefined && !isAnimating
  ) {
    isAnimating = true;
    const isAtker = playerIdx.value == atkPidx.value;
    const atkHeroDOM = heroDOMs.value[+isAtker * props.client.players[playerIdx.value ^ 1].heros.length + atkHidx.value];
    const { width: parentWidth = 0 } = atkHeroDOM?.parentElement?.getBoundingClientRect() ?? {};
    const { width, height } = atkHeroDOM?.getBoundingClientRect() ?? {};
    const widthDiff = (tarHidx.value - atkHidx.value) * (width + 0.1 * parentWidth);
    const heightDiff = height / 0.35 * 0.5 * (isAtker ? -1 : 1);
    const deg = Math.atan2(widthDiff, -heightDiff) * (180 / Math.PI) - (isAtker ? 0 : 180);
    const atkAnime = atkHeroDOM?.animate([{
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
    const tarHeroDOM = heroDOMs.value[+!isAtker * props.client.players[playerIdx.value ^ 1].heros.length + tarHidx.value];
    setTimeout(() => {
      const tarAnime = tarHeroDOM.animate([{
        offset: 0.5,
        transform: `translate(${15 * Math.tan(deg / 180 * Math.PI) * (isAtker ? 1 : -1)}px,${5 * (isAtker ? -1 : 1)}px) scale(0.9)`,
        zIndex: 5,
      }, {
        offset: 1,
        zIndex: 5,
      }], { duration: 175 });
      setTimeout(() => tarAnime.cancel(), 175);
    }, 525);
    setTimeout(() => atkAnime?.cancel(), 700);
    setTimeout(() => isAnimating = false, 3000);
  }
  return dmgs;
});
const dmgElements = computed<DamageType[][]>(() => wrapArr(props.client.damageVO.dmgElements ?? []));
const willHeals = computed<number[][]>(() => wrapArr(props.client.damageVO.willHeals ?? []));
const elTips = computed<[string, PureElementType, PureElementType][][]>(() => wrapArr(props.client.damageVO.elTips ?? []));
const willHp = computed<(number | undefined)[][]>(() => wrapArr(props.client.willHp));
const willSummons = computed<Summon[][]>(() => props.client.willSummons);
const willSwitch = computed<boolean[][]>(() => wrapArr(props.client.willSwitch.flat()));
const smnAreas = computed(() => {
  const { client: { player, opponent, changedSummons } } = props;
  const areas = [[...opponent?.summons, ...willSummons.value[0]], [...player.summons, ...willSummons.value[1]]];
  [changedSummons[opponent?.pidx], changedSummons[player.pidx]].forEach((smns, smnsi) => {
    smns?.forEach((smn, smni) => {
      if (smn == undefined) return;
      areas[smnsi].splice(smni, 1, smn);
    });
  });
  return areas;
});
const changedHeros = computed<(string | undefined)[][]>(() => props.client.changedHeros);
const isShowSwitchHero = computed<number>(() => props.client.isShowSwitchHero);
const isShowDmg = computed<boolean>(() => props.client.isShowDmg);
const canAction = computed<boolean>(() => props.canAction);
const heroSwitchDice = computed<number>(() => props.client.heroSwitchDice);
const supportCnt = computed<number[][]>(() => props.client.supportCnt);
const summonCnt = computed<number[][]>(() => props.client.summonCnt);
const energyCnt = computed<number[][]>(() => wrapArr(props.client.energyCnt.flat()));
const initCardsSelect = ref<boolean[]>(new Array(player.value.handCards.length).fill(false));
const heroSelect = computed<number[][]>(() => props.client.heroSelect);
const heroCanSelect = computed<boolean[]>(() => props.client.heroCanSelect);
const supportSelect = computed<boolean[][]>(() => props.client.supportSelect);
const supportCanSelect = computed<boolean[][]>(() => props.client.supportCanSelect);
const summonSelect = computed<boolean[][]>(() => props.client.summonSelect);
const summonCanSelect = computed<boolean[][]>(() => props.client.summonCanSelect);
const statusSelect = computed<boolean[][][][]>(() => props.client.statusSelect);
const slotSelect = computed<boolean[][][]>(() => props.client.slotSelect);
const targetSelect = computed<boolean[][]>(() => props.client.targetSelect);
const isLookon = computed<number>(() => props.isLookon);
const heros = computed<Hero[][]>(() => {
  if (props.client.isWin < 2) return [opponent?.value?.heros ?? [], player.value.heros];
  if (playerIdx.value == 0) return [props.afterWinHeros[1], props.afterWinHeros[0]];
  return props.afterWinHeros;
});
const combatStatuses = computed<Status[][]>(() => [opponent.value.combatStatus, player.value.combatStatus]);
const currTime = computed<number>(() => ((props.client.countdown.limit - props.client.countdown.curr) / props.client.countdown.limit) * 100);
const currTimeBg = computed<string>(() => `conic-gradient(transparent ${currTime.value}%, ${player.value.status == PLAYER_STATUS.WAITING ? '#63a0e6' : '#ffb36d'} ${currTime.value + 5}%)`);
const isShowHistory = computed<boolean>(() => props.client.isShowHistory);
const getColor = (ctt: string) => {
  const preffix = ctt.match(/(?<=\[)[^\]]+(?=\])/)?.[0];
  if (preffix == '我方') return '#e0b97e';
  if (preffix == '对方') return '#a3ceff';
  return 'white';
}
const historyInfo = computed<{ ctt: string, color: string }[]>(() => props.client.log.map(lg => ({ ctt: lg, color: getColor(lg) })));
const initCards = computed<Card[]>(() => player.value.handCards);
const dices = computed<DiceCostType[]>(() => player.value.dice);
const diceSelect = computed<boolean[]>(() => props.client.diceSelect);
const pickCards = computed<Card[]>(() => props.client.pickModal.cards);
const pickCardIdx = computed<number>(() => props.client.pickModal.selectIdx);
const showChangeCardBtn = ref<boolean>(true);
const showHideBtn = computed<boolean>(() =>
  (player.value.phase == PHASE.DICE && (phase.value == PHASE.DICE || phase.value == PHASE.ACTION)) ||
  player.value.phase == PHASE.CHANGE_CARD || player.value.phase == PHASE.PICK_CARD);
const isShowEndPhase = computed<boolean>(() => props.client.isShowEndPhase); // 是否显示确认结束回合按钮
const isHide = ref<boolean>(false); // 显示/隐藏换手牌、换骰子、挑选界面

let diceChangeEnter: -1 | boolean = -1;
let isMouseDown: boolean = false;

// 获取png图片
const getPngIcon = (name: string) => {
  if (name.startsWith('http') || name == '') return name;
  if (name.endsWith('-dice')) return getSvgIcon(name);
  if (name.startsWith('ski')) {
    if (name.includes(',')) {
      const [hid, skidx] = name.slice(3).split(',').map(v => JSON.parse(v));
      return newHero(version.value)(hid).skills?.[skidx].UI.src ?? '';
    }
    return newSkill(version.value)(+name.slice(3)).UI.src ?? '';
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
const getEnergyIcon = (isCharged: boolean = false, isSp: boolean = false, isFull: boolean = false) => {
  return `/image/${isSp ? 'sp-' : ''}energy-${isCharged ? 'charged' : 'empty'}${isSp && isFull ? '-full' : ''}.png`;
};

// 获取过滤器
const getSvgFilter = (statusColor: StatusBgColor) => {
  return `url(/svg/filter.svg#status-color-${STATUS_BG_COLOR_CODE[STATUS_BG_COLOR_KEY[statusColor]]})`;
}

// 摸牌、弃牌、加牌等动画，牌的位置计算函数
const getLeft = (cidx: number, len: number) => {
  const willCardGap = isMobile.value ? 50 : 70;
  const initLeftOffset = isMobile.value ? cidx : cidx - 1;
  return initLeftOffset * willCardGap - len * willCardGap / 2;
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
// 选择要重掷的骰子(移动端用)
const selectRerollDiceByMobile = (e: TouchEvent) => {
  const { pageX, pageY } = e.touches[0];
  const ele = document.elementFromPoint(pageX, pageY);
  if (!ele?.hasAttribute('didx')) return;
  selectRerollDice(+ele.getAttribute('didx')!);
}
// 重掷骰子
const reroll = () => {
  if (!showRerollBtn.value) return;
  emits('reroll');
};
// 选择要挑选的卡牌
const selectCardPick = (pcidx: number) => {
  emits('selectCardPick', pcidx);
}
// 挑选卡牌
const pickCard = () => {
  emits('pickCard');
  isHide.value = true;
  setTimeout(() => isHide.value = false, 1e3);
}
// 选择要消费的骰子
const selectUseDice = (didx: number) => {
  if (player.value.status == PLAYER_STATUS.WAITING) return;
  if (currCard.value.id <= 0 && currSkill.value.type == SKILL_TYPE.Passive && isShowSwitchHero.value == 0) return;
  if (isReconcile.value && [DICE_COST_TYPE.Omni, player.value.heros[player.value.hidx].element].includes(dices.value[didx])) return;
  const newVal = !diceSelect.value[didx];
  emits('update:diceSelect', didx, newVal);
  if (newVal) {
    let cost = 0;
    if (currCard.value.id > 0) {
      cost = currCard.value.cost + currCard.value.anydice - currCard.value.costChange;
    } else if (currSkill.value.type != SKILL_TYPE.Passive) {
      cost = currSkill.value.cost[0].cnt - currSkill.value.costChange[0] + currSkill.value.cost[1].cnt - currSkill.value.costChange[1];
    } else if (isShowSwitchHero.value > 0) cost = heroSwitchDice.value;
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
  if (isNotShow) return;
  emits('selectSummon', pidx, suidx);
};
// 显示场地信息/选择卡牌目标
const showSupportInfo = (pidx: number, siidx: number) => {
  emits('selectSupport', pidx, siidx);
};
// 显示历史信息
const showHistory = () => {
  emits('showHistory');
}
// 隐藏/显示选择操作界面
const triggerHide = () => {
  isHide.value = !isHide.value;
}
// 确认结束回合
const endPhase = () => {
  if (player.value.status == PLAYER_STATUS.WAITING || !canAction) return;
  if (!isShowEndPhase.value) emits('update:isShowEndPhase', !isShowEndPhase.value);
  else emits('endPhase');
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
  font-family: HYWH;
}

.side {
  height: 85%;
  width: min(50px, 5%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding-left: 1%;
}

.round {
  position: relative;
  width: 50%;
  aspect-ratio: 1/1;
  color: white;
  margin-bottom: 5px;
  cursor: pointer;
}

.round-bg {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  left: 0;
  top: 0;
}

.round-text {
  position: absolute;
  width: 100%;
  height: 100%;
}

.pile {
  position: relative;
  border-top: 2px solid #d7c578;
  border-right: 2px solid #d7c578;
  border-bottom: 2px solid #d7c578;
  border-top-right-radius: 7px;
  border-bottom-right-radius: 7px;
  height: 20%;
  width: 100%;
  background-color: #49485c;
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  align-items: center;
}

.pile-bg {
  position: absolute;
  height: 200%;
  transform: translate(-40%) rotate(90deg);
}

.dice-cnt {
  width: 55%;
  aspect-ratio: 1/1.1;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  background-color: #bdbdbd;
  display: flex;
  justify-content: center;
  align-items: center;
}

.dice-cnt>div {
  width: 80%;
  height: 80%;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #5675a5;
}

.pile-cnt {
  position: relative;
}

.button {
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
  font-family: HYWH;
}

.button:active {
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
  justify-content: center;
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
  aspect-ratio: 7/12;
  border-radius: 10px;
  margin: 0 5%;
  cursor: pointer;
  transition: --front-val 0.3s, box-shadow 0.5s;
  background: white;
  transform: translateY(var(--front-val)) scale(var(--scale-val-will));
}

.hero.my {
  align-self: flex-end;
}

.hero.oppo {
  align-self: flex-start;
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
  font-size: min(23px, max(16px, 2vw));
}

.hero-hp-cnt {
  color: white;
  z-index: 1;
  padding-top: 10%;
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
  right: -3%;
  top: 15px;
  width: 30%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  z-index: 1;
}

.hero-energy {
  position: relative;
  width: 15px;
  height: 15px;
  margin-bottom: 1px;
}

.hero-energy-img {
  width: 140%;
  height: 100%;
  position: absolute;
}

.hero-equipment {
  position: absolute;
  top: 20%;
  left: -20%;
  width: 30%;
  z-index: 1;
}

.hero-weapon,
.hero-relic,
.hero-talent,
.hero-vehicle {
  position: relative;
  left: 35%;
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
.hero-relic>img,
.hero-talent>img,
.hero-vehicle>img {
  width: 100%;
  border-radius: 50%;
  filter: brightness(0.3);
}

.hero-vehicle>img {
  border-radius: 50%;
  filter: brightness(0.3);
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

/* .will-destroy {
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
} */

.will-add {
  position: absolute;
  top: -5px;
  left: -5px;
  min-width: 35px;
  height: 23px;
  /* border-radius: 10px;
  color: #22a800;
  background-color: #7bc67c; */
  display: flex;
  justify-content: center;
  align-items: center;
  border-image-slice: 20 25 fill;
  border-image-width: 7px;
  color: white;
  z-index: 1;
}

.attach-element {
  width: 2000%;
  position: absolute;
  top: -23px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  pointer-events: none;
}

.el-tip {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.el-tip-anime {
  animation: eltips 1.5s linear forwards;
}

.el-tip-anime-left-icon {
  animation: eltips-left-icon 1.5s linear forwards;
}

.el-tip-anime-right-icon {
  animation: eltips-right-icon 1.5s linear forwards;
}

.attach-element img {
  margin: 0 2px;
}

.will-attach {
  width: 20px;
  --blink-opacity: 0.5;
  animation: blink 1s linear infinite alternate;
  z-index: 5;
}

.blink {
  --blink-opacity: 0.5;
  animation: blink 1s linear infinite alternate;
}

.hero-energy-img.blink {
  --blink-opacity: 0.2;
}

.hero-img.blink {
  --blink-opacity: 0.9;
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
  z-index: 1;
}

.hero-freeze>img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}

.hero-barrier {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120%;
  height: 108%;
  transform: translate(-50%, -50%);
  /* border-radius: inherit;
  border-left: 5px solid #bff6ffbb;
  border-right: 5px solid #bff6ffbb; */
}

.hero-center-icon {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  opacity: 0.85;
  z-index: 1;
}

.hero-shield {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 101%;
  height: 102%;
  transform: translate(-50%, -50%);
  border-radius: 5px;
  border: 2px solid #fffdd2e9;
  box-shadow: 0 0 10px 5px #fffdd2e9 inset;
  box-sizing: border-box;
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
  transition: box-shadow 0.4s;
  transform: scale(var(--scale-val-will));
  background-color: black;
  border-radius: 10%;
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
  --scale-val-change: 1.1;
  position: absolute;
  top: 0;
  right: 0;
  width: 25px;
  height: 25px;
  text-align: center;
  line-height: 25px;
  transform: translate(35%, -25%) scale(var(--scale-val-change));
  color: white;
  font-size: medium;
  transition: 0.2s;
  z-index: 1;
}

.summon-top-icon,
.support-top-icon {
  position: absolute;
  top: 0;
  right: 0;
  width: 28px;
  height: 28px;
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
  transform: translate(-35%, 35%) scale(1.1);
  color: white;
  font-size: medium;
  z-index: 1;
}

.summon-bottom-icon,
.support-bottom-icon {
  position: absolute;
  left: 10px;
  bottom: 10px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: radial-gradient(#ffffff 10%, #ffffff19 60%, transparent 80%);
  transform: translate(-30%, 30%);
  z-index: 1;
}

.dices {
  height: 70%;
  width: 5%;
  text-align: center;
  padding-top: 140px;
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
  position: relative;
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
  animation: can-use-blink 3s linear infinite alternate;
}

.slot-can-use {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  box-shadow: 0 0 5px 2px yellow inset;
  animation: can-use-blink 3s linear infinite alternate;
  z-index: 2;
}

.summon-can-use {
  box-shadow: 0 0 15px 2px yellow inset;
  animation: can-use-blink 3s linear infinite alternate;
}

.status-can-use {
  box-shadow: 0 0 5px 1px yellow inset;
  animation: can-use-blink 3s linear infinite alternate;
}

.summon-select,
.support-select,
.hero-select,
.status-select,
.slot-select,
.pick-select {
  box-shadow: 4px 4px 6px #ffeb56, -4px 4px 6px #ffeb56, 4px -4px 6px #ffeb56,
    -4px -4px 6px #ffeb56 !important;
}

.summon-select,
.support-select,
.hero-select {
  background-color: #ffeb56;
}

.dice-select {
  width: 90%;
  height: 105%;
  background-color: #ffeb56;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.hero-can-select,
.summon-can-select,
.support-can-select {
  box-shadow: 2px 2px 3px #d1ffc4, -2px 2px 3px #d1ffc4, 2px -2px 3px #d1ffc4,
    -2px -2px 3px #d1ffc4;
  z-index: 5;
}

.dice-my {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-bottom: 2px;
  cursor: pointer;
}

.card-change,
.card-pick {
  position: absolute;
  top: 0;
  left: 10%;
  width: 80%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #636363f4;
  border-radius: 5px;
  padding: 10px 0;
  z-index: 2;
}

.init-cards {
  position: relative;
  width: 100%;
  height: 70%;
  margin: 0 auto;
}

.init-card {
  position: absolute;
  cursor: pointer;
  text-align: center;
  background-color: #a7bbdd;
  transition: .75s;
}

.pick-cards {
  display: flex;
  width: 100%;
  height: 70%;
  justify-content: space-around;
  align-items: center;
}

.pick-card {
  position: relative;
  cursor: pointer;
  text-align: center;
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

.changed-card {
  animation: changed-card linear forwards .75s;
}

@keyframes changed-card {
  50% {
    transform: perspective(500px) translate(-1000%, 100%) rotate(90deg) rotateY(180deg);
  }

  100% {
    transform: perspective(500px) translate(-1000%, 100%) rotate(90deg) rotateY(180deg);
  }
}

.change-card {
  transform: perspective(500px) translate(-1000%, 100%) rotate(90deg) rotateY(180deg);
  animation: change-card linear forwards .75s;
}

@keyframes change-card {
  0% {
    transform: perspective(500px) translate(-1000%, 100%) rotate(90deg) rotateY(180deg);
  }

  50% {
    transform: perspective(500px) translate(-1000%, 100%) rotate(90deg) rotateY(180deg);
  }

  100% {
    transform: initial;
  }
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
  /* min-width: 100%;
  min-height: 100%;
  max-height: 120%; */
  transform: translateX(-50%);
  width: 100%;
  height: 100%;
  line-height: 500%;
  /* border-radius: 10px; */
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
  max-width: 50%;
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

.init-select {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(30deg);
  width: 80%;
  animation: forwards init-select .2s;
}

.init-select-text {
  color: white;
  text-shadow: 0 0 20px red;
  transform: translateY(30px);
}

@keyframes init-select {
  to {
    transform: translate(-50%, -50%);
  }
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
}

.will-getcard-oppo {
  position: absolute;
  background-color: #304260;
  color: black;
  text-align: center;
  padding-top: 20px;
  transform: rotate(90deg);
  z-index: 5;
  overflow: hidden;
}

.will-getcard-oppo-pile {
  animation: getcard-oppo-pile 1.5s linear forwards;
}

.will-getcard-oppo-generate {
  animation: getcard-oppo-generate 1.5s linear forwards;
}

.will-addcard-my {
  position: absolute;
  color: black;
  text-align: center;
  background-color: #a7bbdd;
  transform: translate(500%, -10%);
  animation: addcard 1.5s linear;
  opacity: 0;
}

.will-addcard-oppo {
  position: absolute;
  background-color: #304260;
  color: black;
  text-align: center;
  transform: translate(500%, -10%);
  animation: addcard 1.5s linear;
  opacity: 0;
}

.will-discard-pile-my {
  position: absolute;
  color: black;
  text-align: center;
  background-color: #a7bbdd;
  transform: rotate(90deg);
  animation: discard-pile 1.5s linear forwards;
}

.will-discard-hcard-oppo {
  position: absolute;
  color: black;
  text-align: center;
  background-color: #a7bbdd;
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

.display-btn {
  position: absolute;
  top: 5%;
  right: 10%;
  z-index: 5;
  width: 10%;
  cursor: pointer;
  filter: brightness(10);
}

.hide-btn::before {
  content: '/';
  position: absolute;
  left: 45%;
  top: 30%;
  transform: scale(2.5);
  z-index: 1;
  pointer-events: none;
}

.mobile-heros {
  height: 100%;
  width: 38%;
}

.mobile-hero {
  max-width: 18%;
}

.mobile-hero-hp {
  width: 55%;
}

.mobile-dices {
  padding-top: 80px;
}

.mobile-status {
  width: 12px;
  height: 12px;
  line-height: 12px;
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
  bottom: -14px;
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

.end-phase-btn {
  width: 130%;
  aspect-ratio: 1/1;
  margin: 20% 0;
  display: grid;
  grid-template-areas: 'a';
  transition: background-image 1s;
  justify-items: center;
  align-items: center;
}

.end-phase {
  height: 130%;
  width: 100%;
  grid-area: a;
  background-size: 100%;
  cursor: pointer;
  background-color: transparent;
  border: none;
}

.end-phase:active {
  background-image: url(@@/image/RoundButton_03.png) !important;
}

.end-phase::before {
  content: '◀';
  position: absolute;
  font-size: medium;
  left: 6%;
  top: 43%;
  color: #ffb36d;
}

.end-phase::after {
  content: '宣布结束';
  color: white;
  position: absolute;
  left: 7%;
  top: 42%;
  background: linear-gradient(to right, #ffb36d, #ca6732);
  padding: .8%;
  border-radius: 5px;
  font-family: HYWH;
}

.pre-end-phase::before,
.pre-end-phase::after {
  display: none;
}

.confirm-end-phase {
  filter: brightness(2);
}

.timer {
  grid-area: a;
  width: 65%;
  height: 65%;
  border-radius: 50%;
  transition: background-image 1s;
  margin-top: 1px;
  mask-image: radial-gradient(circle at center, transparent 57%, #000 57%);
  pointer-events: none;
}

.forbidden {
  pointer-events: none;
}

.end-phase-icon {
  width: 40%;
  height: 40%;
  grid-area: a;
  padding-top: 15%;
  pointer-events: none;
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
  background: #8caee1d0;
}

::-webkit-scrollbar-track {
  background: transparent;
}

@keyframes blink {
  0% {
    opacity: var(--blink-opacity);
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: var(--blink-opacity);
  }
}

@keyframes can-use-blink {
  0% {
    opacity: 0.5;
  }

  20% {
    opacity: 1;
  }

  80% {
    opacity: 1;
  }

  100% {
    opacity: 0.5;
  }
}

@keyframes eltips {
  0% {
    top: 0px;
    opacity: 0;
  }

  15% {
    top: 0px;
    opacity: 0;
  }

  40% {
    top: -8px;
    opacity: 1;
  }

  80% {
    top: -8px;
    opacity: 1;
  }

  100% {
    top: -8px;
    opacity: 0;
  }
}

@keyframes eltips-left-icon {
  40% {
    transform: translateX(80%) scale(0);
  }

  100% {
    transform: translateX(80%) scale(0);
  }
}

@keyframes eltips-right-icon {
  40% {
    transform: translateX(-80%) scale(0);
  }

  100% {
    transform: translateX(-80%) scale(0);
  }
}

@keyframes getcard-oppo-pile {
  50% {
    transform: translate(1100%, -50%);
    z-index: 5;
  }

  100% {
    transform: translate(1300%, -80%);
    opacity: 0;
  }
}

@keyframes getcard-oppo-generate {
  0% {
    transform: translate(calc(50vw - 50%), 0%);
    opacity: 0;
  }

  50% {
    transform: translate(calc(50vw - 50%), 0%);
    opacity: 1;
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
    transform: translate(calc(50vw - 50%), -10%);
  }

  30% {
    z-index: 5;
    opacity: 1;
    transform: translate(calc(50vw - 50%), -10%);
  }

  50% {
    z-index: 5;
    opacity: 1;
    transform: translate(calc(50vw - 50%), -10%);
  }

  100% {
    z-index: 5;
    opacity: 0;
    transform: translate(-500%, 0) rotate(-90deg) rotateY(180deg);
  }
}

@keyframes discard-pile {
  20% {
    transform: translate(calc(50vw - 50%), -10%);
    z-index: 5;
  }

  80% {
    transform: translate(calc(50vw - 50%), -10%);
    z-index: 5;
  }

  100% {
    transform-origin: center center;
    transform: translate(calc(50vw - 50%), -10%) scale(0);
    opacity: 0;
    z-index: 5;
  }
}

@keyframes discard-hcard-oppo {
  0% {
    transform: translate(1300%, -80%);
  }

  20% {
    transform: translate(calc(50vw - 50%), 10%);
    z-index: 5;
  }

  80% {
    transform: translate(calc(50vw - 50%), 10%);
    z-index: 5;
  }

  100% {
    transform: translate(calc(50vw - 50%), 10%) scale(0);
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