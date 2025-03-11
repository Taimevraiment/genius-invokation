import { expect } from 'chai';
import geniusInvokationRoom from '../dist/backend/src/geniusInvokationRoom.js';
import { ACTION_TYPE, DICE_COST_TYPE, PHASE } from '../dist/common/constant/enum.js';
import { parseShareCode, wait } from '../dist/common/utils/utils.js';

const execAll = async fn => { for (let i = 0; i < 2; ++i) await fn(i) }
const startGame = async (room, shareCode0, shareCode1 = shareCode0) => {
    const shareCode = [shareCode0, shareCode1];
    await execAll(i => {
        const { heroIds, cardIds } = parseShareCode(shareCode[i]);
        room.getAction({ type: ACTION_TYPE.StartGame, heroIds, cardIds, shareCode: shareCode[i] }, i);
    });
    // 以下为直接跳到行动阶段
    room.phase = PHASE.ACTION;
    room.players.forEach(p => {
        p.phase = PHASE.ACTION;
        p.dice = new Array(8).fill(DICE_COST_TYPE.Omni);
        p.hidx = p.pidx;
        p.heros[p.hidx].isFront = true;
        p.canAction = p.pidx == room.currentPlayerIdx;
    });
    // 以下为模拟换卡、选角、选骰
    // await execAll(async i => {
    //     room.getAction({ type: ACTION_TYPE.ChangeCard }, i);
    //     await delay(1100);
    //     room.getAction({ type: ACTION_TYPE.ChooseInitHero, heroIdxs: [i] }, i);
    //     room.getAction({ type: ACTION_TYPE.ChooseInitHero, heroIdxs: [i] }, i);
    // });
    // await delay(500);
    // execAll(i => room.getAction({ type: ACTION_TYPE.Reroll, diceSelect: room.players[i].dice.map(() => false) }, i));
}
const changeFrontHero = (player, hidx) => {
    const { heros } = player;
    heros[player.hidx].isFront = false;
    heros[hidx].isFront = true;
    player.hidx = hidx;
}
const roomWait = room => wait(() => room.needWait, { isImmediate: false, freq: 10 });

describe('hero', function () {
    this.timeout(1e5);
    let room = new geniusInvokationRoom(1, 'test', 'vlatest', '', 0, false, 'test');
    beforeEach(async () => {
        room = new geniusInvokationRoom(1, 'test', 'vlatest', '', 0, false, 'test');
        room.init({ id: 2, name: 'test1' });
        room.init({ id: 3, name: 'test2' });
        await startGame(room, 'AAAQhAIIAEAwhXkIB1CQhnoIB2CgiXsIB5CwinwIB6DAi34IB7Dgj38IB/DwkIAJCAAA');
        await wait(() => room.phase == PHASE.ACTION && room.players.some(p => p.canAction));
    });
    it('普攻', done => {
        const player = room.players[room.currentPlayerIdx];
        const opponent = room.players[room.currentPlayerIdx ^ 1];
        room.testDmgFn.push(() => {
            const hero = opponent.heros[opponent.hidx];
            expect(hero.hp).equal(hero.maxHp - 2);
            done();
        });
        room.getAction({ type: ACTION_TYPE.UseSkill, skillId: 1, diceSelect: player.dice.map((_, i) => i < 3) });
    });
    describe('甘雨', () => {
        it('冰莲', done => {
            const player = room.players[room.currentPlayerIdx];
            const opponent = room.players[room.currentPlayerIdx ^ 1];
            room.testDmgFn.push(() => {
                const hero = opponent.heros[opponent.hidx];
                expect(hero.hp).equal(hero.maxHp - 1);
                done();
            });
            room.getActionDev({ cpidx: opponent.pidx, cmds: [{ cmd: 'getStatus', status: 111012 }] });
            room.getAction({ type: ACTION_TYPE.UseSkill, skillId: 1, diceSelect: player.dice.map((_, i) => i < 3) });
        });
        it('霜华矢', done => {
            const player = room.players[room.currentPlayerIdx];
            const opponent = room.players[room.currentPlayerIdx ^ 1];
            room.testDmgFn.push(() => {
                expect(opponent.heros.map(h => h.hp)).eql(opponent.heros.map(h => h.maxHp - 2));
                done();
            });
            changeFrontHero(player, 0);
            room.getAction({ type: ACTION_TYPE.UseSkill, skillId: 11013, diceSelect: player.dice.map((_, i) => i < 5) });
        });
        it('冰灵珠', async () => {
            const player = room.players[room.currentPlayerIdx];
            const opponent = room.players[room.currentPlayerIdx ^ 1];
            opponent.phase = PHASE.ACTION_END;
            room.getActionDev({ cpidx: 1, smnIds: [111011] });
            player.canAction = true;
            player.status = 1;
            room.getAction({ type: ACTION_TYPE.EndPhase }, player.pidx);
            await roomWait(room);
            expect(opponent.heros.map(h => h.hp)).eql(opponent.heros.map(h => h.maxHp - 1));
        });
        it('唯此一心', () => {
            const player = room.players[room.currentPlayerIdx];
            const opponent = room.players[room.currentPlayerIdx ^ 1];
            changeFrontHero(player, 0);
            player.heros[0].skills[2].useCnt++;
            room.getActionDev({ cpidx: room.currentPlayerIdx, cmds: [{ cmd: 'getCard', cnt: 1, card: 211011 }] });
            room.testDmgFn.push(() => {
                expect(opponent.heros.map(h => h.hp)).eql(opponent.heros.map(h => h.maxHp - 2 - +!h.isFront));
                done();
            });
            room.getAction({ type: ACTION_TYPE.UseCard, cardIdxs: [5] });
        });
        it('众降天华', () => {
            const player = room.players[room.currentPlayerIdx];
            const opponent = room.players[room.currentPlayerIdx ^ 1];
            room.testDmgFn.push(() => {
                expect(opponent.heros.map(h => h.hp)).eql(opponent.heros.map(h => h.maxHp - 1 - +!h.isFront));
                done();
            });
            room.getAction({ type: ACTION_TYPE.UseSkill, skillId: 4, diceSelect: player.dice.map((_, i) => i < 3) });
        });
    });
});