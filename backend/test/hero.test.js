import { expect } from 'chai';
import geniusInvokationRoom from '../dist/backend/src/geniusInvokationRoom.js';
import { ACTION_TYPE, PHASE } from '../dist/common/constant/enum.js';
import { parseShareCode, wait } from '../dist/common/utils/utils.js';

describe('hero', () => {
    let room = new geniusInvokationRoom(1, 'test', 'vlatest', '', false, 'test');
    const execAll = fn => {
        for (let i = 0; i < 2; ++i) fn(i);
    }
    const startGame = (shareCode0, shareCode1 = shareCode0) => {
        const shareCode = [shareCode0, shareCode1];
        execAll(i => {
            const { heroIds, cardIds } = parseShareCode(shareCode[i]);
            room.getAction({ type: ACTION_TYPE.StartGame, heroIds, cardIds, shareCode: shareCode[i] }, i);
        });
        execAll(i => {
            room.getAction({ type: ACTION_TYPE.ChangeCard }, i)
            room.getAction({ type: ACTION_TYPE.ChooseInitHero, heroIdxs: [i] }, i);
            room.getAction({ type: ACTION_TYPE.ChooseInitHero, heroIdxs: [i] }, i);
        });
        execAll(i => room.getAction({ type: ACTION_TYPE.Reroll, diceSelect: room.players[i].dice.map(() => false) }));
    }
    beforeEach(() => {
        room = new geniusInvokationRoom(1, 'test', 'vlatest', '', false, 'test');
        room.init({ id: 2, name: 'test1' });
        room.init({ id: 3, name: 'test2' });
        startGame('AAAQhAIIAEAwhXkIB1CQhnoIB2CgiXsIB5CwinwIB6DAi34IB7Dgj38IB/DwkIAJCAAA');
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