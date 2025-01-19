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

describe('hero', function () {
    this.timeout(1e5);
    let room = new geniusInvokationRoom(1, 'test', 'vlatest', '', false, 'test');
    beforeEach(async () => {
        room = new geniusInvokationRoom(1, 'test', 'vlatest', '', false, 'test');
        room.init({ id: 2, name: 'test1' });
        room.init({ id: 3, name: 'test2' });
        await startGame(room, 'AAAQhAIIAEAwhXkIB1CQhnoIB2CgiXsIB5CwinwIB6DAi34IB7Dgj38IB/DwkIAJCAAA');
    });
    it('普攻', async () => {
        await wait(() => room.phase == PHASE.ACTION && room.players.some(p => p.canAction));
        const player = room.players[room.currentPlayerIdx];
        const opponent = room.players[room.currentPlayerIdx ^ 1];
        room.getAction({ type: ACTION_TYPE.UseSkill, skillId: 1, diceSelect: player.dice.map((_, i) => i < 3) });
        await wait(() => room.needWait);
        expect(opponent.heros[opponent.hidx].hp).to.equal(8);
    });
});